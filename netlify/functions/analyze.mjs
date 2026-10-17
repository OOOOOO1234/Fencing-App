/**
 * Server-side sabre phrase draft analysis.
 * Reads OPENAI_API_KEY (preferred), ANALYSIS_API_KEY, or VITE_ANALYSIS_API_KEY (transition only).
 * Never expose the key to the browser.
 *
 * Grounded in FIE sabre ROW (t.100–106) and official referee hand signals.
 * Sparse keyframes only — honest about limits.
 */

const ACTIONS = [
  'Simple attack',
  'Attack on the preparation',
  'Compound attack',
  'Beat attack',
  'Counterattack',
  'Parry-riposte',
  'Remise',
  'Point in line',
  'Preparation only',
]

const OUTCOMES = ['point_for', 'point_against', 'double', 'no_touch']

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json', ...cors },
    body: JSON.stringify(body),
  }
}

function getApiKey() {
  return (
    process.env.OPENAI_API_KEY?.trim() ||
    process.env.ANALYSIS_API_KEY?.trim() ||
    process.env.VITE_ANALYSIS_API_KEY?.trim() ||
    ''
  )
}

function parsePhrases(raw) {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const action = String(item.action ?? '')
    const outcome = String(item.outcome ?? '')
    const timestamp = Number(item.timestamp)
    if (!ACTIONS.includes(action) || !OUTCOMES.includes(outcome)) return []
    if (!Number.isFinite(timestamp) || timestamp < 0) return []
    const opponentRaw = item.opponentAction != null ? String(item.opponentAction) : ''
    const opponentAction = ACTIONS.includes(opponentRaw) ? opponentRaw : undefined
    return [
      {
        timestamp,
        action,
        opponentAction,
        outcome,
        refSignal:
          typeof item.refSignal === 'string' && item.refSignal.trim()
            ? item.refSignal.trim().slice(0, 120)
            : undefined,
        remark:
          typeof item.remark === 'string'
            ? item.remark
            : 'AI draft from sampled frames — verify against full phrase',
        confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
      },
    ]
  })
}

function extractJsonObject(text) {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1))
    }
    throw new Error('Model response was not valid JSON')
  }
}

const SYSTEM_PROMPT = [
  'You are a sabre fencing analyst labeling phrases from sparse still frames (not full video).',
  'Follow FIE sabre right-of-way (Technical Rules t.100–106): attack needs continuous threat;',
  'parry gives immediate riposte right; stop-hit must be in time before final movement;',
  'simultaneous conception → annul; point-in-line must be deflected properly (mere contact ≠ deflection).',
  'Prefer visible referee signals and scoreboard over guessing priority from blurry bodies:',
  '- Hand raised high on one side after Halt → award to that side.',
  '- Simultaneous / nothing / incorrect gestures → map carefully (simultaneous often → no_touch).',
  '- Scoring-box lights show contact; foil/sabre still need ROW — lights alone are not the award.',
  'For each phrase report BOTH fencers: action (analyzed side) and opponentAction (other side), same taxonomy.',
  'Be conservative. Omit phrases you cannot support. Reply with JSON only.',
].join(' ')

