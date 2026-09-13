/**
 * Structural analysis of a transcript.
 *
 * Everything here is replayable structure: call graphs, argument lineage,
 * module switching, failure recovery, and produce-then-observe loops.
 *
 * **No prose is read.** An earlier revision scored indicators from wording
 * ("the model wrote 假设 / verify / trade-off"), which measured vocabulary
 * rather than architecture and inflated every score. The paper warns in its own
 * Section 3 that behavioural evidence is unreliable precisely because a system
 * can mimic behaviour while working differently, and a text trace of a model
 * talking about consciousness is the purest case of that failure. Structural
 * facts cannot be mimicked by phrasing, so the rubric uses only those.
 *
 * @module dsh-sentience-audit/core/analysis
 */

import type { Transcript } from './transcript.ts'
import type { AuditMetrics } from './types.ts'

const WRITE_TOOLS = new Set(['write', 'edit'])
const READ_TOOLS = new Set(['read', 'read_image'])

/**
 * How much two argument blobs must differ before a retry counts as a changed
 * approach. Below this similarity the call is treated as the same attempt; the
 * value is deliberately close to 1 so only a real edit clears it.
 */
const ARGUMENT_CHANGE_THRESHOLD = 0.9

/** Tools that act directly on the workspace and therefore always observe it. */
const SESSION_MODULES = new Set([
  'pwsh',
  'bash',
  'read',
  'read_image',
  'write',
  'edit',
  'glob',
  'grep',
])

/**
 * Argument shapes that turn a shell command into a read-back probe: running
 * something and then looking at what it produced is the observable trace of a
 * produce-then-observe loop.
 *
 * Both PowerShell and POSIX spellings are listed because the same plugin runs
 * on Windows, macOS and Linux, and a session's toolchain depends on the host.
 */
const OBSERVE_PATTERNS: readonly RegExp[] = [
  /audit/i,
  /verify/i,
  /\bcheck\b/i,
  /\btest\b/i,
  /status/i,
  /probe/i,
  /validate/i,
  /preview/i,
  // POSIX readers
  /\bcat\b/i,
  /\bhead\b/i,
  /\btail\b/i,
  /\bless\b/i,
  /\bmore\b/i,
  /\bwc\b/i,
  /\bstat\b/i,
  /\bfile\b/i,
  /\bod\b/i,
  /\bxxd\b/i,
  /\bsed\b/i,
  /\bawk\b/i,
  /\bgrep\b/i,
  /\bfind\b/i,
  /\bls\b/i,
  /\bdu\b/i,
  /\bdf\b/i,
  /\bjq\b/i,
  // PowerShell readers
  /Get-Content/i,
  /Select-String/i,
  /Test-Path/i,
  /Test-/i,
  /Get-Item/i,
  /Get-ChildItem/i,
  /\bdir\b/i,
  /\btype\b/i,
]

/** Path-like tokens inside a serialized argument blob. */
const PATH_TOKEN = /[A-Za-z0-9_.\-\\/]{2,}[\\/][A-Za-z0-9_.\-\\/]*\.[A-Za-z0-9]{1,8}\b/g

/**
 * Does this path text look like a Windows path?
 *
 * Windows filesystems are case-insensitive, so two spellings of one path are
 * the same file there. POSIX filesystems are case-sensitive, so folding case
 * would merge genuinely different files — `A.ts` and `a.ts` can both exist.
 * The trace does not say which platform produced it, but the path's own shape
 * does: backslashes or a drive letter mean Windows.
 *
 * @param value - raw path text.
 * @returns whether case should be folded for comparison.
 */
function looksLikeWindowsPath(value: string): boolean {
  return value.includes('\\') || /^[A-Za-z]:/.test(value)
}

/**
 * Normalize a path for comparison: forward slashes always, case folded only for
 * Windows-shaped paths.
 *
 * @param value - raw path text.
 * @returns the comparison form.
 */
function normalizePath(value: string): string {
  const slashed = value.replace(/\\/g, '/')
  return looksLikeWindowsPath(value) ? slashed.toLowerCase() : slashed
}

