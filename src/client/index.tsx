/**
 * Client half: the audit panel rendered inside the `sentience_audit` tool card.
 *
 * Registered in `tool.call.toolview` with the tool's name as the key — the slot
 * static client plugins use to customize how their own tools render (the same
 * contract `@deepseek-ai/dsh-client-ui-deliverables` uses for its `present`
 * tool). `tool.view.cordis` would be wrong here: that slot belongs to the
 * dynamic-package `cordis_run` card, which a static bundle plugin never
 * produces.
 *
 * The panel never reimplements the rubric: it renders the tool's own result.
 * The host half appends a fenced ```sentience-audit-data JSON block to the
 * result it returns; this panel parses that block out of `block.content`, so
 * the browser view and the model-facing output are the same payload and can
 * never disagree. A static client bundle has no `host` bridge, no `styles`
 * helper and no remote channel — those names exist only inside dynamic
 * (`cordis_define`) browser halves — so styles are injected as a plain
 * `<style>` tag and no host call is made.
 *
 * @module dsh-sentience-audit/client
 */

import type { ReactElement } from 'react'

import type { AuditOutcome } from '../core/types.ts'

/** Structural view of the client slot registry (avoids a hard DSH type dep). */
interface SlotsService {
  inject(name: string, callback: () => unknown): unknown
  register(
    options: { name: string; key?: string },
    render: (props: ToolViewProps) => ReactElement,
  ): unknown
}

/** Cordis client context shape this plugin uses. */
interface ClientContext {
  slots: SlotsService
}

/** One content item of a settled tool-result block. */
interface ToolContentItem {
  type?: string
  text?: string
}

/** Props the tool-call view slot hands a registered row. */
interface ToolViewProps {
  /** Present on settled calls; running calls carry raw args instead. */
  block?: {
    content?: ToolContentItem[]
    isError?: boolean
    error?: { message?: string; name?: string } | null
  }
}

/** The tool whose card this panel customizes. Must match `host/tool.ts`. */
const TOOL_NAME = 'sentience_audit'

/** Fence the host half wraps the machine-readable result in. */
const DATA_FENCE = '```sentience-audit-data'

/** Tag for the injected stylesheet, namespaced per package. */
const CSS_TAG = '@slatinwine/dsh-sentience-audit/panel.css'

const LEVEL_TONES: readonly string[] = ['#8a8f98', '#5b8def', '#3f9e7a', '#c08a2e', '#a855f7']

const EVIDENCE_LABEL: Record<string, string> = {
  architectural: '架构既定',
  structural: '轨迹结构',
  'self-report': '自我报告',
}

const CSS = `
.sa-panel{font-size:12px;line-height:1.55;color:var(--dsh-text-primary,#e6e6e6);display:flex;flex-direction:column;gap:10px}
.sa-head{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap}
.sa-badge{font-weight:700;font-size:13px;padding:1px 8px;border-radius:6px;color:#fff}
.sa-sub{opacity:.75}
.sa-fam{display:flex;gap:6px;flex-wrap:wrap}
.sa-chip{border:1px solid var(--dsh-border-subtle,rgba(127,127,127,.35));border-radius:999px;padding:1px 7px;white-space:nowrap}
.sa-chip-on{border-color:#3f9e7a;color:#3f9e7a}
.sa-table{width:100%;border-collapse:collapse}
.sa-table th,.sa-table td{text-align:left;padding:3px 6px;border-bottom:1px solid var(--dsh-border-subtle,rgba(127,127,127,.2));vertical-align:top}
.sa-yes{color:#3f9e7a;font-weight:600}
.sa-no{opacity:.55}
.sa-na{color:#c08a2e}
.sa-kind{opacity:.7;white-space:nowrap}
.sa-note{opacity:.62;font-size:11px}
.sa-err{color:#e5534b}
.sa-raw{white-space:pre-wrap;word-break:break-word;opacity:.8}
`

/** Stable Cordis plugin name (client half). */
export const name = 'sentience-audit-client'

/** Services this client plugin requires from the page context. */
export const inject = ['slots']

/** Insert the panel stylesheet once, following the platform's tag convention. */
function insertStyles(): void {
  if (typeof document === 'undefined') return
  if (document.querySelector(`style[data-plugin-css="${CSS_TAG}"]`) !== null) return
  const tag = document.createElement('style')
  tag.dataset.plugin = '@slatinwine/dsh-sentience-audit'
  tag.dataset.pluginCss = CSS_TAG
  tag.textContent = CSS
  document.head.appendChild(tag)
}

