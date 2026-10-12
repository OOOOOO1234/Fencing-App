import type { ActionName, Outcome } from '../types'

export interface GlossaryEntry {
  action: ActionName
  summary: string
  rowNote: string
}

/** Short sabre definitions — right-of-way aware, for in-app teaching. */
export const ACTION_GLOSSARY: GlossaryEntry[] = [
  {
    action: 'Simple attack',
    summary: 'A direct attack that starts first and finishes without a feint or beat.',
    rowNote:
      'In sabre, the attacker who starts first usually has right of way if the attack lands cleanly.',
  },
  {
    action: 'Attack on the preparation',
    summary: 'You attack into their prep before their attack truly starts.',
    rowNote: 'You steal initiative; if the referee agrees you started first, the touch is yours.',
  },
  {
    action: 'Compound attack',
    summary: 'Feint or disengage attack that draws a reaction before the real finish.',
    rowNote: 'Right of way stays with the attacker if the compound finishes without their attack taking over.',
  },
  {
    action: 'Beat attack',
    summary: 'Beat their blade, then finish the attack in the same phrase.',
    rowNote: 'A clear beat can keep or take right of way before the finish.',
  },
  {
    action: 'Counterattack',
    summary: 'You hit while they are attacking — a stop-hit or counter into their attack.',
    rowNote:
      'In sabre this often loses unless their attack is wrong or late; tag the awarded touch, not the light alone.',
  },
  {
    action: 'Parry-riposte',
    summary: 'You take their attack with a parry, then riposte.',
    rowNote: 'A successful parry transfers right of way to the riposte.',
  },
  {
    action: 'Remise',
    summary: 'A second intention after the first attack fails, still in the same phrase.',
    rowNote: 'Often no right of way vs a clean riposte — count the awarded result.',
  },
  {
    action: 'Point in line',
    summary: 'Arm extended with the point threatening before they start.',
    rowNote: 'Can hold priority against an attack if established early and maintained.',
  },
  {
    action: 'Preparation only',
    summary: 'Footwork or blade setup that does not itself finish the phrase.',
    rowNote: 'Useful for tracking setups that never become a finishing action.',
  },
]

export const OUTCOME_GLOSSARY: Record<Outcome, string> = {
  point_for: 'Referee awarded you the touch. This is “worked.”',
  point_against: 'Referee awarded the opponent the touch. This is “failed / cost.”',
  double: 'Both sides awarded (or simultaneous call). Neither pure success nor pure cost.',
  no_touch: 'Halt with no score (or no award). Neither worked nor failed.',
}

export function glossaryFor(action: ActionName): GlossaryEntry {
  return ACTION_GLOSSARY.find((entry) => entry.action === action) ?? {
    action,
    summary: action,
    rowNote: '',
  }
}