/** Every path-like token in `text`, normalized to forward slashes. */
export function pathTokens(text: string): string[] {
  if (text.length === 0) return []
  const out: string[] = []
  // A fresh regex per call keeps `lastIndex` from leaking between calls.
  const re = new RegExp(PATH_TOKEN.source, 'g')
  let match = re.exec(text)
  let guard = 0
  while (match !== null && guard < 200) {
    out.push(normalizePath(match[0]))
    if (re.lastIndex === match.index) re.lastIndex += 1
    match = re.exec(text)
    guard += 1
  }
  return out
}

/** Read one string field out of a serialized JSON argument blob. */
export function argValue(args: string, key: string): string {
  if (args.length === 0) return ''
  const re = new RegExp(`"${key}"\\s*:\\s*"((?:[^"\\\\]|\\\\.){0,240})"`)
  const match = re.exec(args)
  return match === null ? '' : (match[1] ?? '')
}

/**
 * Read a declared artifact path from a tool's arguments.
 *
 * DSH's filesystem tools accept the target under `file_path`; `path` is
 * accepted as well so a deployment whose spelling differs still resolves.
 *
 * @param args - the raw argument blob.
 * @returns the comparison form of the path, or an empty string.
 */
function declaredPath(args: string): string {
  return normalizePath(argValue(args, 'file_path') || argValue(args, 'path'))
}

function touchesSessionModule(toolName: string, args: string): boolean {
  if (SESSION_MODULES.has(toolName)) return true
  // Search tools read an index, not the workspace's current state, so they do
  // not count as observing produced output.
  if (toolName === 'grep' || toolName === 'glob') return false
  return OBSERVE_PATTERNS.some((pattern) => pattern.test(args))
}

/** Do two argument blobs share a path token of at least `minLength`? */
function sharesPath(left: string, right: string, minLength = 4): boolean {
  const tokens = pathTokens(left)
  const haystack = normalizePath(right)
  for (const token of tokens.slice(0, 60)) {
    const tail = token.split('/').pop() ?? ''
    if (tail.length >= minLength && haystack.includes(tail)) return true
  }
  return false
}

/**
 * Token-set similarity of two serialized argument blobs, in `[0, 1]`.
 *
 * Used to tell a genuine change of approach from a cosmetic edit: retrying with
 * one character different is not recovery, but switching the target file,
 * flipping a mode, or rewriting the payload is.
 *
 * Token overlap alone is not enough. Two `write` calls carrying different files
 * can share almost every identifier they mention yet differ completely, because
 * the vocabulary of a codebase repeats; see {@link approachChanged} for the
 * length term that catches them.
 *
 * @param left - one argument blob.
 * @param right - the other argument blob.
 * @returns 1 when identical, 0 when nothing is shared, and `0` for two empty
 *   blobs (nothing in common is the honest reading).
 */
export function argumentSimilarity(left: string, right: string): number {
  const a0 = typeof left === 'string' ? left : ''
  const b0 = typeof right === 'string' ? right : ''
  if (a0 === b0) return 1
  const a = tokenSet(a0)
  const b = tokenSet(b0)
  if (a.size === 0 || b.size === 0) return 0
  let shared = 0
  for (const token of a) if (b.has(token)) shared += 1
  return shared / (a.size + b.size - shared)
}

/** Identifier-ish tokens of an argument blob, deduplicated. */
function tokenSet(text: string): Set<string> {
  const source = typeof text === 'string' ? text : ''
  return new Set(source.split(/[^A-Za-z0-9_.\-\\/]+/).filter((token) => token.length > 0))
}

/**
 * Similarity of two blobs by size, in `[0, 1]`.
 *
 * @param left - one argument blob.
 * @param right - the other argument blob.
 * @returns `min/max` of the two token counts, or 0 when either is empty.
 */
export function argumentLengthRatio(left: string, right: string): number {
  const a = tokenSet(left).size
  const b = tokenSet(right).size
  if (a === 0 || b === 0) return 0
  return Math.min(a, b) / Math.max(a, b)
}

