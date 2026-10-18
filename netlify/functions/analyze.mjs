/**
 * Server-side sabre phrase draft analysis.
 * Three signals (priority order):
 *   1) Referee hand gestures / award  → ground truth for outcome
 *   2) Audio loudness peaks           → likely Halt / call moments
 *   3) User side (left/right)         → who is "you" vs opponent
 * Body mechanics from frames are secondary — never override a clear ref award.
 *
 * Not a trained sabre classifier — prompt + vision model on sparse frames + cues.
 */

const ACTIONS = [
  'Simple attack',
  'Compound attack',
  'Attack on the preparation',
  'Beat attack',
  'Prise de fer',
  'Counterattack',
  'Counter-time',
  'Parry',
  'Riposte',
  'Parry-riposte',
  'Counter-riposte',
  'Remise',
  'Redoublement',
  'Reprise',
  'Point in line',
  'Preparation only',
  'No action',
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
            : 'AI draft — verify against ref call',
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

function formatAudioCues(cues) {
  if (!Array.isArray(cues) || cues.length === 0) {
    return 'No audio loudness peaks available (silent file or decode failed). Do not invent calls from silence.'
  }
  const lines = cues.slice(0, 12).map((c) => {
    const t = Number(c.timestamp)
    const loud = Number(c.loudness)
    if (!Number.isFinite(t)) return null
    const loudStr = Number.isFinite(loud) ? loud.toFixed(2) : '?'
    return `- t=${t.toFixed(2)}s loudness=${loudStr}`
  })
  return [
    'Audio loudness peaks (likely Halt / Touché / Attack / verbal calls — not speech transcription):',
    ...lines.filter(Boolean),
    'Prefer placing phrase timestamps near these peaks when frames also support a halt/award.',
  ].join('\n')
}

const SYSTEM_PROMPT = [
  'You are a sabre fencing analyst. You are NOT a trained pose classifier — reason from three signals in this priority:',
  '1) REFEREE (ground truth for what happened): hand raise on awarded side, simultaneous, nothing, incorrect/too-short, scoreboard digit change after Halt.',
  '2) AUDIO CUES: loudness peaks often mark Halt / Touché / Attack calls — align phrase times to peaks when consistent with frames.',
  '3) USER SIDE: the analyzed fencer is explicitly left or right on screen — never swap "you" and opponent.',
  'Then, and only then, infer actions from body/blade using FIE sabre ROW (t.100–106).',
  'Outcome must follow the referee award relative to the user side. Do not award from lights alone.',
  'Use exact action taxonomy strings. Be conservative. JSON only.',
].join(' ')

function buildUserPrompt(side, duration, actions, audioBlock) {
  const oppSide = side === 'left' ? 'right' : 'left'
  return [
    `USER IDENTITY: "you" = fencer on the ${side} side of the screen. Opponent = ${oppSide} side. Never reverse this.`,
    `Video duration ≈ ${duration || 'unknown'} seconds.`,
    '',
    'DECISION ORDER (required):',
    'A) From frames: find referee after Halt — which side gets the hand raise / simultaneous / nothing?',
    `   Map award: hand on ${side} → point_for; hand on ${oppSide} → point_against; simultaneous/nothing → no_touch (prefer).`,
    'B) Use audio peaks as candidate phrase times (Halt/call moments).',
    'C) Label YOUR action and opponentAction with the taxonomy — consistent with the awarded call and ROW,',
    '   not a vague guess from a single blurry pose.',
    '',
    audioBlock,
    '',
    'For EACH phrase return:',
    '(1) timestamp — prefer near an audio peak and/or ref signal frame',
    '(2) action — YOUR action (exact string)',
    '(3) opponentAction — OTHER fencer (exact string when known)',
    '(4) outcome — from YOUR perspective, driven by referee award',
    '(5) refSignal — short: e.g. "hand up left", "simultaneous", "nothing", "no ref visible"',
    `Allowed actions: ${actions.join(' | ')}`,
    `Allowed outcomes: ${OUTCOMES.join(' | ')}`,
    'Sabre: no flèche label; remises lose to immediate riposte; stop-hit must be in time (Counterattack).',
    'Timestamps in [0, duration] when duration > 0.',
    'Return ONLY JSON:',
    '{"phrases":[{"timestamp":number,"action":string,"opponentAction":string,"outcome":string,"refSignal":string,"confidence":number,"remark":string}]}',
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
  const audioCues = Array.isArray(payload.audioCues) ? payload.audioCues : []
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

  const audioBlock = formatAudioCues(audioCues)
  const content = [
    {
      type: 'text',
      text: buildUserPrompt(side, duration, actions, audioBlock),
    },
  ]

  for (const frame of frames) {
    const timestamp = Number(frame.timestamp)
    const dataUrl = typeof frame.dataUrl === 'string' ? frame.dataUrl : ''
    if (!dataUrl.startsWith('data:image/') || !Number.isFinite(timestamp)) continue
    content.push({
      type: 'text',
      text: `Frame at t=${timestamp.toFixed(2)}s — prioritize referee hands/signals, then scoreboard/lights, then fencers (${side}=you).`,
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
  const openaiTimeoutMs = Number(process.env.OPENAI_TIMEOUT_MS) || 22_000

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
        temperature: 0.15,
        max_tokens: 1800,
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
        audioCueCount: audioCues.length,
        note:
          'Drafts use ref gestures (ground truth for award) + audio peaks + your left/right side. Not a trained sabre classifier — review and Edit.',
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
