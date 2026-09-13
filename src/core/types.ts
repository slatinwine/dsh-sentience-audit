/**
 * Result types for one consciousness-indicator audit.
 *
 * The rubric comes from Butlin, Long, Elmoznino, Bengio et al. (2023),
 * "Consciousness in Artificial Intelligence: Insights from the Science of
 * Consciousness" (arXiv:2308.08708), Table 1.
 *
 * @module dsh-sentience-audit/types
 */

/** Theory family an indicator property is derived from. */
export type FamilyKey = 'RPT' | 'GWT' | 'HOT' | 'AST' | 'PP' | 'AE'

/**
 * How strong the evidence behind a verdict is.
 *
 * - `architectural` — the Harness architecture itself supplies the property, so
 *   the verdict does not depend on reading the model's behaviour at all.
 * - `structural` — inferred from replayable trace structure (call graphs,
 *   argument lineage, failure recovery), never from wording.
 * - `self-report` — rests on the system's own statements about itself. The
 *   weakest kind, and the paper warns behavioural evidence is unreliable.
 */
export type EvidenceKind = 'architectural' | 'structural' | 'self-report'

/** Verdict for one indicator property. */
export type IndicatorStatus = 'satisfied' | 'absent' | 'not-assessable'

/** One indicator property and the verdict reached for it. */
export interface IndicatorVerdict {
  /** Stable id, e.g. `RPT-1`. */
  readonly id: string
  /** Theory family the property belongs to. */
  readonly family: FamilyKey
  /** Chinese label used by the bundled UI. */
  readonly label: string
  /** The paper's own wording for the property. */
  readonly en: string
  /** How strong the evidence behind this verdict is. */
  readonly evidenceKind: EvidenceKind
  /** The verdict. `not-assessable` is a finding, not a failure. */
  readonly status: IndicatorStatus
  /** Trace facts supporting a `satisfied` verdict. */
  readonly evidence: string
  /** Why the property is absent, or why it cannot be assessed from a trace. */
  readonly note: string
}

/** Per-family roll-up. */
export interface FamilyVerdict {
  readonly key: FamilyKey
  readonly label: string
  /** How many of the family's properties were satisfied. */
  readonly satisfied: number
  /** How many properties the family has. */
  readonly total: number
  /** How many satisfied properties the family needs to count as established. */
  readonly need: number
  /** Whether `satisfied >= need`. */
  readonly established: boolean
}

/**
 * Structural facts extracted from the trajectory. Every field is computed from
 * replayable structure; no field depends on what the model wrote.
 */
export interface AuditMetrics {
  readonly sessionId: string
  readonly turns: number
  readonly steps: number
  readonly assistantMessages: number
  readonly userMessages: number
  /**
   * Input tokens summed over every assistant step — the cumulative context the
   * session pushed through the model, NOT a count of unique tokens. A long
   * session reports a large number here because each step re-sends its context.
   */
  readonly contextTokens: number
  readonly toolCalls: number
  readonly distinctTools: number
  readonly toolErrors: number
  readonly toolFamilies: number
  readonly interleavings: number
  readonly toolRuns: number
  /** Consecutive calls that switch specialised module family. */
  readonly moduleSuccessions: number
  /** A later call whose arguments carry a path the previous call referenced. */
  readonly dependentCalls: number
  /** Tool failures after which the trace changed tool or arguments. */
  readonly recoveries: number
  /** Distinct paths the session itself wrote. */
  readonly artifacts: number
  /** Written paths later consumed by a different tool. */
  readonly artifactReuse: number
  /** Reads of a path the session itself wrote. */
  readonly selfReadbacks: number
  /** Produce-then-observe loops through an input module. */
  readonly injectionLoops: number
  /** todo_write calls. */
  readonly plans: number
  /** create_goal / update_goal calls. */
  readonly goals: number
  /** Distinct turns that issued at least one tool call. */
  readonly turnsWithAction: number
  readonly compactions: number
  readonly budgetEvents: number
  readonly interrupted: number
}

/**
 * A complete audit of one session.
 *
 * The array members are mutable rather than `readonly`: this value is
 * serialized into the tool's JSON schema, whose array nodes carry no readonly
 * modifiers, so mutable arrays keep the TypeScript type and the enforced schema
 * in exact agreement.
 */
export interface AuditResult {
  readonly ok: true
  /** Effective level, 1-5. */
  readonly level: number
  readonly levelLabel: string
  readonly levelNote: string
  /** Coarse confidence band derived from satisfied/established counts. */
  readonly band: string
  readonly satisfiedCount: number
  readonly absentCount: number
  readonly notAssessableCount: number
  readonly totalCount: number
  readonly establishedFamilies: number
  /** Established family keys. */
  readonly establishedKeys: FamilyKey[]
  readonly families: FamilyVerdict[]
  readonly indicators: IndicatorVerdict[]
  readonly metrics: AuditMetrics
  readonly rubricSource: string
  readonly disclaimer: string
  readonly computedAt: string
}

/** Returned when the audit cannot run at all. */
export interface AuditFailure {
  readonly ok: false
  readonly error: string
  readonly computedAt: string
}

export type AuditOutcome = AuditResult | AuditFailure
