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

export type ScoreState = 'ahead' | 'tied' | 'behind' | 'unknown'

export type Initiative = 'you' | 'them' | 'unknown'

export interface Phrase {
  id: string
  /** Seconds into the video (phrase start / seek target). */
  timestamp: number
  action: ActionName
  outcome: Outcome
  /** Optional note when the awarded call looks wrong; does not change counts. */
  remark?: string
  /** Score for "you" before this phrase (optional situation label). */
  scoreYou?: number
  /** Score for opponent before this phrase. */
  scoreThem?: number
  /** Who started the phrase / had initiative. */
  initiative?: Initiative
  /** True when this phrase was suggested by the analysis provider (not yet confirmed). */
  fromAnalysis?: boolean
}

export interface Bout {
  id: string
  title: string
  side: FencerSide
  createdAt: string
  updatedAt?: string
  /**
   * Optional calendar date when the bout was filmed (YYYY-MM-DD).
   * Used for History trends; falls back to createdAt when absent.
   */
  recordedAt?: string
  /** True when this bout is sample data for exploring stats without a real upload. */
  isDemo?: boolean
  hasVideo: boolean
  phrases: Phrase[]
  /** Optional competition / playlist tags (ids). */
  playlistIds?: string[]
  /** Cloud sync id when Supabase is configured. */
  remoteId?: string
}

export interface Playlist {
  id: string
  name: string
  createdAt: string
  boutIds: string[]
}

export interface Invite {
  id: string
  boutId: string
  token: string
  createdAt: string
  /** read-only coach share */
  role: 'coach'
  label?: string
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
  byScoreState: Record<ScoreState, BoutStats['totals']>
}
