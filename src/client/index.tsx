/**
 * Client half: an audit panel for the current session.
 *
 * Registered in `tool.view.cordis` — the Package-owned interactive region inside
 * the latest `cordis_run` card — so it appears in the conversation flow beside
 * the run that produced it.
 *
 * The panel never reimplements the rubric: it asks the host for the result, so
 * the browser view and the model-facing tool output can never disagree.
 *
 * @module dsh-sentience-audit/client
 */

import { useEffect, useState, type ReactElement } from 'react'

import type { AuditOutcome } from '../core/types.ts'

/** Structural view of the client slot registry (avoids a hard DSH type dep). */
interface SlotsService {
  inject(name: string, callback: () => unknown): unknown
  register(
    options: { name: string; key?: string },
    render: (props: { sessionId?: string }) => ReactElement,
  ): unknown
}

/** Structural view of the browser half's host bridge. */
interface HostBridge {
  call(method: string, args: unknown): Promise<unknown>
}

/** Cordis client context shape this plugin uses. */
interface ClientContext {
  get(name: string): unknown
}

/** Stylesheet helper injected by the client runtime. */
declare const styles: { insert(css: string): () => void }

/** Package-private host bridge injected by the client runtime. */
declare const host: HostBridge

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
.sa-btn{border:1px solid var(--dsh-border-subtle,rgba(127,127,127,.4));background:transparent;color:inherit;border-radius:6px;padding:3px 10px;cursor:pointer;font-size:12px}
.sa-err{color:#e5534b}
`

/** Stable Cordis plugin name (client half). */
export const name = 'sentience-audit-client'

/** Storage for the panel during a render pass. */
type PanelState =
  | { phase: 'loading' }
  | { phase: 'ready'; data: AuditOutcome }
  | { phase: 'error'; message: string }

/**
 * Register the panel.
 *
 * @param ctx - the client Cordis context.
 */
export function apply(ctx: ClientContext): void {
  const slots = ctx.get('slots') as SlotsService | undefined
  if (slots === undefined) return

  styles.insert(CSS)

  slots.inject('tool.view.cordis', () =>
    slots.register({ name: 'tool.view.cordis', key: 'self' }, (props) => {
      const sessionId = typeof props.sessionId === 'string' ? props.sessionId : ''
      const [state, setState] = useState<PanelState>({ phase: 'loading' })

      const run = (): void => {
        setState({ phase: 'loading' })
        host
          .call('sentience-audit', { sessionId })
          .then((value) => {
            const data = value as AuditOutcome
            if (data !== null && typeof data === 'object' && data.ok === false) {
              setState({ phase: 'error', message: data.error })
              return
            }
            setState({ phase: 'ready', data })
          })
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error)
            setState({ phase: 'error', message })
          })
      }

      // `run` is recreated per render but only closes over `sessionId` and a
      // stable setter, so keying the effect on `sessionId` is sufficient.
      useEffect(() => {
        run()
      }, [sessionId])

      return (
        <div className="sa-panel">
          <div className="sa-head">
            <span>意识指标审计</span>
            <span className="sa-sub">Sentience Indicator Audit · L1–L5</span>
          </div>
          {state.phase === 'loading' ? (
            <div className="sa-note">正在读取会话轨迹并复算 14 项指标…</div>
          ) : null}
          {state.phase === 'error' ? (
            <>
              <div className="sa-err">{state.message}</div>
              <button className="sa-btn" onClick={run}>
                重试
              </button>
            </>
          ) : null}
          {state.phase === 'ready' ? (
            <AuditReport data={state.data} onRerun={run} />
          ) : null}
        </div>
      )
    }),
  )
}

/** Render one completed audit. */
function AuditReport(props: { data: AuditOutcome; onRerun: () => void }): ReactElement {
  const { data, onRerun } = props
  if (data.ok === false) return <div className="sa-err">{data.error}</div>

  const tone = LEVEL_TONES[Math.min(4, Math.max(0, data.level - 1))] ?? LEVEL_TONES[0]

  return (
    <>
      <div className="sa-head">
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

      <button className="sa-btn" onClick={onRerun}>
        按最新轨迹重算
      </button>
    </>
  )
}
