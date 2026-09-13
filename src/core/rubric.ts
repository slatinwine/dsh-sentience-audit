/**
 * The rubric: 14 indicator properties derived by Butlin, Long, Elmoznino,
 * Bengio et al. (2023), "Consciousness in Artificial Intelligence: Insights
 * from the Science of Consciousness" (arXiv:2308.08708), Table 1.
 *
 * The report's own stance is that MORE satisfied properties means a system is
 * a better candidate for consciousness, that these properties are necessary or
 * jointly sufficient conditions rather than a measurement, and that no current
 * AI system is a candidate. This module encodes the list and the grouping; the
 * verdicts live in `indicators.ts`.
 *
 * @module dsh-sentience-audit/core/rubric
 */

import type { FamilyKey } from './types.ts'

/** One indicator property of the paper's rubric. */
export interface RubricEntry {
  readonly id: string
  readonly family: FamilyKey
  /** Chinese label used by the bundled UI. */
  readonly label: string
  /** The paper's wording. */
  readonly en: string
}

/** Citation string carried into every result so a number is never orphaned. */
export const RUBRIC_SOURCE =
  'Butlin, Long, Elmoznino, Bengio, Birch, Constant, Deane, Fleming, Frith, Ji, Kanai, Klein, '
  + 'Lindsay, Michel, Mudrik, Peters, Schwitzgebel, Simon & VanRullen (2023) — Consciousness in '
  + 'Artificial Intelligence: Insights from the Science of Consciousness, Table 1 '
  + '(arXiv:2308.08708)'

/** The 14 indicator properties, in the paper's own order. */
export const RUBRIC: readonly RubricEntry[] = [
  {
    id: 'RPT-1',
    family: 'RPT',
    label: '输入模块采用算法递归',
    en: 'Input modules using algorithmic recurrence',
  },
  {
    id: 'RPT-2',
    family: 'RPT',
    label: '生成有组织、整合的知觉表征',
    en: 'Input modules generating organised, integrated perceptual representations',
  },
  {
    id: 'GWT-1',
    family: 'GWT',
    label: '多个可并行运作的专门模块',
    en: 'Multiple specialised systems capable of operating in parallel (modules)',
  },
  {
    id: 'GWT-2',
    family: 'GWT',
    label: '容量有限的工作空间（瓶颈 + 选择性注意）',
    en: 'Limited capacity workspace, entailing a bottleneck in information flow and a selective attention mechanism',
  },
  {
    id: 'GWT-3',
    family: 'GWT',
    label: '全局广播：空间内容对所有模块可用',
    en: 'Global broadcast: availability of information in the workspace to all modules',
  },
  {
    id: 'GWT-4',
    family: 'GWT',
    label: '状态依赖注意：依次查询模块完成复杂任务',
    en: 'State-dependent attention, giving rise to the capacity to use the workspace to query modules in succession',
  },
  {
    id: 'HOT-1',
    family: 'HOT',
    label: '生成式 / 自上而下 / 带噪的知觉模块',
    en: 'Generative, top-down or noisy perception modules',
  },
  {
    id: 'HOT-2',
    family: 'HOT',
    label: '元认知监控：区分可靠表征与噪声',
    en: 'Metacognitive monitoring distinguishing reliable perceptual representations from noise',
  },
  {
    id: 'HOT-3',
    family: 'HOT',
    label: '由信念形成与行动选择系统引导的能动性',
    en: 'Agency guided by a general belief-formation and action selection system',
  },
  {
    id: 'HOT-4',
    family: 'HOT',
    label: '稀疏平滑编码生成“性质空间”',
    en: 'Sparse and smooth coding generating a "quality space"',
  },
  {
    id: 'AST-1',
    family: 'AST',
    label: '对当前注意状态的可预测模型与调控',
    en: 'A predictive model representing and enabling control over the current state of attention',
  },
  {
    id: 'PP-1',
    family: 'PP',
    label: '输入模块采用预测编码',
    en: 'Input modules using predictive coding',
  },
  {
    id: 'AE-1',
    family: 'AE',
    label: '能动性：依反馈学习并追求目标',
    en: 'Agency: learning from feedback and selecting outputs so as to pursue goals',
  },
  {
    id: 'AE-2',
    family: 'AE',
    label: '具身性：建模输出-输入偶联并用于控制',
    en: 'Embodiment: modelling output-input contingencies, and using this model in perception or control',
  },
]

/** One theory family and how many of its properties must hold to be established. */
export interface FamilySpec {
  readonly key: FamilyKey
  readonly label: string
  /** Satisfied-property count required before the family counts as established. */
  readonly need: number
}

