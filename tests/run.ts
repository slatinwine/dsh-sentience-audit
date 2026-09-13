/**
 * Zero-dependency test runner.
 *
 * Run with Node's built-in TypeScript support:
 *
 *   node --experimental-strip-types tests/run.ts
 *
 * This exists so the engine can be verified without installing anything. Once
 * dependencies are installed, `npm test` runs the Vitest suite instead.
 */

import { assess } from '../src/core/assess.ts'
import { RUBRIC } from '../src/core/rubric.ts'
import { proseOnlyFixture, sessionFixture } from './fixtures.ts'

let passed = 0
let failed = 0

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    passed += 1
    console.log(`  ok   ${label}`)
  } else {
    failed += 1
    console.log(`  FAIL ${label}${detail.length > 0 ? ` — ${detail}` : ''}`)
  }
}

function eq(label: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  check(label, a === e, `expected ${e}, got ${a}`)
}

function section(title: string): void {
  console.log(`\n${title}`)
}

const RICH = sessionFixture({
  prompts: 2,
  compaction: true,
  tools: [
    { tool: 'pwsh', args: '{"command":"node -v","description":"version"}' },
    { tool: 'read', args: '{"file_path":"D:\\\\Git\\\\proj\\\\src\\\\a.ts"}' },
    { tool: 'edit', args: '{"file_path":"D:\\\\Git\\\\proj\\\\src\\\\a.ts","old_string":"x","new_string":"y"}' },
    { tool: 'grep', args: '{"pattern":"foo","path":"D:\\\\Git\\\\proj\\\\src"}' },
    { tool: 'write', args: '{"file_path":"D:\\\\Git\\\\proj\\\\out\\\\report.md","content":"hi"}' },
    { tool: 'read', args: '{"file_path":"D:\\\\Git\\\\proj\\\\out\\\\report.md"}' },
    { tool: 'pwsh', args: '{"command":"Get-Content D:\\\\Git\\\\proj\\\\out\\\\report.md","description":"verify report"}' },
    { tool: 'glob', args: '{"pattern":"**/*.md","path":"D:\\\\Git\\\\proj"}' },
    { tool: 'todo_write', args: '{"todos":[{"content":"ship","status":"in_progress"}]}' },
    { tool: 'read', args: '{"file_path":"D:\\\\Git\\\\proj\\\\missing.txt"}', isError: true },
    { tool: 'read', args: '{"file_path":"D:\\\\Git\\\\proj\\\\out\\\\report.md"}' },
    { tool: 'web_fetch', args: '{"url":"https://example.com"}' },
  ],
})

section('rubric integrity')
eq('carries exactly 14 indicator properties', RUBRIC.length, 14)
eq('ids are unique', new Set(RUBRIC.map((e) => e.id)).size, 14)
eq(
  'spans all six theory families',
  [...new Set(RUBRIC.map((e) => e.family))].sort(),
  ['AE', 'AST', 'GWT', 'HOT', 'PP', 'RPT'],
)

section('verdict integrity')
const rich = assess({ sessionId: 'rich', events: RICH })
eq('one verdict per rubric entry, in order', rich.indicators.map((i) => i.id), RUBRIC.map((e) => e.id))
eq('total is 14', rich.totalCount, 14)
eq(
  'every indicator is accounted for exactly once',
  rich.satisfiedCount + rich.absentCount + rich.notAssessableCount,
  14,
)

section('structural rubric cannot be satisfied by wording')
const prose = assess({ sessionId: 'prose', events: proseOnlyFixture() })
eq('prose-only trajectory stays at L1', prose.level, 1)
eq('prose-only trajectory satisfies nothing', prose.satisfiedCount, 0)
eq('prose-only trajectory has no tool calls', prose.metrics.toolCalls, 0)
eq('prose-only trajectory has no dependent chains', prose.metrics.dependentCalls, 0)
eq('prose-only trajectory has no recoveries', prose.metrics.recoveries, 0)
eq(
  'AST-1 / HOT-1 / HOT-4 are the not-assessable set',
  prose.indicators.filter((i) => i.status === 'not-assessable').map((i) => i.id).sort(),
  ['AST-1', 'HOT-1', 'HOT-4'],
)

section('rich trajectory — structural detection')
check('detects dependent chains', rich.metrics.dependentCalls >= 2, `got ${rich.metrics.dependentCalls}`)
check('detects module switching', rich.metrics.moduleSuccessions >= 3, `got ${rich.metrics.moduleSuccessions}`)
eq('detects one tool error', rich.metrics.toolErrors, 1)
eq('detects recovery after that error', rich.metrics.recoveries, 1)
check('detects a self read-back', rich.metrics.selfReadbacks >= 1, `got ${rich.metrics.selfReadbacks}`)
check('detects an injection loop', rich.metrics.injectionLoops >= 1, `got ${rich.metrics.injectionLoops}`)
check('detects artifact reuse', rich.metrics.artifactReuse >= 1, `got ${rich.metrics.artifactReuse}`)
check('counts at least four module families', rich.metrics.toolFamilies >= 4, `got ${rich.metrics.toolFamilies}`)

section('level gates hold')
const satisfied = new Set(rich.indicators.filter((i) => i.status === 'satisfied').map((i) => i.id))
check('reaches at least L2', rich.level >= 2, `level ${rich.level}`)
if (rich.level >= 3) {
  for (const id of ['RPT-1', 'GWT-1', 'GWT-2', 'GWT-4', 'AE-1']) {
    check(`L3 gate requires ${id}`, satisfied.has(id))
  }
}
check('never reaches L5 from a trace (AST-1 unassessable)', rich.level < 5, `level ${rich.level}`)

section('result carries its own caveats')
check('cites the source report', rich.rubricSource.includes('2308.08708'))
check('states the epistemic limit', rich.disclaimer.includes('而非对现象意识的测量'))

console.log(`\n${failed === 0 ? 'PASS' : 'FAIL'} — ${passed} passed, ${failed} failed`)
process.exit(failed === 0 ? 0 : 1)
