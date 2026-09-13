/**
 * Markdown projection of an audit result.
 *
 * Lives in `core` so the host tool's model-facing content and any other surface
 * can render the same text. The client half renders its own richer view from the
 * structured result instead of parsing this.
 *
 * @module dsh-sentience-audit/core/markdown
 */

import type { AuditOutcome, IndicatorStatus } from './types.ts'

const EVIDENCE_LABEL: Record<string, string> = {
  architectural: '架构既定',
  structural: '轨迹结构',
  'self-report': '自我报告',
}

const STATUS_LABEL: Record<IndicatorStatus, string> = {
  satisfied: '达成',
  absent: '缺失',
  'not-assessable': '无法评估',
}

function cell(text: string): string {
  return text.replace(/\|/g, '/')
}

/**
 * Render one audit outcome as markdown.
 *
 * @param outcome - the result to render.
 * @returns the model-facing markdown text.
 */
export function renderMarkdown(outcome: AuditOutcome): string {
  if (outcome.ok === false) {
    return `意识指标审计失败：${outcome.error}`
  }

  const lines: string[] = []
  lines.push(`## 意识指标审计 · ${outcome.levelLabel}`)
  lines.push(
    `达成 ${outcome.satisfiedCount} · 无法评估 ${outcome.notAssessableCount} · 缺失 ${outcome.absentCount}`
    + ` · 指标族 ${outcome.establishedFamilies}/6 · 置信带 ${outcome.band}`,
  )
  lines.push(outcome.levelNote)
  lines.push('')

  const familyCells = outcome.families.map(
    (family) =>
      `${family.label} ${family.satisfied}/${family.total}${family.established ? ' OK' : ' --'}`,
  )
  lines.push(`**指标族** ${familyCells.join(' · ')}`)
  lines.push('')

  lines.push('| 指标 | 判定 | 证据类型 | 轨迹证据 / 原因 |')
  lines.push('| --- | --- | --- | --- |')
  for (const indicator of outcome.indicators) {
    const kind = EVIDENCE_LABEL[indicator.evidenceKind] ?? indicator.evidenceKind
    const detail = indicator.status === 'satisfied' ? indicator.evidence : indicator.note
    lines.push(
      `| ${indicator.id} ${indicator.label} | ${STATUS_LABEL[indicator.status]} | ${kind} | ${cell(detail)} |`,
    )
  }
  lines.push('')

  const m = outcome.metrics
  lines.push(
    `**统计** 轮次 ${m.turns} · 轮内步 ${m.steps} · 工具调用 ${m.toolCalls}（${m.distinctTools} 种）`
    + ` · 累计上下文 ${m.contextTokens}`,
  )
  lines.push(
    `**结构** 模块切换 ${m.moduleSuccessions} · 依赖链 ${m.dependentCalls}`
    + ` · 错误恢复 ${m.recoveries}/${m.toolErrors} · 产物回流 ${m.artifactReuse}/${m.artifacts}`
    + ` · 自读回 ${m.selfReadbacks} · 注入观测 ${m.injectionLoops}`
    + ` · 计划 ${m.plans} · 目标 ${m.goals} · 压缩 ${m.compactions}`,
  )
  lines.push('')
  lines.push(`> ${outcome.disclaimer}`)
  lines.push(`> 依据：${outcome.rubricSource}`)
  return lines.join('\n')
}
