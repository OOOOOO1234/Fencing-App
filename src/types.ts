/** Sabre action dictionary (Phase 0 / Phase 1). */
export const ACTIONS = [
  'Simple attack',
  'Attack on the preparation',
  'Compound attack',
  'Beat attack',
  'Counterattack',
  'Parry-riposte',
  'Remise',
  'Point in line',
  'Preparation only',
] as const

export type ActionName = (typeof ACTIONS)[number]

export const OUTCOMES = [
  'point_for',
  'point_against',
  'double',
  'no_touch',
] as const

export type Outcome = (typeof OUTCOMES)[number]

export const OUTCOME_LABELS: Record<Outcome, string> = {
  point_for: 'Point for',
  point_against: 'Point against',
  double: 'Double',
  no_touch: 'No touch',
}

export type FencerSide = 'left' | 'right'

export interface Phrase {
  id: string
  /** Seconds into the video (phrase start / seek target). */
  timestamp: number
  action: ActionName
  outcome: Outcome
  /** Optional note when the awarded call looks wrong; does not change counts. */
  remark?: string
}

export interface Bout {
  id: string
  title: string
  side: FencerSide
  createdAt: string
  /** True when this bout is sample data for exploring stats without a real upload. */
  isDemo?: boolean
  hasVideo: boolean
  phrases: Phrase[]
}

export interface ActionStats {
  action: ActionName
  attempts: number
  pointsFor: number
  pointsAgainst: number
  doubles: number
  noTouch: number
  successRate: number | null
  costRate: number | null
  net: number
  shareOfPoints: number | null
}

export interface BoutStats {
  byAction: ActionStats[]
  totals: {
    attempts: number
    pointsFor: number
    pointsAgainst: number
    doubles: number
    noTouch: number
    successRate: number | null
    costRate: number | null
    net: number
  }
}
