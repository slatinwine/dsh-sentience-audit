/**
 * Session access.
 *
 * The plugin reaches sessions through the host's `sessions` service rather than
 * importing `@deepseek-ai/dsh-session`, so it stays installable beside whichever
 * DSH revision a user runs. The service is consumed optionally: a deployment
 * without it leaves the audit tool unregistered instead of failing at load.
 *
 * @module dsh-sentience-audit/host/sessions
 */

/** The slice of the `sessions` service this plugin uses. */
export interface SessionsLike {
  get(id: string): unknown
}

/** The slice of the `agents` service this plugin uses. */
export interface AgentsLike {
  currentInitiator(): unknown
}

/**
 * The minimum Cordis context this plugin needs.
 *
 * Deliberately not `extends Context`: the real context's `sessions` is the
 * concrete `SessionStore`, and widening an interface that declares only the two
 * members used here keeps the plugin installable beside DSH revisions whose
 * store gained or lost methods.
 */
export interface AuditHostContext {
  readonly sessions: SessionsLike
  get(name: string): unknown
}

/** What one session read produced. */
export type SessionRead =
  | { readonly ok: true; readonly sessionId: string; readonly events: readonly unknown[] }
  | { readonly ok: false; readonly error: string }

function idOf(value: unknown): string | undefined {
  if (typeof value !== 'object' || value === null) return undefined
  const id = (value as { id?: unknown }).id
  if (typeof id === 'string' && id.length > 0) return id
  if (typeof id === 'number') return String(id)
  return undefined
}

function eventsOf(session: unknown): readonly unknown[] {
  if (typeof session !== 'object' || session === null) return []
  const source = session as { ownEvents?: unknown; snapshotEvents?: unknown }
  // `ownEvents()` excludes an inherited seed prefix, which is what an audit of
  // *this* session's behaviour should see.
  if (typeof source.ownEvents === 'function') {
    const events = (source.ownEvents as () => unknown)()
    if (Array.isArray(events)) return events
  }
  if (typeof source.snapshotEvents === 'function') {
    const events = (source.snapshotEvents as () => unknown)()
    if (Array.isArray(events)) return events
  }
  return []
}

/**
 * Resolve the session to audit and read its events.
 *
 * @param params.sessions - the host `sessions` service.
 * @param params.agents - the host `agents` service, used to fall back to the
 *   session that initiated the current call when no explicit id is supplied.
 * @param params.sessionId - an explicit session id, or empty to use the caller.
 * @param params.agentId - the executing agent's session id, when the caller has
 *   one; this is the most direct answer to "the current session".
 * @returns the events, or a teaching error.
 */
export function readSessionEvents(params: {
  sessions: SessionsLike
  agents?: AgentsLike | undefined
  sessionId?: string | undefined
  agentId?: string | undefined
}): SessionRead {
  let id = params.sessionId ?? ''
  if (id.length === 0) id = params.agentId ?? ''
  if (id.length === 0 && params.agents !== undefined) {
    const initiator = params.agents.currentInitiator()
    id = idOf(initiator) ?? ''
  }  if (id.length === 0) {
    return {
      ok: false,
      error:
        'no session in scope: call this tool from inside a session, or pass an explicit sessionId. '
        + 'Only live sessions can be audited — archived sessions are not readable through the sessions service.',
    }
  }

  const session = params.sessions.get(id)
  if (session === undefined || session === null) {
    return { ok: false, error: `session not live: ${id}` }
  }

  // Prefer the session's own id when it exposes one, but fall back to the id we
  // resolved: some session-like objects carry no `id`, and echoing the resolved
  // value keeps the result attributable to the session that was audited.
  return { ok: true, sessionId: id, events: eventsOf(session) }
}
