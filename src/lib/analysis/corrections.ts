/** Persist user Edits locally for few-shot Analyze (Phase 4). */

import type { ActionName, Outcome, Phrase } from '../../types'

const KEY = 'fencing-app:corrections:v1'
const MAX = 24

export interface CorrectionExample {
  action: ActionName
  opponentAction?: ActionName
  outcome: Outcome
  refWords?: string
  refGesture?: string
  savedAt: string
}

function readAll(): CorrectionExample[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? (parsed as CorrectionExample[]) : []
  } catch {
    return []
  }
}

function writeAll(rows: CorrectionExample[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(rows.slice(0, MAX)))
  } catch {
    /* quota / private mode */
  }
}

/** Call when user Saves an Edit. */
export function rememberCorrection(phrase: Phrase): void {
  const row: CorrectionExample = {
    action: phrase.action,
    opponentAction: phrase.opponentAction,
    outcome: phrase.outcome,
    refWords: phrase.refWords,
    refGesture: phrase.refGesture,
    savedAt: new Date().toISOString(),
  }
  const next = [row, ...readAll().filter((r) => !(r.action === row.action && r.outcome === row.outcome && r.refWords === row.refWords))]
  writeAll(next)
}

export function loadFewShotExamples(limit = 6): CorrectionExample[] {
  return readAll().slice(0, limit)
}

export function formatFewShotForPrompt(examples: CorrectionExample[]): string {
  if (!examples.length) return 'No prior user corrections.'
  return examples
    .map(
      (e, i) =>
        `${i + 1}. you=${e.action}` +
        (e.opponentAction ? ` opp=${e.opponentAction}` : '') +
        ` outcome=${e.outcome}` +
        (e.refWords ? ` refWords="${e.refWords.slice(0, 40)}"` : ''),
    )
    .join('\n')
}