/**
 * Canonical form of a serialized argument blob, or `undefined` when it is not
 * parseable JSON.
 *
 * Key order is normalized because a serialized object whose keys were permuted
 * carries the same payload; treating that as a different approach would let a
 * pure re-serialization count as recovery.
 *
 * @param args - the raw argument blob.
 * @returns a stable string for structural comparison.
 */
export function canonicalArgs(args: string): string | undefined {
  if (typeof args !== 'string' || args.length === 0) return undefined
  try {
    return JSON.stringify(sortDeep(JSON.parse(args)))
  } catch {
    return undefined
  }
}

/** Recursively sort object keys so serialization order stops mattering. */
function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (value !== null && typeof value === 'object') {
    const source = value as Record<string, unknown>
    const out: Record<string, unknown> = {}
    for (const key of Object.keys(source).sort()) out[key] = sortDeep(source[key])
    return out
  }
  return value
}

/**
 * How much of two blobs is shared, measured as the longest common prefix plus
 * longest common suffix over the longer blob's length, in `[0, 1]`.
 *
 * This is the fallback for a payload that does not parse as JSON — typically a
 * large argument blob the session truncated. It is content-level rather than
 * vocabulary-level, so a rewritten payload of the same size is correctly read
 * as different even when both blobs draw on the same identifiers.
 *
 * @param left - one argument blob.
 * @param right - the other argument blob.
 * @returns the shared fraction, or 0 when either blob is empty.
 */
export function sharedPrefixSuffixRatio(left: string, right: string): number {
  const a = typeof left === 'string' ? left : ''
  const b = typeof right === 'string' ? right : ''
  if (a.length === 0 || b.length === 0) return 0
  if (a === b) return 1
  const shortest = Math.min(a.length, b.length)
  let prefix = 0
  while (prefix < shortest && a[prefix] === b[prefix]) prefix += 1
  let suffix = 0
  while (suffix < shortest - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix]) suffix += 1
  return (prefix + suffix) / Math.max(a.length, b.length)
}

/**
 * Did the trace change approach, or merely retry?
 *
 * The primary test is structural: two parseable argument blobs are the same
 * attempt when their canonical forms match, regardless of key order — a pure
 * re-serialization is not a new approach.
 *
 * When a blob is not parseable JSON (a truncated or streamed payload), the
 * comparison falls back to how much content the two blobs share. Vocabulary
 * overlap is deliberately unused there: identifiers repeat across a codebase,
 * so a same-size rewrite can share almost every token while being a completely
 * different attempt.
 *
 * @param failedArgs - arguments of the call that failed.
 * @param nextArgs - arguments of the next call.
 * @returns whether the next attempt is a genuinely different approach.
 */
export function approachChanged(failedArgs: string, nextArgs: string): boolean {
  const failedText = typeof failedArgs === 'string' ? failedArgs : ''
  const nextText = typeof nextArgs === 'string' ? nextArgs : ''
  // Identical blobs are the same attempt, including two argument-less calls:
  // `canonicalArgs('')` is undefined, so that case must be settled here or it
  // would fall through and read as a change.
  if (failedText === nextText) return false

  const failed = canonicalArgs(failedText)
  const next = canonicalArgs(nextText)
  if (failed !== undefined && next !== undefined) return failed !== next
  return sharedPrefixSuffixRatio(failedText, nextText) < ARGUMENT_CHANGE_THRESHOLD
}

/**
 * Compute every structural metric the rubric consumes.
 *
 * @param transcript - an owned transcript from `readTranscript`.
 * @returns the metrics, with `sessionId` left empty for the caller to fill.
 */
