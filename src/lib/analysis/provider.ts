import { ACTIONS, isActionName } from '../actions'
import { REF_GESTURES, type RefGesture } from '../refLexicon'
import type { AnalysisSource, Outcome } from '../../types'
import type { AnalysisProvider, AnalysisRequest, AnalysisResult } from './types'

const ANALYZE_URL = '/.netlify/functions/analyze'
const CLIENT_TIMEOUT_MS = 55_000

function isOutcome(value: unknown): value is Outcome {
  return (
    value === 'point_for' ||
    value === 'point_against' ||
    value === 'double' ||
    value === 'no_touch'
  )
}

function isGesture(value: unknown): value is RefGesture {
  return typeof value === 'string' && (REF_GESTURES as readonly string[]).includes(value)
}

function isSource(value: unknown): value is AnalysisSource {
  return (
    value === 'hands' ||
    value === 'speech' ||
    value === 'vision' ||
    value === 'audio_peak' ||
    value === 'rules' ||
    value === 'edit'
  )
}

export const netlifyAnalysisProvider: AnalysisProvider = {
  id: 'netlify-analyze',
  label: 'Server analysis',
  async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
    if (!request.frames?.length) {
      return { status: 'error', message: 'No frames to analyze. Load the video first.', drafts: [] }
    }

    const controller = new AbortController()
    const timer = window.setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS)

    try {
      const response = await fetch(ANALYZE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          side: request.side,
          title: request.title,
          duration: request.duration,
          frames: request.frames,
          audioCues: request.audioCues ?? [],
          audioClips: request.audioClips ?? [],
          fewShot: request.fewShot ?? [],
          weapon: 'sabre',
          actions: ACTIONS,
        }),
      })

      const data = (await response.json().catch(() => ({}))) as {
        phrases?: unknown
        error?: string
        meta?: { note?: string; whisperCount?: number; speechNote?: string }
      }

      if (response.status === 503) {
        return {
          status: 'needs_key',
          message:
            data.error ||
            'Server analysis key missing. Set OPENAI_API_KEY in Netlify (functions).',
          drafts: [],
        }
      }

      if (!response.ok) {
        return {
          status: 'error',
          message: data.error || `Analysis failed (${response.status})`,
          drafts: [],
        }
      }

      const raw = Array.isArray(data.phrases) ? data.phrases : []
      const drafts = raw.flatMap((item) => {
        if (!item || typeof item !== 'object') return []
        const row = item as Record<string, unknown>
        if (!isActionName(String(row.action ?? '')) || !isOutcome(row.outcome)) return []
        const timestamp = Number(row.timestamp ?? row.tHalt)
        if (!Number.isFinite(timestamp)) return []
        const opp =
          typeof row.opponentAction === 'string' && isActionName(row.opponentAction)
            ? row.opponentAction
            : undefined
        const sources = Array.isArray(row.sources)
          ? row.sources.filter(isSource)
          : undefined
        return [
          {
            timestamp,
            tStart: Number.isFinite(Number(row.tStart)) ? Number(row.tStart) : undefined,
            tHalt: Number.isFinite(Number(row.tHalt)) ? Number(row.tHalt) : timestamp,
            action: row.action as (typeof ACTIONS)[number],
            opponentAction: opp,
            outcome: row.outcome,
            refSignal: typeof row.refSignal === 'string' ? row.refSignal : undefined,
            refGesture: isGesture(row.refGesture) ? row.refGesture : undefined,
            refWords: typeof row.refWords === 'string' ? row.refWords : undefined,
            sources,
            needsReview: Boolean(row.needsReview),
            remark: typeof row.remark === 'string' ? row.remark : undefined,
            confidence: typeof row.confidence === 'number' ? row.confidence : undefined,
          },
        ]
      })

      const note = data.meta?.note ? ` ${data.meta.note}` : ''
      const whisper = data.meta?.whisperCount ?? 0
      const withRef = drafts.filter((d) => d.refWords || d.refGesture).length
      const review = drafts.filter((d) => d.needsReview).length
      return {
        status: 'ok',
        message:
          drafts.length > 0
            ? `Drafted ${drafts.length} · ${whisper} speech clips · ${withRef} with ref · ${review} review. Edit if wrong.${note}`
            : `No phrases drafted.${data.meta?.speechNote ? ` ${data.meta.speechNote}` : ''}${note}`,
        drafts,
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return {
          status: 'error',
          message: 'Analyze timed out. Try a shorter clip, or mark phrases manually.',
          drafts: [],
        }
      }
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Analysis request failed',
        drafts: [],
      }
    } finally {
      window.clearTimeout(timer)
    }
  },
}

export function getAnalysisProvider(): AnalysisProvider {
  return netlifyAnalysisProvider
}
