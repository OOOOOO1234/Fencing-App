/**
 * Canonical sabre action taxonomy for tagging, charts, Analyze, and History.
 * Aligned with FIE Technical Rules (t.9–15 general; t.100–106 sabre) plus common
 * coaching labels. Keep this list as the single source of truth.
 */

export const ACTIONS = [
  'Simple attack',
  'Compound attack',
  'Attack on the preparation',
  'Beat attack',
  'Prise de fer',
  'Counterattack',
  'Counter-time',
  'Parry',
  'Riposte',
  'Parry-riposte',
  'Counter-riposte',
  'Remise',
  'Redoublement',
  'Reprise',
  'Point in line',
  'Preparation only',
  'No action',
] as const

export type ActionName = (typeof ACTIONS)[number]

/** Short FIE/coaching gloss for docs and UI helpers. */
export const ACTION_BLURBS: Record<ActionName, string> = {
  'Simple attack': 'Direct continuous threat that finishes without feint (t.9 / t.101).',
  'Compound attack': 'Feints then final movement (t.10 / t.103).',
  'Attack on the preparation': 'Attack into opponent prep / hesitation before their attack starts.',
  'Beat attack': 'Beat then finish; forte beat can give opponent riposte right (t.104).',
  'Prise de fer': 'Taking/deflecting the blade before finishing (cf. t.102 / t.15 line).',
  Counterattack: 'Stop-hit / counter into an attack (t.12).',
  'Counter-time': 'Action against the opponent’s stop-hit (t.14).',
  Parry: 'Defensive blade action that closes the finishing line (t.105).',
  Riposte: 'Offensive action after a parry; must be immediate to keep priority (t.105).',
  'Parry-riposte': 'Parry + immediate riposte as one tagged phrase.',
  'Counter-riposte': 'Riposte after parrying their riposte (t.9).',
  Remise: 'Immediate renewal without withdrawing the arm (t.13).',
  Redoublement: 'New attack after the first falls short / is parried (t.13).',
  Reprise: 'New attack after returning to guard (t.13).',
  'Point in line': 'Arm extended, point continually threatening (t.15 / t.102).',
  'Preparation only': 'Setup with no continuous attacking threat yet.',
  'No action': 'Halt with neither fencer finishing a scoring action.',
}

/** Map older / alternate labels into the canonical set (Phase 5 aliases). */
const LEGACY_ALIASES: Record<string, ActionName> = {
  'stop-hit': 'Counterattack',
  'stop hit': 'Counterattack',
  'stop cut': 'Counterattack',
  'arrêt': 'Counterattack',
  'arret': 'Counterattack',
  'taking the blade': 'Prise de fer',
  'beat': 'Beat attack',
  'direct attack': 'Simple attack',
  'nothing': 'No action',
  'no touch action': 'No action',
  'no action': 'No action',
}

export function isActionName(value: string): value is ActionName {
  return (ACTIONS as readonly string[]).includes(value)
}

export function coerceActionName(value: unknown): ActionName | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (isActionName(trimmed)) return trimmed
  const alias = LEGACY_ALIASES[trimmed.toLowerCase()]
  return alias ?? null
}
