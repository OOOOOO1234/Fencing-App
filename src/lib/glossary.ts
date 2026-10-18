import { ACTIONS, ACTION_BLURBS, type ActionName } from './actions'
import type { Outcome } from '../types'

export interface GlossaryEntry {
  action: ActionName
  summary: string
  rowNote: string
}

/** Short sabre definitions — right-of-way aware. */
export const ACTION_GLOSSARY: GlossaryEntry[] = ACTIONS.map((action) => ({
  action,
  summary: ACTION_BLURBS[action],
  rowNote: 'Award follows the referee call; tag the awarded result, not lights alone.',
}))

export const OUTCOME_GLOSSARY: Record<Outcome, string> = {
  point_for: 'Referee awarded the touch to you (your side).',
  point_against: 'Referee awarded the touch to the opponent.',
  double: 'Both awarded (rare in sabre competitive practice).',
  no_touch: 'No score — nothing, annulled simultaneous, or off-target halt.',
}
