import type { ActionName, Outcome, Phrase } from '../../types'

export interface AnalysisDraftPhrase {
  timestamp: number
  action: ActionName
  /** Opponent action in the same phrase (same taxonomy), when inferable. */
  opponentAction?: ActionName
  outcome: Outcome
  /** Visible referee signal summary, e.g. "hand raised left". */
  refSignal?: string
  remark?: string
  confidence?: number
}

export interface AnalysisFrame {
  timestamp: number
  dataUrl: string
}

export interface AnalysisRequest {
  boutId?: string
  side: 'left' | 'right'
  title?: string
  duration?: number
  frames: AnalysisFrame[]
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
    timestamp: draft.timestamp,
    action: draft.action,
    opponentAction: draft.opponentAction,
    outcome: draft.outcome,
    refSignal: draft.refSignal,
    remark:
      draft.remark ??
      (draft.confidence != null
        ? `AI draft (${Math.round(draft.confidence * 100)}%)`
        : 'AI draft'),
    fromAnalysis: true,
  }))
}
