/**
 * Assessment: combine the structural metrics and the per-indicator verdicts
 * into one audit result and an effective L1-L5 level.
 *
 * The level is gated, not averaged. Each tier names the specific properties that
 * carry it, so a session cannot climb by accumulating unrelated satisfied
 * indicators — an earlier revision did exactly that and reported L5 for a
 * trajectory whose own indicator list contradicted it.
 *
 * @module dsh-sentience-audit/core/assess
 */

import { analyze } from './analysis.ts'
import { evaluateIndicators } from './indicators.ts'
import { DISCLAIMER, FAMILIES, LEVELS, REQUIREMENTS, RUBRIC_SOURCE } from './rubric.ts'
import { readTranscript } from './transcript.ts'
import type {
  AuditMetrics,
  AuditResult,
  FamilyKey,
  FamilyVerdict,
  IndicatorVerdict,
} from './types.ts'

/** Descending confidence bands, indexed by `level - 1`. */
const BANDS: readonly string[] = ['极低', '低', '中', '高', '极高']

/** Roll the indicator verdicts up per theory family. */
export function evaluateFamilies(
  indicators: readonly IndicatorVerdict[],
): FamilyVerdict[] {
  return FAMILIES.map((spec) => {
    const owned = indicators.filter((indicator) => indicator.family === spec.key)
    const satisfied = owned.filter((indicator) => indicator.status === 'satisfied').length
    return {
      key: spec.key,
      label: spec.label,
      satisfied,
      total: owned.length,
      need: spec.need,
      established: satisfied >= spec.need,
    }
  })
}

/** The highest tier whose every clause holds. */
export function effectiveLevel(
  families: readonly FamilyVerdict[],
  indicators: readonly IndicatorVerdict[],
): {
  level: number
  band: string
  satisfiedCount: number
  establishedCount: number
  establishedKeys: FamilyKey[]
} {
  const establishedKeys: FamilyKey[] = families
    .filter((family) => family.established)
    .map((family) => family.key)
  const satisfied = new Set(
    indicators.filter((i) => i.status === 'satisfied').map((i) => i.id),
  )

  let level = 1
  for (const rule of REQUIREMENTS) {
    if (establishedKeys.length < rule.establishedFamilies) continue
    if (satisfied.size < rule.satisfiedMin) continue
    if (!rule.must.every((id) => satisfied.has(id))) continue
    level = rule.level
  }

  return {
    level,
    band: BANDS[level - 1] ?? '极低',
    satisfiedCount: satisfied.size,
    establishedCount: establishedKeys.length,
    establishedKeys,
  }
}

/**
 * Audit one session's trajectory.
 *
 * @param params.sessionId - the session id, echoed into the metrics.
 * @param params.events - the session's own events, in order.
 * @returns a complete audit result.
 */
export function assess(params: {
  sessionId: string
  events: readonly unknown[]
}): AuditResult {
  const transcript = readTranscript(params.events)
  const base = analyze(transcript)
  const metrics: AuditMetrics = { ...base, sessionId: params.sessionId }

  const indicators = evaluateIndicators(metrics)
  const families = evaluateFamilies(indicators)
  const effective = effectiveLevel(families, indicators)
  const level = LEVELS[effective.level - 1] ?? LEVELS[0]!

  let satisfiedCount = 0
  let absentCount = 0
  let notAssessableCount = 0
  for (const indicator of indicators) {
    if (indicator.status === 'satisfied') satisfiedCount += 1
    else if (indicator.status === 'absent') absentCount += 1
    else notAssessableCount += 1
  }

  return {
    ok: true,
    level: level.level,
    levelLabel: level.label,
    levelNote: level.note,
    band: effective.band,
    satisfiedCount,
    absentCount,
    notAssessableCount,
    totalCount: indicators.length,
    establishedFamilies: effective.establishedCount,
    establishedKeys: effective.establishedKeys,
    families,
    indicators,
    metrics,
    rubricSource: RUBRIC_SOURCE,
    disclaimer: DISCLAIMER,
    computedAt: new Date().toISOString(),
  }
}
