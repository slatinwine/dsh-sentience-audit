/**
 * Trajectory reading: turn a session event log into the small, owned plain-data
 * transcript the rubric operates on.
 *
 * Two rules govern this module.
 *
 * 1. **Read only leaf scalars.** Session events are live DSH objects. Nothing is
 *    serialized, cloned, or enumerated as a whole; each handler reaches for the
 *    exact scalar it needs and constructs owned data.
 * 2. **Be defensive about shape.** The reader accepts several plausible nestings
 *    for each event kind, because a plugin distributed on its own cannot assume
 *    it was built against the same internal revision as the host it lands in.
 *    An unrecognized event is skipped, never fatal.
 *
 * @module dsh-sentience-audit/core/transcript
 */

/** One tool invocation, reduced to the fields the rubric needs. */
export interface ToolCallRecord {
  readonly name: string
  /** Raw serialized arguments, as the session recorded them. */
  readonly args: string
  readonly turn: number
  readonly step: number
  readonly family: string
}

/** One tool outcome. */
export interface ToolResultRecord {
  readonly tool: string
  readonly isError: boolean
}

/** One assistant message position. */
export interface AssistantRecord {
  readonly turn: number
  readonly step: number
}

/** The owned transcript. */
export interface Transcript {
  turns: number
  steps: number
  users: number
  tokens: number
  compactions: number
  budgetEvents: number
  interrupted: number
  plans: number
  goals: number
  assistant: AssistantRecord[]
  toolCalls: ToolCallRecord[]
  toolResults: ToolResultRecord[]
}

/** Specialised tool families a session can call on. */
export const TOOL_FAMILY: readonly { readonly family: string; readonly re: RegExp }[] = [
  { family: 'fs', re: /^(read|read_image|write|edit)$/ },
  { family: 'search', re: /^(glob|grep)$/ },
  // Shell tool names differ per platform: `pwsh`/`powershell` on Windows,
  // `bash`/`sh`/`zsh`/`dash` on macOS and Linux. Same specialised module.
  { family: 'shell', re: /^(pwsh|powershell|bash|sh|zsh|dash)$/ },
  { family: 'web', re: /^web_/ },
  { family: 'delegate', re: /^(subagent|subagent_fork|workflow|ralph|send_message|list_agents|interrupt_agent)$/ },
  { family: 'meta', re: /^(todo_write|create_goal|update_goal|get_goal|ask_user_question|job_|present|skill|cordis_)/ },
]

/** Classify a tool name into a module family. */
export function familyOf(toolName: string): string {
  for (const entry of TOOL_FAMILY) if (entry.re.test(toolName)) return entry.family
  return 'other'
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stringField(source: Record<string, unknown>, key: string): string {
  const value = source[key]
  return typeof value === 'string' ? value : ''
}

function numberField(source: Record<string, unknown>, key: string): number {
  const value = source[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/**
 * Does this message carry a tool result rather than a user prompt?
 *
 * Tool results are persisted as `role: 'user'` messages whose source is the
 * tool, so this cannot be decided from the role alone.
 */
function isToolMessage(message: Record<string, unknown>): boolean {
  const source = message['source']
  if (isRecord(source)) {
    const kind = source['kind']
    if (typeof kind === 'string') return kind === 'tool'
  }
  const content = message['content']
  if (Array.isArray(content) && content.length === 1) {
    const first = content[0]
    if (isRecord(first) && first['type'] === 'tool-result') return true
  }
  return false
}

/** Text of any content block array, flattened for the budget/compaction probes. */
function textOfBlocks(content: unknown): string {
  if (!Array.isArray(content)) return ''
  const parts: string[] = []
  for (const block of content) {
    if (!isRecord(block)) continue
    const type = block['type']
    if (type === 'text' || type === 'reasoning') {
      const text = block['text']
      if (typeof text === 'string') parts.push(text)
      continue
    }
    if (type === 'tool-call') {
      const name = block['name']
      if (typeof name === 'string') parts.push(`<tool>${name}</tool>`)
    }
  }
  return parts.join('\n')
}

/** Pull the message object out of whichever nesting this event uses. */
function messageOf(data: Record<string, unknown>): Record<string, unknown> | undefined {
  const nested = data['message']
  if (isRecord(nested)) return nested
  return typeof data['role'] === 'string' ? data : undefined
}

/** Create an empty transcript. */
export function emptyTranscript(): Transcript {
  return {
    turns: 0,
    steps: 0,
    users: 0,
    tokens: 0,
    compactions: 0,
    budgetEvents: 0,
    interrupted: 0,
    plans: 0,
    goals: 0,
    assistant: [],
    toolCalls: [],
    toolResults: [],
  }
}

/**
 * Read a session event log into an owned transcript.
 *
 * @param events - the session's own events, in order. Unrecognized entries are skipped.
 * @returns the owned transcript.
 */
export function readTranscript(events: readonly unknown[]): Transcript {
  const transcript = emptyTranscript()
  const namesByCallId = new Map<string, string>()

  for (const raw of events) {
    if (!isRecord(raw)) continue
    const type = raw['type']
    if (typeof type !== 'string') continue
    const data = raw['data']
    if (!isRecord(data)) continue

    switch (type) {
      case 'turn/start':
        transcript.turns += 1
        break
      case 'step/start':
        transcript.steps += 1
        break
      case 'session/end-seed':
        transcript.compactions += 1
        break
      case 'system/message': {
        const message = messageOf(data)
        const text = message ? textOfBlocks(message['content']) : ''
        if (/compact|Compaction|压缩/.test(text)) transcript.compactions += 1
        if (/budget|Context window|预算/.test(text)) transcript.budgetEvents += 1
        break
      }
      case 'user/message': {
        const message = messageOf(data)
        if (!message) break
        if (isToolMessage(message)) {
          const content = message['content']
          let isError = false
          if (Array.isArray(content) && isRecord(content[0]) && content[0]['isError'] === true) isError = true
          transcript.toolResults.push({ tool: 'unknown', isError })
        } else {
          transcript.users += 1
        }
        break
      }
      case 'assistant/message': {
        const usage = data['usage']
        if (isRecord(usage)) transcript.tokens += numberField(usage, 'totalTokens')
        if (data['interrupted'] === true) transcript.interrupted += 1
        transcript.assistant.push({
          turn: numberField(data, 'turn'),
          step: numberField(data, 'step'),
        })
        break
      }
      case 'tool/call': {
        const name = stringField(data, 'name') || 'unknown'
        const callId = stringField(data, 'callId')
        if (callId.length > 0) namesByCallId.set(callId, name)
        if (name === 'todo_write') transcript.plans += 1
        if (name === 'create_goal' || name === 'update_goal') transcript.goals += 1
        transcript.toolCalls.push({
          name,
          args: stringField(data, 'arguments'),
          turn: numberField(data, 'turn'),
          step: numberField(data, 'step'),
          family: familyOf(name),
        })
        break
      }
      case 'tool/result': {
        const message = messageOf(data)
        const content = message ? message['content'] : undefined
        let callId = ''
        let isError = data['error'] !== undefined
        if (Array.isArray(content) && isRecord(content[0])) {
          const first = content[0]
          const id = first['toolCallId']
          if (typeof id === 'string') callId = id
          if (first['isError'] === true) isError = true
        }
        const tool = callId.length > 0 ? namesByCallId.get(callId) : undefined
        transcript.toolResults.push({ tool: tool ?? 'unknown', isError })
        break
      }
      default:
        break
    }
  }

  return transcript
}
