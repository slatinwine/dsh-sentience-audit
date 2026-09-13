/**
 * The `sentience_audit` tool.
 *
 * Registered on the host's tool registry so the model can audit the trajectory
 * it is running inside. The description states the epistemic limit up front,
 * because a tool that reports an "L4" invites exactly the over-reading the
 * source report warns against.
 *
 * @module dsh-sentience-audit/host/tool
 */

import { defineTool } from '@deepseek-ai/dsh-tools'
import type { JsonValue } from '@deepseek-ai/dsh-util-values'

import { assess } from '../core/assess.ts'
import { renderMarkdown } from '../core/markdown.ts'
import type { AuditOutcome } from '../core/types.ts'
import { readSessionEvents, type AgentsLike, type SessionsLike } from './sessions.ts'

/** Tool name exposed to the model. */
export const TOOL_NAME = 'sentience_audit'

/**
 * Parameter schema. Optional properties omit `required` entirely: the DSL types
 * `required` as `true` only, so `required: false` is rejected.
 */
const PARAMETERS = {
  sessionId: {
    type: 'string',
    description: '要审计的会话 id；省略则审计当前会话。',
  },
  verbose: {
    type: 'boolean',
    description: '为 true 时返回额外的统计细节（默认 false）。',
  },
} as const

/**
 * Output schema. The value DSL has no root-level `required`, and every object
 * node must declare `additionalProperties` explicitly.
 *
 * The `as const` is load-bearing: without it every `type` widens to `string`,
 * so the literal no longer satisfies the DSL's discriminated union and
 * `InferValue` collapses the tool's return type to `never`.
 */
const OUTPUT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    ok: { type: 'boolean', description: '是否成功完成审计。' },
    error: { type: 'string', description: '失败原因（仅 ok 为 false 时存在）。' },
    level: { type: 'integer', description: 'L1-L5 等级。' },
    levelLabel: { type: 'string', description: '等级名称。' },
    levelNote: { type: 'string', description: '该等级的说明。' },
    band: { type: 'string', description: '置信带。' },
    satisfiedCount: { type: 'integer', description: '达成的指标数。' },
    absentCount: { type: 'integer', description: '缺失的指标数。' },
    notAssessableCount: { type: 'integer', description: '无法从轨迹评估的指标数。' },
    totalCount: { type: 'integer', description: '指标总数（14）。' },
    establishedFamilies: { type: 'integer', description: '已确立的指标族数（0-6）。' },
    establishedKeys: {
      type: 'array',
      items: { type: 'string' },
      description: '已确立的指标族标识。',
    },
    families: {
      type: 'array',
      description: '六个指标族的达成情况。',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          key: { type: 'string' },
          label: { type: 'string' },
          satisfied: { type: 'integer' },
          total: { type: 'integer' },
          need: { type: 'integer' },
          established: { type: 'boolean' },
        },
      },
    },
    indicators: {
      type: 'array',
      description: '14 项指标属性的逐条判定。',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          family: { type: 'string' },
          label: { type: 'string' },
          en: { type: 'string' },
          evidenceKind: { type: 'string', description: 'architectural / structural / self-report。' },
          status: { type: 'string', description: 'satisfied / absent / not-assessable。' },
          evidence: { type: 'string' },
          note: { type: 'string' },
        },
      },
    },
    metrics: {
      type: 'json',
      description: '原始轨迹结构统计。',
    },
    rubricSource: { type: 'string', description: '评分依据的论文出处。' },
    disclaimer: { type: 'string', description: '方法论限定。' },
    computedAt: { type: 'string', description: '计算时间（ISO 8601）。' },
  },
} as const

/** Host services the tool needs. */
export interface AuditToolServices {
  readonly sessions: SessionsLike
  readonly agents?: AgentsLike | undefined
}

/**
 * The wire shape the schema above infers.
 *
 * The domain interfaces in `core/types.ts` are structurally accurate but carry
 * no index signatures, while the DSL projects every node to `JsonValue`. Naming
 * the wire shape here keeps the crossing explicit and typed rather than
 * scattering `as unknown as` at each use site.
 */
interface AuditWire {
  ok?: boolean
  error?: string
  level?: number
  levelLabel?: string
  levelNote?: string
  band?: string
  satisfiedCount?: number
  absentCount?: number
  notAssessableCount?: number
  totalCount?: number
  establishedFamilies?: number
  establishedKeys?: string[]
  families?: {
    key?: string
    label?: string
    satisfied?: number
    total?: number
    need?: number
    established?: boolean
  }[]
  indicators?: {
    id?: string
    family?: string
    label?: string
    en?: string
    evidenceKind?: string
    status?: string
    evidence?: string
    note?: string
  }[]
  metrics?: JsonValue
  rubricSource?: string
  disclaimer?: string
  computedAt?: string
}

function toWire(outcome: AuditOutcome): AuditWire {
  return outcome as unknown as AuditWire
}

function toOutcome(value: AuditWire): AuditOutcome {
  return value as unknown as AuditOutcome
}

function failure(error: string): AuditWire {
  return { ok: false, error, computedAt: new Date().toISOString() }
}

/**
 * Extract the executing agent's session id from a tool run context.
 *
 * The run context is transport-facing, so its `agent` may be a full Agent or
 * only the serialized `{ id }` that crossed a wire; both are accepted.
 *
 * @param exec - the tool run context, or anything else.
 * @returns the session id, or `''` when none is available.
 */
function agentIdOf(exec: unknown): string {
  if (typeof exec !== 'object' || exec === null) return ''
  const agent = (exec as { agent?: unknown }).agent
  if (typeof agent !== 'object' || agent === null) return ''
  const id = (agent as { id?: unknown }).id
  if (typeof id === 'string') return id
  if (typeof id === 'number') return String(id)
  return ''
}

/**
 * Build the tool definition bound to one host service set.
 *
 * @param services - the host `sessions` and optional `agents` services.
 * @returns the definition to hand to `ctx.tools.register`.
 */
export function defineSentienceAuditTool(services: AuditToolServices) {
  return defineTool({
    name: TOOL_NAME,
    description:
      '按 Butlin/Long/Bengio 等 (2023)《Consciousness in Artificial Intelligence》的 14 项意识指标属性'
      + '审计一段 Harness 会话轨迹，输出 L1-L5 等级、分族得分、逐指标证据与结构统计。'
      + '只采信可复算的轨迹结构与架构事实，不把模型措辞当作证据；需要检查内部表征的指标标为“无法评估”。'
      + '该评级是意识候选资格的代理指标，不是对现象意识的测量——原报告结论为 no current AI systems are conscious。'
      + '确定性、可复算，不发起模型调用。默认审计当前会话；可用 sessionId 指定另一段实时会话。',
    parameters: PARAMETERS,
    output: {
      schema: OUTPUT_SCHEMA,
      render(_args, value) {
        return [{ type: 'text', text: renderMarkdown(toOutcome(value)) }]
      },
    },
    async execute(args, exec) {
      // The agent on whose behalf this call runs is the most reliable way to
      // find "the current session"; `agents.currentInitiator()` is the fallback
      // for callers outside an agent loop.
      const read = readSessionEvents({
        sessions: services.sessions,
        agents: services.agents,
        sessionId: args.sessionId ?? '',
        agentId: agentIdOf(exec),
      })
      if (!read.ok) return failure(read.error)
      return toWire(assess({ sessionId: read.sessionId, events: read.events }))
    },
  })
}
