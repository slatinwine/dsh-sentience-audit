/**
 * Session-event fixtures.
 *
 * These mirror the shapes `Session.ownEvents()` yields: tool results arrive as
 * `role: 'user'` messages whose source is the tool, and tool-call arguments are
 * the raw serialized JSON string the model produced.
 */

/** Build one session event. */
function event(type: string, seq: number, data: Record<string, unknown>): unknown {
  return { type, seq, time: 1_700_000_000_000 + seq, data }
}

/** A tool call plus its result, as a session records the pair. */
export interface TurnSpec {
  readonly tool: string
  /** Raw argument JSON, exactly as recorded. */
  readonly args: string
  /** Whether the result is an error. */
  readonly isError?: boolean
}

/** Options accepted by {@link sessionFixture}. */
export interface FixtureOptions {
  readonly tools?: readonly TurnSpec[]
  /** Emit one user prompt at the start of the first N turns. */
  readonly prompts?: number
  /** Emit a compaction system message. */
  readonly compaction?: boolean
  /** `totalTokens` recorded per assistant message. */
  readonly tokens?: number
  /** Assistant messages recorded per step. */
  readonly assistantPerStep?: number
  /** Actions grouped into one turn. */
  readonly perTurn?: number
}

/**
 * Build a transcript-shaped event log.
 *
 * @param options - tools to call, prompts, and budget events.
 * @returns an ordered list of session events.
 */
export function sessionFixture(options: FixtureOptions = {}): unknown[] {
  const tools = options.tools ?? []
  const events: unknown[] = []
  let seq = 0
  const next = (): number => (seq += 1)

  const perTurn = options.perTurn ?? 5
  let callIndex = 0
  let callId = 0
  let step = 0

  for (let t = 1; t <= Math.max(1, Math.ceil(tools.length / perTurn)); t += 1) {
    events.push(event('turn/start', next(), { turn: t }))
    if (options.prompts !== undefined && t <= options.prompts) {
      events.push(
        event('user/message', next(), {
          message: {
            role: 'user',
            source: { kind: 'user' },
            content: [{ type: 'text', text: `prompt ${t}` }],
          },
        }),
      )
    }

    for (let k = 0; k < perTurn && callIndex < tools.length; k += 1) {
      const spec = tools[callIndex]!
      callIndex += 1
      step += 1
      events.push(event('step/start', next(), { turn: t, step }))
      for (let a = 0; a < (options.assistantPerStep ?? 1); a += 1) {
        events.push(
          event('assistant/message', next(), {
            turn: t,
            step,
            message: { role: 'assistant', content: [{ type: 'text', text: `step ${step}` }] },
            usage: { totalTokens: options.tokens ?? 100 },
          }),
        )
      }
      callId += 1
      events.push(
        event('tool/call', next(), {
          turn: t,
          step,
          callId: `call-${callId}`,
          name: spec.tool,
          arguments: spec.args,
        }),
      )
      events.push(
        event('tool/result', next(), {
          turn: t,
          step,
          ...(spec.isError === true ? { error: { name: 'ToolError', code: 'E_FAIL' } } : {}),
          message: {
            role: 'user',
            source: { kind: 'tool', callId: `call-${callId}` },
            content: [
              {
                type: 'tool-result',
                toolCallId: `call-${callId}`,
                isError: spec.isError === true,
                content: [{ type: 'text', text: spec.isError === true ? 'failed' : 'ok' }],
              },
            ],
          },
        }),
      )
      events.push(event('step/end', next(), { turn: t, step }))
    }

    events.push(event('turn/end', next(), { turn: t, reason: { kind: 'completed' } }))
  }

  if (options.compaction === true) {
    events.push(
      event('system/message', next(), {
        turn: 1,
        step: 0,
        message: {
          role: 'system',
          source: { kind: 'plugin', plugin: 'compaction' },
          content: [{ type: 'text', text: 'Compaction applied: context window budget exceeded.' }],
        },
      }),
    )
  }

  return events
}

/** A trajectory with no tool use at all. */
export function proseOnlyFixture(): unknown[] {
  return [
    event('turn/start', 1, { turn: 1 }),
    event('user/message', 2, {
      message: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text: 'hello' }] },
    }),
    event('step/start', 3, { turn: 1, step: 1 }),
    event('assistant/message', 4, {
      turn: 1,
      step: 1,
      usage: { totalTokens: 10 },
      message: {
        role: 'assistant',
        content: [
          {
            type: 'text',
            // Deliberately loaded with every keyword an earlier, wording-based
            // revision scored on. A structural rubric must score none of it.
            text: 'I assume the file exists, so I will verify it, then reconsider and correct my earlier '
              + 'approach; the trade-off is cost versus reliability, and I need to check my attention '
              + 'and my focus. As predicted, the result turned out as expected.',
          },
        ],
      },
    }),
    event('turn/end', 5, { turn: 1, reason: { kind: 'completed' } }),
  ]
}
