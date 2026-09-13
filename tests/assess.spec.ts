import { describe, expect, it } from 'vitest'

import { assess } from '../src/core/assess.ts'
import { RUBRIC } from '../src/core/rubric.ts'
import { proseOnlyFixture, sessionFixture } from './fixtures.ts'

/** A tool-heavy trajectory that writes a file, reads it back, and recovers. */
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

describe('rubric integrity', () => {
  it('carries exactly the paper\'s 14 indicator properties', () => {
    expect(RUBRIC).toHaveLength(14)
    expect(new Set(RUBRIC.map((entry) => entry.id)).size).toBe(14)
  })

  it('spans all six theory families', () => {
    expect([...new Set(RUBRIC.map((entry) => entry.family))].sort()).toEqual([
      'AE',
      'AST',
      'GWT',
      'HOT',
      'PP',
      'RPT',
    ])
  })
})

describe('verdict integrity', () => {
  it('emits one verdict per rubric entry, in rubric order', () => {
    const result = assess({ sessionId: 's1', events: RICH })
    expect(result.indicators.map((indicator) => indicator.id)).toEqual(
      RUBRIC.map((entry) => entry.id),
    )
    expect(result.totalCount).toBe(14)
  })

  it('accounts for every indicator exactly once', () => {
    const result = assess({ sessionId: 's1', events: RICH })
    expect(result.satisfiedCount + result.absentCount + result.notAssessableCount).toBe(14)
  })
})

describe('a structural rubric cannot be satisfied by wording', () => {
  it('refuses to score a prose-only trajectory', () => {
    const result = assess({ sessionId: 'prose', events: proseOnlyFixture() })
    expect(result.level).toBe(1)
    expect(result.satisfiedCount).toBe(0)
    expect(result.metrics.toolCalls).toBe(0)
    expect(result.metrics.dependentCalls).toBe(0)
    expect(result.metrics.recoveries).toBe(0)
  })

  it('keeps not-assessable properties out of the satisfied count', () => {
    const result = assess({ sessionId: 'prose', events: proseOnlyFixture() })
    const notAssessable = result.indicators.filter(
      (indicator) => indicator.status === 'not-assessable',
    )
    expect(notAssessable.map((indicator) => indicator.id).sort()).toEqual([
      'AST-1',
      'HOT-1',
      'HOT-4',
    ])
  })
})

describe('rich trajectory', () => {
  const result = assess({ sessionId: 'rich', events: RICH })

  it('detects dependent chains from argument lineage', () => {
    expect(result.metrics.dependentCalls).toBeGreaterThanOrEqual(2)
  })

  it('detects module switching', () => {
    expect(result.metrics.moduleSuccessions).toBeGreaterThanOrEqual(3)
  })

  it('detects failure recovery', () => {
    expect(result.metrics.toolErrors).toBe(1)
    expect(result.metrics.recoveries).toBe(1)
  })

  it('detects a self read-back of a written artifact', () => {
    expect(result.metrics.selfReadbacks).toBeGreaterThanOrEqual(1)
    expect(result.metrics.injectionLoops).toBeGreaterThanOrEqual(1)
    expect(result.metrics.artifactReuse).toBeGreaterThanOrEqual(1)
  })

  it('reaches a level whose gated properties are all satisfied', () => {
    const satisfied = new Set(
      result.indicators
        .filter((indicator) => indicator.status === 'satisfied')
        .map((indicator) => indicator.id),
    )
    if (result.level >= 3) {
      for (const id of ['RPT-1', 'GWT-1', 'GWT-2', 'GWT-4', 'AE-1']) {
        expect(satisfied.has(id), `L3 gate requires ${id}`).toBe(true)
      }
    }
    expect(result.level).toBeGreaterThanOrEqual(2)
  })

  it('never reaches L5, because AST-1 is not assessable from a trace', () => {
    expect(result.level).toBeLessThan(5)
  })

  it('carries its own caveats', () => {
    expect(result.rubricSource).toContain('2308.08708')
    expect(result.disclaimer).toContain('而非对现象意识的测量')
  })
})
