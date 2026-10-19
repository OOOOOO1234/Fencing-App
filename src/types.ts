export { ACTIONS, type ActionName, isActionName, coerceActionName, ACTION_BLURBS } from './lib/actions'
export {
  REF_GESTURES,
  type RefGesture,
  type AnalysisSource,
  formatRefChip,
} from './lib/refLexicon'
import type { ActionName } from './lib/actions'
import type { AnalysisSource, RefGesture } from './lib/refLexicon'

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

/**
 * Phrase event contract (smart-analysis plan Phase 0).
 * `timestamp` remains the seek target (prefer tHalt ?? tStart).
 */
export interface Phrase {
  id: string
  /** Seek target — prefer tHalt when known. */
  timestamp: number
  /** Phrase start (seconds), when known. */
  tStart?: number
  /** Halt / award moment (seconds), when known. */
  tHalt?: number
  /** Your action (relative to selected left/right). */
  action: ActionName
  opponentAction?: ActionName
  /**
   * Ground-truth outcome from ref award relative to your side.
   * Hands win over vision/speech proposals unless edited.
   */
  outcome: Outcome
  /** Free-text note / analysis remark. */
  remark?: string
  /** Legacy free-text ref note (kept for older drafts). */
  refSignal?: string
  /** Structured gesture from Gestes et Mots mapping. */
  refGesture?: RefGesture
  /** Spoken call snippet (Whisper / lexicon). */
  refWords?: string
  /** Which signals contributed. */
  sources?: AnalysisSource[]
  /** User corrected via Edit. */
  edited?: boolean
  /** Rules layer flagged a contradiction. */
  needsReview?: boolean
  scoreYou?: number
  scoreThem?: number
  initiative?: Initiative
  /** AI draft not yet confirmed. */
  fromAnalysis?: boolean
}

/** Opponent action usage inside a win/lose bucket. */
export interface OpponentActionShare {
  action: ActionName
  count: number
  share: number | null
}

export interface OpponentSituationStats {
  whenYouWin: {
    phrases: number
    byAction: OpponentActionShare[]
  }
  whenYouLose: {
    phrases: number
    byAction: OpponentActionShare[]
  }
  opponentSuccess: Array<{
    action: ActionName
    attempts: number
    theirPoints: number
    yourPoints: number
    theirSuccessRate: number | null
  }>
}

export interface Bout {
  id: string
  title: string
  side: FencerSide
  createdAt: string
  updatedAt?: string
  recordedAt?: string
  isDemo?: boolean
  hasVideo: boolean
  phrases: Phrase[]
  playlistIds?: string[]
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
  opponentSituation: OpponentSituationStats
}
