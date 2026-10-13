import { ACTIONS } from '../../types'
import type { ActionName, Outcome } from '../../types'
import type { AnalysisProvider, AnalysisRequest, AnalysisResult } from './types'

const ANALYZE_URL = '/.netlify/functions/analyze'

function isAction(value: unknown): value is ActionName {
  return typeof value === 'string' && (ACTIONS as readonly string[]).includes(value)
}

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

    try {
      const response = await fetch(ANALYZE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side: request.side,
          title: request.title,
          duration: request.duration,
          frames: request.frames,
          weapon: 'sabre',
          actions: ACTIONS,
        }),
      })

      const data = (await response.json().catch(() => ({}))) as {
        phrases?: unknown
        error?: string
        meta?: { note?: string }
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
        if (!isAction(row.action) || !isOutcome(row.outcome)) return []
        const timestamp = Number(row.timestamp)
        if (!Number.isFinite(timestamp)) return []
        return [
          {
            timestamp,
            action: row.action,
            outcome: row.outcome,
            remark: typeof row.remark === 'string' ? row.remark : undefined,
            confidence: typeof row.confidence === 'number' ? row.confidence : undefined,
          },
        ]
      })

      const note = data.meta?.note ? ` ${data.meta.note}` : ''
      return {
        status: 'ok',
        message:
          drafts.length > 0
            ? `Drafted ${drafts.length} phrase${drafts.length === 1 ? '' : 's'} from sampled frames. Review and edit — not final.${note}`
            : `No phrases drafted from the sampled frames.${note} You can mark phrases manually.`,
        drafts,
      }
    } catch (err) {
      return {
        status: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'Analysis request failed (is the Netlify function deployed?)',
        drafts: [],
      }
    }
  },
}

export function getAnalysisProvider(): AnalysisProvider {
  return netlifyAnalysisProvider
}
