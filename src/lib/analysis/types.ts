import type { ActionName, AnalysisSource, Outcome, Phrase, RefGesture } from '../../types'
import type { AudioClip, AudioCue } from '../audio'
import type { CorrectionExample } from './corrections'

export interface AnalysisDraftPhrase {
  timestamp: number
  tStart?: number
  tHalt?: number
  action: ActionName
  opponentAction?: ActionName
  outcome: Outcome
  refSignal?: string
  refGesture?: RefGesture
  refWords?: string
  sources?: AnalysisSource[]
  needsReview?: boolean
  remark?: string
  confidence?: number
}

export interface AnalysisFrame {
  timestamp: number
  dataUrl: string
  role?: 'piste' | 'ref'
}

export interface AnalysisRequest {
  boutId?: string
  side: 'left' | 'right'
  title?: string
  duration?: number
  frames: AnalysisFrame[]
  audioCues?: AudioCue[]
  audioClips?: AudioClip[]
  fewShot?: CorrectionExample[]
}

export interface AnalysisResult {
  status: 'ok' | 'needs_key' | 'error'
  message: string
  drafts: AnalysisDraftPhrase[]
}

export interface AnalysisProvider {
  id: string
  label: string
  analyze(request: AnalysisRequest): Promise<AnalysisResult>
}

export function draftsToPhrases(
  drafts: AnalysisDraftPhrase[],
  newId: () => string,
): Phrase[] {
  return drafts.map((draft) => ({
    id: newId(),
    timestamp: draft.tHalt ?? draft.timestamp,
    tStart: draft.tStart,
    tHalt: draft.tHalt ?? draft.timestamp,
    action: draft.action,
    opponentAction: draft.opponentAction,
    outcome: draft.outcome,
    refSignal: draft.refSignal,
    refGesture: draft.refGesture,
    refWords: draft.refWords,
    sources: draft.sources,
    needsReview: draft.needsReview,
    remark:
      draft.remark ??
      (draft.confidence != null
        ? `AI draft (${Math.round(draft.confidence * 100)}%)`
        : 'AI draft'),
    fromAnalysis: true,
  }))
}
