/**
 * Host half: register the audit tool on the session's tool registry.
 *
 * This entry depends only on `sessions`, so it installs in any deployment that
 * has a session store. The browser panel is a separate entry (`./client`).
 *
 * @module dsh-sentience-audit
 */

import type { Context } from '@deepseek-ai/cordis'

import { assess } from './core/assess.ts'
import type { AuditOutcome } from './core/types.ts'
import {
  readSessionEvents,
  type AgentsLike,
  type AuditHostContext,
  type SessionsLike,
} from './host/sessions.ts'
import { defineSentienceAuditTool, TOOL_NAME } from './host/tool.ts'

export { TOOL_NAME }
export { assess } from './core/assess.ts'
export { DISCLAIMER, FAMILIES, LEVELS, REQUIREMENTS, RUBRIC, RUBRIC_SOURCE } from './core/rubric.ts'
export { renderMarkdown } from './core/markdown.ts'
export {
  argumentSimilarity,
  approachChanged,
  canonicalArgs,
  pathTokens,
  sharedPrefixSuffixRatio,
} from './core/analysis.ts'
export type {
  AgentsLike,
  AuditHostContext,
  SessionRead,
  SessionsLike,
} from './host/sessions.ts'
export type {
  AuditFailure,
  AuditMetrics,
  AuditOutcome,
  AuditResult,
  EvidenceKind,
  FamilyKey,
  FamilyVerdict,
  IndicatorStatus,
  IndicatorVerdict,
} from './core/types.ts'

/** Stable Cordis plugin name. */
export const name = 'sentience-audit'

/** `sessions` is a hard dependency; everything else is read optionally. */
export const inject = ['sessions']

/** Tool registry surface this plugin registers into. */
interface ToolRegistry {
  register(definition: unknown): () => void
}

/**
 * Register the audit capability for one agent session.
 *
 * The parameter is narrowed to {@link AuditHostContext} — the two members this
 * plugin actually uses — and the real context is accepted at the call site, so
 * the plugin does not have to track `SessionStore`'s full surface.
 *
 * @param ctx - the plugin's Cordis context, scoped to one agent session.
 */
export function apply(ctx: Context): void {
  const host = ctx as unknown as AuditHostContext
  const agents = host.get('agents') as AgentsLike | undefined
  const tools = host.get('tools') as ToolRegistry | undefined

  // Without a tool registry there is nothing to contribute, and throwing here
  // would fail an otherwise healthy deployment.
  if (tools === undefined) return

  // `ctx.tools.register` is a fiber effect: stopping the plugin unregisters it.
  tools.register(defineSentienceAuditTool({ sessions: host.sessions, agents }))
}

/**
 * Run one audit against an explicit event list.
 *
 * Exported so a surface that already holds a Conversation Snapshot can audit it
 * without reaching for the session store.
 *
 * @param params.sessionId - session id to echo into the result.
 * @param params.events - session events, in order.
 * @returns the audit outcome.
 */
export function auditEvents(params: {
  sessionId: string
  events: readonly unknown[]
}): AuditOutcome {
  return assess(params)
}

/**
 * Read one live session and audit it.
 *
 * @param params.sessions - the host `sessions` service.
 * @param params.agents - optional `agents` service for caller resolution.
 * @param params.sessionId - explicit session id, or empty for the caller.
 * @returns the audit outcome, or a failure explaining why it could not run.
 */
export function auditSession(params: {
  sessions: SessionsLike
  agents?: AgentsLike | undefined
  sessionId?: string | undefined
}): AuditOutcome {
  const read = readSessionEvents({
    sessions: params.sessions,
    agents: params.agents,
    sessionId: params.sessionId ?? '',
  })
  if (!read.ok) {
    return { ok: false, error: read.error, computedAt: new Date().toISOString() }
  }
  return assess({ sessionId: read.sessionId, events: read.events })
}