export function analyze(transcript: Transcript): AuditMetrics {
  const calls = transcript.toolCalls
  const results = transcript.toolResults

  const names: string[] = []
  const familyCounts: Record<string, number> = {
    fs: 0,
    search: 0,
    shell: 0,
    web: 0,
    delegate: 0,
    meta: 0,
    other: 0,
  }
  for (const call of calls) {
    if (!names.includes(call.name)) names.push(call.name)
    familyCounts[call.family] = (familyCounts[call.family] ?? 0) + 1
  }
  const toolFamilyCount = Object.values(familyCounts).filter((count) => count > 0).length

  // Interleaving: reasoning recorded before a tool call within the same turn.
  let interleavings = 0
  let toolRuns = 0
  let inRun = false
  for (const call of calls) {
    if (call.step === 0) {
      if (inRun) {
        toolRuns += 1
        inRun = false
      }
      continue
    }
    if (!inRun) {
      inRun = true
      toolRuns += 1
    }
    const hasEarlierReasoning = transcript.assistant.some(
      (message) => message.turn === call.turn && message.step < call.step,
    )
    if (hasEarlierReasoning) interleavings += 1
  }

  // Module succession: consecutive calls that switch specialised family.
  let moduleSuccessions = 0
  for (let i = 1; i < calls.length; i += 1) {
    if (calls[i]!.family !== calls[i - 1]!.family) moduleSuccessions += 1
  }

  // Dependent chain: a later call whose arguments carry a path the previous
  // call referenced. This is the observable form of "the result was consumed".
  let dependentCalls = 0
  for (let i = 1; i < calls.length; i += 1) {
    const args = normalizePath(calls[i]!.args)
    if (args.length === 0 || args === '{}') continue
    if (sharesPath(calls[i - 1]!.args, args)) dependentCalls += 1
  }

  // Failure recovery: the trace changed approach instead of repeating itself.
  // A different tool always counts. The same tool counts only when its
  // arguments genuinely changed — vocabulary or size — so a loop of
  // near-identical calls cannot read as metacognitive monitoring.
  let toolErrors = 0
  let recoveries = 0
  for (let i = 0; i < calls.length; i += 1) {
    const result = results[i]
    if (!result || !result.isError) continue
    toolErrors += 1
    const next = calls[i + 1]
    if (!next) continue
    const changedTool = next.name !== calls[i]!.name
    if (changedTool || approachChanged(calls[i]!.args, next.args)) recoveries += 1
  }

  // Artifacts the session itself produced, and whether anything consumed them.
  const artifacts: string[] = []
  for (const call of calls) {
    if (!WRITE_TOOLS.has(call.name)) continue
    const path = declaredPath(call.args)
    if (path.length > 0 && !artifacts.includes(path)) artifacts.push(path)
  }
  let artifactReuse = 0
  for (const artifact of artifacts) {
    const consumed = calls.some(
      (call) => !WRITE_TOOLS.has(call.name) && normalizePath(call.args).includes(artifact),
    )
    if (consumed) artifactReuse += 1
  }

  // Produce-then-observe: something was written, then read back through an
  // input module. Same-artifact reads also count as self-readback.
  let injectionLoops = 0
  let selfReadbacks = 0
  for (let i = 0; i < calls.length; i += 1) {
    const call = calls[i]!
    if (READ_TOOLS.has(call.name)) {
      const path = declaredPath(call.args)
      if (path.length > 0) {
        const writtenEarlier = calls
          .slice(0, i)
          .some((earlier) => WRITE_TOOLS.has(earlier.name) && declaredPath(earlier.args) === path)
        if (writtenEarlier) selfReadbacks += 1
      }
    }
    if (!touchesSessionModule(call.name, call.args)) continue
    const probe = normalizePath(call.args)
    const producedEarlier = calls
      .slice(0, i)
      .some((earlier) => WRITE_TOOLS.has(earlier.name) && sharesPath(earlier.args, probe))
    if (producedEarlier) injectionLoops += 1
  }

  const turnsWithAction = new Set(calls.map((call) => call.turn)).size

  return {
    sessionId: '',
    turns: transcript.turns,
    steps: transcript.steps,
    assistantMessages: transcript.assistant.length,
    userMessages: transcript.users,
    contextTokens: transcript.tokens,
    toolCalls: calls.length,
    distinctTools: names.length,
    toolErrors,
    toolFamilies: toolFamilyCount,
    interleavings,
    toolRuns,
    moduleSuccessions,
    dependentCalls,
    recoveries,
    artifacts: artifacts.length,
    artifactReuse,
    selfReadbacks,
    injectionLoops,
    plans: transcript.plans,
    goals: transcript.goals,
    turnsWithAction,
    compactions: transcript.compactions,
    budgetEvents: transcript.budgetEvents,
    interrupted: transcript.interrupted,
  }
}
