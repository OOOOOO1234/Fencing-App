import { config, hasAnalysisProvider, missingEnvMessage } from '../config'
import { ACTIONS } from '../../types'
import type { ActionName, Outcome } from '../../types'
import type { AnalysisProvider, AnalysisRequest, AnalysisResult } from './types'

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

/** Env-wired HTTP provider. Expects JSON { phrases: [{ timestamp, action, outcome, remark?, confidence? }] }. */
export const httpAnalysisProvider: AnalysisProvider = {
  id: 'http-env',
  label: 'External analysis API',
  isConfigured: hasAnalysisProvider,
  async analyze(request: AnalysisRequest): Promise<AnalysisResult> {
    if (!hasAnalysisProvider()) {
      return {
        status: 'needs_key',
        message: missingEnvMessage('analysis'),
        drafts: [],
      }
    }

    try {
      const response = await fetch(config.analysisApiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.analysisApiKey}`,
        },
        body: JSON.stringify({
          boutId: request.boutId,
          side: request.side,
          title: request.title,
          videoUrl: request.videoUrl ?? null,
          weapon: 'sabre',
          actions: ACTIONS,
        }),
      })

      if (!response.ok) {
        return {
          status: 'error',
          message: `Analysis API returned ${response.status}`,
          drafts: [],
        }
      }

      const data = (await response.json()) as { phrases?: unknown }
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

      return {
        status: 'ok',
        message: `Imported ${drafts.length} draft phrase${drafts.length === 1 ? '' : 's'}. Review and edit — AI drafts are not final.`,
        drafts,
      }
    } catch (err) {
      return {
        status: 'error',
        message: err instanceof Error ? err.message : 'Analysis request failed',
        drafts: [],
      }
    }
  },
}

export function getAnalysisProvider(): AnalysisProvider {
  return httpAnalysisProvider
}
