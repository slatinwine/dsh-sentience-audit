/**
 * Runtime contract verification.
 *
 * Runs against the BUILT output, so it exercises the real `defineTool` DSL
 * validator and the real module graph rather than the TypeScript view of them.
 *
 *   node tests/contract.mjs
 */

import { defineSentienceAuditTool, TOOL_NAME } from '../lib/host/tool.js'
import { apply } from '../lib/index.js'

let passed = 0
let failed = 0

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  ok   ${label}`)
  } else {
    failed += 1
    console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

function section(title) {
  console.log(`\n${title}`)
}

/** A session standing in for the real store. */
function fakeSession(events) {
  return { ownEvents: () => events }
}

const SAMPLE_EVENTS = [
  { type: 'turn/start', seq: 1, data: { turn: 1 } },
  { type: 'turn/start', seq: 2, data: { turn: 2 } },
  { type: 'step/start', seq: 3, data: { turn: 1, step: 1 } },
  { type: 'assistant/message', seq: 4, data: { turn: 1, step: 1, usage: { totalTokens: 10 } } },
  {
    type: 'tool/call',
    seq: 5,
    data: { turn: 1, step: 1, callId: 'c1', name: 'write', arguments: '{"file_path":"D:/w/out/report.md"}' },
  },
  {
    type: 'tool/result',
    seq: 6,
    data: {
      turn: 1,
      step: 1,
      message: {
        role: 'user',
        source: { kind: 'tool', callId: 'c1' },
        content: [{ type: 'tool-result', toolCallId: 'c1', content: [] }],
      },
    },
  },
  {
    type: 'tool/call',
    seq: 7,
    data: { turn: 1, step: 2, callId: 'c2', name: 'read', arguments: '{"file_path":"D:/w/out/report.md"}' },
  },
  {
    type: 'tool/result',
    seq: 8,
    data: {
      turn: 1,
      step: 2,
      message: {
        role: 'user',
        source: { kind: 'tool', callId: 'c2' },
        content: [{ type: 'tool-result', toolCallId: 'c2', content: [] }],
      },
    },
  },
  {
    type: 'system/message',
    seq: 9,
    data: {
      turn: 1,
      step: 0,
      message: { role: 'system', source: { kind: 'plugin', plugin: 'x' }, content: [{ type: 'text', text: 'Compaction applied' }] },
    },
  },
]

section('tool definition passes the real DSL validator')
let definition
try {
  definition = defineSentienceAuditTool({ sessions: { get: () => fakeSession(SAMPLE_EVENTS) } })
  check('defineTool accepted the schema at runtime', definition?.name === TOOL_NAME)
} catch (error) {
  check('defineTool accepted the schema at runtime', false, error.message)
}

if (definition) {
  section('declared surface')
  check('tool name is sentience_audit', definition.name === 'sentience_audit')
  check('parameters declare sessionId', 'sessionId' in definition.parameters.properties)
  check('sessionId is optional (no required flag)', definition.parameters.properties.sessionId.required === undefined)
  check('output schema requires nothing at the root', definition.output.schema.required === undefined)
  check('output schema is a closed object', definition.output.schema.additionalProperties === false)
  check('render() returns content blocks', Array.isArray(definition.output.render({}, { ok: false, error: 'x', computedAt: 'now' })))

  section('execute() runs a real audit against a fake session')
  // Without an agent context the session cannot be inferred, so the id is
  // explicit here; the caller-resolution path is covered below.
  const result = await definition.execute({ sessionId: 'session-test' }, {})
  check('audit succeeded', result.ok === true, JSON.stringify(result).slice(0, 200))
  check('found 14 indicators', result.indicators?.length === 14)
  check('counts are consistent', (result.satisfiedCount ?? 0) + (result.absentCount ?? 0) + (result.notAssessableCount ?? 0) === 14)
  check('detected the artifact self-read-back', (result.metrics?.selfReadbacks ?? 0) >= 1)
  check('detected the compaction event', (result.metrics?.compactions ?? 0) >= 1)
  check('level is within 1-5', result.level >= 1 && result.level <= 5, `got ${result.level}`)
  check('carries the source citation', String(result.rubricSource).includes('2308.08708'))

  section('execute() reports a missing session instead of throwing')
  const missing = await defineSentienceAuditTool({ sessions: { get: () => undefined } }).execute({ sessionId: 'nope' }, {})
  check('returns ok:false with a teaching error', missing.ok === false && String(missing.error).includes('session not live'))

  section('execute() with neither an id nor an agent explains the requirement')
  const unscoped = await definition.execute({}, {})
  check('asks for a session instead of guessing', unscoped.ok === false && String(unscoped.error).includes('no session in scope'))

  section('execute() resolves the session from the executing agent')
  const viaAgent = await definition.execute({}, { agent: { id: 'session-from-agent' } })
  check('audits the agent\'s own session', viaAgent.ok === true && viaAgent.metrics?.sessionId === 'session-from-agent')
}

section('plugin entry shape')
check('exports a plugin name', typeof (await import('../lib/index.js')).name === 'string')
check('declares the sessions injection', JSON.stringify((await import('../lib/index.js')).inject) === '["sessions"]')
check('apply is callable', typeof apply === 'function')

section('apply() registers through the tool registry')
let registered
const disposer = () => {}
const fakeCtx = {
  sessions: { get: () => fakeSession(SAMPLE_EVENTS) },
  get: (key) => (key === 'tools' ? { register: (def) => { registered = def; return disposer } } : undefined),
}
apply(fakeCtx)
check('registered exactly one tool', registered?.name === 'sentience_audit')

section('apply() degrades when the deployment has no tool registry')
let threw = false
try {
  apply({ sessions: { get: () => undefined }, get: () => undefined })
} catch {
  threw = true
}
check('does not throw without a registry', threw === false)

section('client bundle carries the slot contract')
{
  // The bundle cannot be imported here (it needs React and the DSH client
  // runtime), so assert on the built artifact instead: the pieces the client
  // loader depends on must be present in what actually ships.
  const { readFileSync } = await import('node:fs')
  let built = ''
  try {
    built = readFileSync(new URL('../lib/client/index.js', import.meta.url), 'utf8')
    check('client bundle exists and is non-empty', built.length > 1000)
  } catch (error) {
    check('client bundle exists and is non-empty', false, error.message)
  }
  check('registers into the cordis tool-view slot', built.includes('tool.view.cordis'))
  check('binds the self key the guard requires', built.includes("\"self\"") || built.includes("'self'"))
  check('exports a client plugin name', built.includes('sentience-audit-client'))
  check('keeps react external rather than inlining it', /from ["']react["']/.test(built))
  check('imports the jsx runtime as an external', /from ["']react\/jsx-runtime["']/.test(built))
}

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
