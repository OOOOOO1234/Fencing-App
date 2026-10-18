import { ACTIONS, isActionName } from '../actions'
import type { Outcome } from '../../types'
import type { AnalysisProvider, AnalysisRequest, AnalysisResult } from './types'

const ANALYZE_URL = '/.netlify/functions/analyze'
/** Client abort well under a silent 10-minute wait; Netlify sync functions are ~10–26s. */
const CLIENT_TIMEOUT_MS = 50_000

function isOutcome(value: unknown): value is Outcome {
  return (
    value === 'point_for' ||
    value === 'point_against' ||
    value === 'double' ||
    value === 'no_touch'
  )
}

/** Calls the Netlify Function. OpenAI key stays on the server — never in the browser. */
export const netlifyAnalysisProvider: AnalysisProvider = {
  id: 'netlify-analyze',
  label: 'Server analysis',
  async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
    if (!request.frames?.length) {
      return {
        status: 'error',
        message: 'No frames to analyze. Load the video first.',
        drafts: [],
      }
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
          weapon: 'sabre',
          actions: ACTIONS,
        }),
      })

      const data = (await response.json().catch(() => ({}))) as {
        phrases?: unknown
        error?: string
        meta?: { note?: string; audioCueCount?: number }
      }

      if (response.status === 503) {
        return {
          status: 'needs_key',
          message:
            data.error ||
            'Server analysis key missing. Set OPENAI_API_KEY in Netlify (functions). Manual tagging still works.',
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
        const timestamp = Number(row.timestamp)
        if (!Number.isFinite(timestamp)) return []
        const opp =
          typeof row.opponentAction === 'string' && isActionName(row.opponentAction)
            ? row.opponentAction
            : undefined
        return [
          {
            timestamp,
            action: row.action as (typeof ACTIONS)[number],
            opponentAction: opp,
            outcome: row.outcome,
            refSignal: typeof row.refSignal === 'string' ? row.refSignal : undefined,
            remark: typeof row.remark === 'string' ? row.remark : undefined,
            confidence: typeof row.confidence === 'number' ? row.confidence : undefined,
          },
        ]
      })

      const note = data.meta?.note ? ` ${data.meta.note}` : ''
      const cues = data.meta?.audioCueCount ?? request.audioCues?.length ?? 0
      const withOpp = drafts.filter((d) => d.opponentAction).length
      const withRef = drafts.filter((d) => d.refSignal).length
      return {
        status: 'ok',
        message:
          drafts.length > 0
            ? `Drafted ${drafts.length} phrase${drafts.length === 1 ? '' : 's'} (${withOpp} opp, ${withRef} ref, ${cues} audio peaks). Edit if the call is wrong.${note}`
            : `No phrases drafted.${note} Mark manually or Edit after retry.`,
        drafts,
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return {
          status: 'error',
          message:
            'Analyze timed out after 50s. Try a shorter clip, or mark phrases manually.',
          drafts: [],
        }
      }
      return {
        status: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Analysis request failed (is the Netlify function deployed?)',
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