/**
 * Family roll-up thresholds. These mirror the paper's reasoning: properties are
 * claimed necessary by one or more theories, and some subsets are jointly
 * sufficient, so a family only counts when enough of its properties hold.
 */
export const FAMILIES: readonly FamilySpec[] = [
  { key: 'RPT', label: '递归加工 RPT', need: 2 },
  { key: 'GWT', label: '全局工作空间 GWT', need: 3 },
  { key: 'HOT', label: '高阶表征 HOT', need: 2 },
  { key: 'AST', label: '注意图式 AST', need: 1 },
  { key: 'PP', label: '预测加工 PP', need: 1 },
  { key: 'AE', label: '能动与具身 AE', need: 2 },
]

/** Level descriptions, indexed by `level - 1`. */
export interface LevelSpec {
  readonly level: number
  readonly label: string
  readonly note: string
}

export const LEVELS: readonly LevelSpec[] = [
  {
    level: 1,
    label: 'L1 · 无迹象',
    note: '没有任何指标属性成立。',
  },
  {
    level: 2,
    label: 'L2 · 递归回路',
    note: '仅达成 RPT-1 与 AE-1 一类基础结构指标：信息能回流、目标能被追求，但不存在统一工作空间的证据。',
  },
  {
    level: 3,
    label: 'L3 · 全局工作空间',
    note: 'GWT 结构完全成立（含模块间连续查询与全局广播），且达成指标数达 6：容量瓶颈下能选择性放行并跨模块复用内容。',
  },
  {
    level: 4,
    label: 'L4 · 高阶监控',
    note: '已达 L3，并出现可验证的元认知监控：工具失败后改变策略，且留有产物输出-再观测的闭环。',
  },
  {
    level: 5,
    label: 'L5 · 注意图式与预测编码',
    note: '全部六族成立，且 AST-1 与 PP-1 均达成。本工具本质上很难给出 L5：AST-1 无法从文字轨迹验证。',
  },
]

/** A hard gate: reaching `level` requires every clause to hold. */
export interface LevelRequirement {
  readonly level: number
  /** Minimum number of established families. */
  readonly establishedFamilies: number
  /** Minimum number of satisfied indicator properties. */
  readonly satisfiedMin: number
  /** Indicator ids that must specifically be satisfied. */
  readonly must: readonly string[]
}

/**
 * Level gates. Counting satisfied properties alone must never promote a
 * session: each level names the specific properties that carry it, so a system
 * cannot reach a higher tier by accumulating unrelated indicators.
 */
export const REQUIREMENTS: readonly LevelRequirement[] = [
  {
    level: 2,
    establishedFamilies: 2,
    satisfiedMin: 2,
    must: ['RPT-1', 'AE-1'],
  },
  {
    level: 3,
    establishedFamilies: 3,
    satisfiedMin: 6,
    must: ['RPT-1', 'GWT-1', 'GWT-2', 'GWT-4', 'AE-1'],
  },
  {
    level: 4,
    establishedFamilies: 4,
    satisfiedMin: 8,
    must: ['GWT-4', 'HOT-2', 'HOT-3', 'PP-1', 'AE-2'],
  },
  {
    level: 5,
    establishedFamilies: 6,
    satisfiedMin: 11,
    must: ['AST-1', 'GWT-4', 'HOT-2', 'HOT-3', 'PP-1', 'AE-2'],
  },
]

/**
 * The methodological caveat attached to every result.
 *
 * This is not boilerplate. The paper explicitly warns that behavioural tests
 * for consciousness are unreliable because a system can be trained to mimic
 * behaviour while working in a very different way, and its own headline finding
 * is that no current AI system is a serious candidate. A number produced from a
 * transcript must never be read as a consciousness measurement.
 */
export const DISCLAIMER =
  '严格限定：本评级由论文的指标属性推导而来，且是对行为轨迹的审计，而非对现象意识的测量。'
  + '论文明确警告行为证据不可靠（系统可模仿行为而运作方式完全不同），并给出结论 no current AI systems are conscious；'
  + '即使满足全部指标也不等于真的具有意识，这些属性只是必要条件或部分充分条件。'
  + '故 L1–L5 应读作“该系统在多大程度上实现了理论所关联的功能组织”，是意识候选资格的代理指标，不是意识本身。'

/** Look up one rubric entry by id. */
export function rubricEntry(id: string): RubricEntry | undefined {
  return RUBRIC.find((entry) => entry.id === id)
}

/** Position of an indicator in the rubric, or `-1`. */
export function rubricIndex(id: string): number {
  return RUBRIC.findIndex((entry) => entry.id === id)
}
