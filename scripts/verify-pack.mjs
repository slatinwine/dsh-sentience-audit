/**
 * Verify the package is publishable and installable.
 *
 * Four independent checks, because they fail differently:
 *
 * 1. **`files` patterns resolve to real files.** A pattern that matches nothing
 *    ships nothing, silently. `lib/` is generated, so this is the check that
 *    catches "the build did not run" and "the glob is wrong".
 * 2. **Required entry points are covered** by those patterns — the patch file,
 *    the Host entry, the client entry, and the type declarations.
 * 3. **The bundle contract holds**: `dsh.bundle.patch` is declared, and the row
 *    inside `cordis.patch.yml` names the same package as `package.json`.
 * 4. **The client half is reachable**: `dsh.client` is declared and `./client` is
 *    exported, or the panel can never be served.
 *
 * These matter to a DSH bundle specifically: a package whose patch file or built
 * entry point is absent installs cleanly and then contributes no composition
 * layer, which is silent at install time and only visible at boot.
 *
 *   node scripts/verify-pack.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const manifest = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const patch = readFileSync(join(root, 'cordis.patch.yml'), 'utf8')

const problems = []

/** Every file in the package, excluding the usual heavy directories. */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git' || entry === '.npm-cache') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else out.push(relative(root, full).split(sep).join('/'))
  }
  return out
}

/** Translate one `files` pattern (glob subset npm supports) into a RegExp. */
function patternToRegExp(pattern) {
  const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const body = escaped
    .replace(/\*\*\//g, '(?:.*/)?')
    .replace(/\*\*/g, '.*')
    .replace(/\*/g, '[^/]*')
  return new RegExp(`^${body}$`)
}

const present = walk(root)
const patterns = manifest.files ?? []
const matchedBy = new Map()

for (const pattern of patterns) {
  const re = patternToRegExp(pattern)
  const hits = present.filter((file) => re.test(file))
  if (hits.length === 0) problems.push(`files pattern "${pattern}" matches nothing`)
  matchedBy.set(pattern, hits)
}

const covered = new Set([...matchedBy.values()].flat())

/** Everything an installed copy must contain, on both distribution routes. */
const required = [
  'package.json',
  'LICENSE',
  'README.md',
  'cordis.patch.yml',
  'lib/index.js',
  'lib/client/index.js',
  'lib/types/index.d.ts',
]

for (const entry of required) {
  const exists = present.includes(entry)
  if (!exists) {
    problems.push(`${entry} does not exist${entry.startsWith('lib/') ? ' — run `npm run build`' : ''}`)
    continue
  }
  // package.json and LICENSE are always packed by npm; the rest must be covered.
  if (entry !== 'package.json' && entry !== 'LICENSE' && !covered.has(entry)) {
    problems.push(`${entry} exists but no "files" pattern ships it`)
  }
}

// ── The bundle contract ──────────────────────────────────────────────────────
if (manifest.dsh?.bundle?.patch !== './cordis.patch.yml') {
  problems.push('package.json does not declare dsh.bundle.patch = ./cordis.patch.yml')
}

const rowName = /name:\s*['"]?([^'"\s]+)['"]?/.exec(patch)?.[1]
if (rowName !== manifest.name) {
  problems.push(`cordis.patch.yml names "${rowName}" but the package is "${manifest.name}"`)
}

// ── The client half ──────────────────────────────────────────────────────────
if (manifest.dsh?.client?.platform !== 'web') {
  problems.push('package.json does not declare dsh.client.platform')
}
if (manifest.exports?.['./client'] === undefined) {
  problems.push("package.json has no './client' export, so the panel cannot be served")
}

if (problems.length > 0) {
  for (const problem of problems) console.error(`  FAIL ${problem}`)
  process.exit(1)
}

console.log(`  ok   ${patterns.length} files patterns, all matching (${covered.size} files shipped)`)
console.log(`  ok   every required entry point is shipped, including the built lib/`)
console.log(`  ok   bundle row "${rowName}" matches the package name`)
console.log(`  ok   client half declared and exported`)