function buildUserPrompt(side, duration, actions) {
  return [
    `The fencer to analyze ("you") is on the ${side} side of the screen.`,
    `Video duration is about ${duration || 'unknown'} seconds.`,
    'Each image has a timestamp in seconds in its caption. Frames are sparse samples — not a continuous phrase film.',
    'Infer discrete phrases (exchanges). For EACH phrase determine:',
    '(1) action — what YOU did (exact taxonomy string)',
    '(2) opponentAction — what the OTHER fencer did (exact taxonomy string, when visible)',
    '(3) outcome — from YOUR perspective, using referee award when visible',
    '(4) refSignal — short note of what you saw (e.g. "ref hand up on left", "simultaneous signal", "scoreboard 3-2", "lights both; no clear ref")',
    `Allowed actions (exact strings): ${actions.join(' | ')}`,
    `Allowed outcomes (exact strings): ${OUTCOMES.join(' | ')}`,
    'point_for = touch awarded to analyzed fencer; point_against = awarded to opponent;',
    'double = both awarded (rare in sabre); no_touch = halt with no score / annulled simultaneous.',
    'Sabre notes: no flèche; hesitation/bent arm often loses attack; remises lose to immediate riposte.',
    'Timestamps must be within [0, duration] when duration > 0.',
    'Return ONLY JSON:',
    '{"phrases":[{"timestamp":number,"action":string,"opponentAction":string,"outcome":string,"refSignal":string,"confidence":number,"remark":string}]}',
    'opponentAction and refSignal may be omitted if not visible. confidence 0-1. No markdown.',
  ].join('\n')
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: cors, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed', phrases: [] })
  }

  const apiKey = getApiKey()
  if (!apiKey) {
    return json(503, {
      error:
        'Analysis key missing on server. Set OPENAI_API_KEY (preferred) in Netlify env for functions.',
      phrases: [],
    })
  }

  let payload
  try {
    payload = JSON.parse(event.body || '{}')
  } catch {
    return json(400, { error: 'Invalid JSON body', phrases: [] })
  }

  const side = payload.side === 'right' ? 'right' : 'left'
  const frames = Array.isArray(payload.frames) ? payload.frames : []
  const duration = Number(payload.duration) || 0
  const actions = Array.isArray(payload.actions) ? payload.actions : ACTIONS

  if (frames.length === 0) {
    return json(400, {
      error: 'No frames provided. Client must send sampled video keyframes.',
      phrases: [],
    })
  }

  if (frames.length > 8) {
    return json(400, { error: 'Too many frames (max 8).', phrases: [] })
  }

  const content = [
    {
      type: 'text',
      text: buildUserPrompt(side, duration, actions),
    },
  ]

  for (const frame of frames) {
    const timestamp = Number(frame.timestamp)
    const dataUrl = typeof frame.dataUrl === 'string' ? frame.dataUrl : ''
    if (!dataUrl.startsWith('data:image/') || !Number.isFinite(timestamp)) continue
    content.push({
      type: 'text',
      text: `Frame at t=${timestamp.toFixed(2)}s — look for fencers, referee hands/signals, lights, scoreboard.`,
    })
    content.push({
      type: 'image_url',
      image_url: { url: dataUrl, detail: 'low' },
    })
  }

  if (content.length < 3) {
    return json(400, { error: 'No valid frame images in request.', phrases: [] })
  }

  const model = process.env.OPENAI_ANALYSIS_MODEL?.trim() || 'gpt-4o-mini'
  const openaiTimeoutMs = Number(process.env.OPENAI_TIMEOUT_MS) || 20_000

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(openaiTimeoutMs),
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 1600,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content },
        ],
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      const message =
        data?.error?.message ||
        `OpenAI request failed (${response.status}). Check OPENAI_API_KEY and billing.`
      return json(502, { error: message, phrases: [] })
    }

    const text = data?.choices?.[0]?.message?.content
    if (typeof text !== 'string' || !text.trim()) {
      return json(502, { error: 'Empty model response', phrases: [] })
    }

    const parsed = extractJsonObject(text)
    let phrases = parsePhrases(parsed.phrases)
    if (duration > 0) {
      phrases = phrases.filter((p) => p.timestamp <= duration + 0.5)
    }
    phrases.sort((a, b) => a.timestamp - b.timestamp)

    return json(200, {
      phrases,
      meta: {
        model,
        frameCount: frames.length,
        note:
          'Drafts from sampled frames only. Prefer visible ref hand signals and scoreboard when present; ROW from stills is uncertain — review before trusting rates.',
      },
    })
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : ''
    if (name === 'TimeoutError' || name === 'AbortError') {
      return json(504, {
        error: `OpenAI timed out after ${Math.round(openaiTimeoutMs / 1000)}s. Try again or mark phrases manually.`,
        phrases: [],
      })
    }
    return json(500, {
      error: err instanceof Error ? err.message : 'Analysis failed',
      phrases: [],
    })
  }
}
