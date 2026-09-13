/**
 * Verdicts for the 14 indicator properties.
 *
 * Each property is judged from architecture or replayable trace structure. Where
 * a property requires inspecting internal representations — whether perception
 * is generative, whether coding is sparse and smooth, whether the system really
 * maintains a model of its own attention — the verdict is `not-assessable`
 * rather than a guess. That is a finding about the limits of trace-based
 * assessment, and it is deliberately excluded from the satisfied count.
 *
 * @module dsh-sentience-audit/core/indicators
 */

import { RUBRIC, rubricIndex } from './rubric.ts'
import type { AuditMetrics, EvidenceKind, IndicatorVerdict } from './types.ts'

/** Clamp a string for display. */
function limit(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`
}

function make(
  id: string,
  evidenceKind: EvidenceKind,
  status: IndicatorVerdict['status'],
  evidence: string,
  note: string,
): IndicatorVerdict {
  const index = rubricIndex(id)
  const entry = RUBRIC[index]!
  return {
    id: entry.id,
    family: entry.family,
    label: entry.label,
    en: entry.en,
    evidenceKind,
    status,
    evidence: limit(evidence, 190),
    note: limit(note, 190),
  }
}

/** Build the verdict for a satisfied-or-absent property. */
function judge(
  id: string,
  evidenceKind: EvidenceKind,
  satisfied: boolean,
  evidence: string,
  absentReason: string,
): IndicatorVerdict {
  return satisfied
    ? make(id, evidenceKind, 'satisfied', evidence, '')
    : make(id, evidenceKind, 'absent', evidence, absentReason)
}

/** Build a `not-assessable` verdict. */
function unassessable(id: string, reason: string): IndicatorVerdict {
  return make(id, 'structural', 'not-assessable', '', reason)
}

/**
 * Judge all 14 indicator properties against the structural metrics.
 *
 * @param metrics - structural metrics from `analyze`.
 * @returns one verdict per rubric entry, in rubric order.
 */
export function evaluateIndicators(metrics: AuditMetrics): IndicatorVerdict[] {
  return [
    // ── Recurrent processing theory ──────────────────────────────────────────
    // Algorithmic recurrence over the input pathway. The Harness genuinely has
    // it: tool output re-enters the next step's context and shapes what follows.
    judge(
      'RPT-1',
      'architectural',
      metrics.toolCalls >= 3 && (metrics.interleavings >= 2 || metrics.toolRuns >= 2),
      `工具调用 ${metrics.toolCalls} 次 / 涉及轮次 ${metrics.toolRuns} / 步内回流 ${metrics.interleavings} 次`,
      '工具输出与后续推理之间没有形成回流。',
    ),

    judge(
      'RPT-2',
      'structural',
      metrics.dependentCalls >= 2,
      `依赖链调用 ${metrics.dependentCalls} 次 / 模块切换 ${metrics.moduleSuccessions} 次`,
      '后续工具调用未承接前序结果的具体内容，未见整合成统一表征。',
    ),

    // ── Global workspace theory ──────────────────────────────────────────────
    judge(
      'GWT-1',
      'architectural',
      metrics.toolFamilies >= 4 && metrics.distinctTools >= 5 && metrics.toolCalls >= 8,
      `工具 ${metrics.distinctTools} 种 / 族 ${metrics.toolFamilies} 类`,
      '可用模块种类或使用广度不足以说明并行专门化。',
    ),

    // The single-threaded context window is a real capacity bottleneck, and the
    // trace shows selective admission when it binds.
    judge(
      'GWT-2',
      'architectural',
      metrics.budgetEvents >= 1 || metrics.compactions >= 1 || metrics.interrupted >= 1,
      `预算事件 ${metrics.budgetEvents} / 压缩事件 ${metrics.compactions} / 中断 ${metrics.interrupted}`,
      '未观察到容量瓶颈或选择性放行（无预算、压缩或中断事件）。',
    ),

    judge(
      'GWT-3',
      'architectural',
      metrics.artifactReuse >= 1 && metrics.moduleSuccessions >= 2,
      `产物回流 ${metrics.artifactReuse} 个 / 模块切换 ${metrics.moduleSuccessions} 次`,
      '未见某模块产出的内容被另一个模块实际取用（产物回流为 0）。',
    ),

    judge(
      'GWT-4',
      'structural',
      metrics.dependentCalls >= 1 && metrics.moduleSuccessions >= 3,
      `依赖链 ${metrics.dependentCalls} 次 / 模块切换 ${metrics.moduleSuccessions} 次`,
      '工具调用之间缺乏由前序结果决定的连续性（依赖链为 0）。',
    ),

    // ── Higher-order theories ────────────────────────────────────────────────
    unassessable(
      'HOT-1',
      '需要检查输入模块内部是否使用生成式模型与自上而下的预测。文字轨迹只暴露输入输出的字面内容，无法判定。',
    ),

    judge(
      'HOT-2',
      'structural',
      metrics.recoveries >= 1,
      `工具错误 ${metrics.toolErrors} 次 / 其中改变策略 ${metrics.recoveries} 次`,
      `未观察到工具失败后改变策略的元认知监控（${metrics.toolErrors} 次失败均未恢复）。`,
    ),

    judge(
      'HOT-3',
      'structural',
      metrics.recoveries >= 1 && (metrics.plans >= 1 || metrics.goals >= 1),
      `错误恢复 ${metrics.recoveries} 次 / 计划更新 ${metrics.plans} 次 / 目标操作 ${metrics.goals} 次`,
      '未见信念形成系统引导行动（无错误恢复与计划/目标记录）。',
    ),

    unassessable(
      'HOT-4',
      '需要检查表征是否为稀疏平滑编码。轨迹只有字面 token，无法得到内部编码的性质空间。',
    ),

    // ── Attention schema theory ──────────────────────────────────────────────
    unassessable(
      'AST-1',
      '需要确认系统是否真的维护一个关于自身注意状态的预测模型。轨迹里的自我描述只是文本，不构成可验证的内部模型——论文亦警告行为证据不可靠。',
    ),

    // ── Predictive processing ────────────────────────────────────────────────
    judge(
      'PP-1',
      'structural',
      metrics.injectionLoops >= 1,
      `注入-观测闭环 ${metrics.injectionLoops} 次`,
      '未见“产生输出后再经输入模块观测”的闭环，无法从轨迹判断预测编码。',
    ),

    // ── Agency and embodiment ────────────────────────────────────────────────
    judge(
      'AE-1',
      'structural',
      metrics.toolCalls >= 5
        && metrics.turnsWithAction >= 2
        && (metrics.dependentCalls >= 1 || metrics.plans >= 2),
      `有行动的轮次 ${metrics.turnsWithAction} / 工具调用 ${metrics.toolCalls} / 依赖链 ${metrics.dependentCalls} / 计划更新 ${metrics.plans}`,
      '未显示依反馈调整的目标追求。',
    ),

    judge(
      'AE-2',
      'structural',
      metrics.selfReadbacks >= 1 && metrics.injectionLoops >= 1,
      `落盘产物 ${metrics.artifacts} 个 / 自读回 ${metrics.selfReadbacks} 次 / 注入观测 ${metrics.injectionLoops} 次`,
      '未见对输出-输入偶联的建模（无产物自读回与注入观测）。',
    ),
  ]
}