/** Pull the fenced JSON payload the host half appends to its result. */
function extractPayload(block: ToolViewProps['block']): AuditOutcome | null {
  const content = block?.content
  if (!Array.isArray(content)) return null
  const text = content
    .map((item) => (typeof item === 'string' ? item : (item?.text ?? '')))
    .join('\n')
  const start = text.indexOf(DATA_FENCE)
  if (start === -1) return null
  const from = text.indexOf('\n', start)
  if (from === -1) return null
  const end = text.indexOf('\n```', from)
  if (end === -1) return null
  try {
    const value: unknown = JSON.parse(text.slice(from + 1, end))
    if (value === null || typeof value !== 'object') return null
    return value as AuditOutcome
  } catch {
    return null
  }
}

/** Plain text of the tool result, for the no-payload fallback. */
function contentText(block: ToolViewProps['block']): string {
  const content = block?.content
  if (!Array.isArray(content)) return ''
  return content
    .map((item) => (typeof item === 'string' ? item : (item?.text ?? '')))
    .join('\n')
}

/**
 * Register the panel.
 *
 * @param ctx - the client Cordis context.
 */
export function apply(ctx: ClientContext): void {
  insertStyles()
  ctx.slots.inject('tool.call.toolview', () =>
    ctx.slots.register({ name: 'tool.call.toolview', key: TOOL_NAME }, AuditRow),
  )
}

/** Render the panel body for one `sentience_audit` tool call. */
function AuditRow(props: ToolViewProps): ReactElement {
  const { block } = props

  // Running calls carry args rather than a settled `kind`-tagged block.
  if (block === undefined || !('content' in (block as object))) {
    return (
      <div className="sa-panel">
        <div className="sa-note">正在读取会话轨迹并复算 14 项指标…</div>
      </div>
    )
  }

  if (block.isError) {
    const message = block.error?.message ?? '审计失败'
    return (
      <div className="sa-panel">
        <div className="sa-err">{message}</div>
      </div>
    )
  }

  const data = extractPayload(block)
  if (data === null) {
    // Older tool results without the fenced payload still show their text.
    return (
      <div className="sa-panel">
        <div className="sa-note">未找到结构化审计数据，显示原始结果：</div>
        <div className="sa-raw">{contentText(block)}</div>
      </div>
    )
  }

  return <AuditReport data={data} />
}

/** Render one completed audit. */
function AuditReport(props: { data: AuditOutcome }): ReactElement {
  const { data } = props
  if (data.ok === false) return <div className="sa-err">{data.error}</div>

  const tone = LEVEL_TONES[Math.min(4, Math.max(0, data.level - 1))] ?? LEVEL_TONES[0]

  return (
    <div className="sa-panel">
      <div className="sa-head">
        <span>意识指标审计</span>
        <span className="sa-badge" style={{ background: tone }}>
          {data.levelLabel}
        </span>
        <span className="sa-sub">
          达成 {data.satisfiedCount} · 无法评估 {data.notAssessableCount} · 缺失 {data.absentCount}
          {` · 指标族 ${data.establishedFamilies}/6`}
        </span>
      </div>

      <div className="sa-note">{data.levelNote}</div>

      <div className="sa-fam">
        {data.families.map((family) => (
          <span
            key={family.key}
            className={family.established ? 'sa-chip sa-chip-on' : 'sa-chip'}
          >
            {`${family.label} ${family.satisfied}/${family.total}`}
          </span>
        ))}
      </div>

      <table className="sa-table">
        <tbody>
          <tr>
            <th>指标</th>
            <th>判定</th>
            <th>证据类型</th>
            <th>轨迹证据 / 原因</th>
          </tr>
          {data.indicators.map((indicator) => {
            const satisfied = indicator.status === 'satisfied'
            const na = indicator.status === 'not-assessable'
            const className = satisfied ? 'sa-yes' : na ? 'sa-na' : 'sa-no'
            const label = satisfied ? '✔ 达成' : na ? '— 无法评估' : '✘ 缺失'
            return (
              <tr key={indicator.id}>
                <td>{`${indicator.id} ${indicator.label}`}</td>
                <td className={className}>{label}</td>
                <td className="sa-kind">
                  {EVIDENCE_LABEL[indicator.evidenceKind] ?? indicator.evidenceKind}
                </td>
                <td>{satisfied ? indicator.evidence : indicator.note}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="sa-note">
        {`结构：模块切换 ${data.metrics.moduleSuccessions} · 依赖链 ${data.metrics.dependentCalls}`
          + ` · 错误恢复 ${data.metrics.recoveries} · 产物回流 ${data.metrics.artifactReuse}`
          + ` · 自读回 ${data.metrics.selfReadbacks} · 注入观测 ${data.metrics.injectionLoops}`
          + ` · 工具调用 ${data.metrics.toolCalls}`}
      </div>

      <div className="sa-note">{data.disclaimer}</div>
      <div className="sa-note">
        依据 Butlin/Long/Bengio 等 (2023)《Consciousness in Artificial Intelligence》的 14 项指标属性；
        只采信可复算的轨迹结构与架构事实。
      </div>
    </div>
  )
}
