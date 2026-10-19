/**
 * Sabre Analyze — speech (Whisper) + denser frames + FIE-oriented prompt.
 * Priority: hands (award) > speech > vision. User side never swaps.
 * OPENAI_API_KEY server-only.
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
const REF_GESTURES = [
  'hand_you',
  'hand_them',
  'simultaneous',
  'nothing',
  'attack',
  'parry',
  'incorrect',
  'unknown',
]

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

function extractJsonObject(text) {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1))
    throw new Error('Model response was not valid JSON')
  }
}

function dataUrlToBuffer(dataUrl) {
  const m = /^data:([^;]+);base64,(.+)$/s.exec(dataUrl || '')
  if (!m) return null
  return { mime: m[1], buf: Buffer.from(m[2], 'base64') }
}

const CALL_RES = [
  { re: /\bhalt\b/i, label: 'Halt' },
  { re: /\btouch[eé]?\b/i, label: 'Touché' },
  { re: /\battack\b/i, label: 'Attack' },
  { re: /\briposte\b/i, label: 'Riposte' },
  { re: /\bcounter[- ]?attack\b|\barr[eê]t\b/i, label: 'Counter-attack' },
  { re: /\bparry\b|\bparade\b/i, label: 'Parry' },
  { re: /\bsimultaneous\b/i, label: 'Simultaneous' },
  { re: /\bnothing\b|\bno(?:\s+touch)?\b/i, label: 'Nothing' },
  { re: /\bremise\b/i, label: 'Remise' },
]

function labelsFromSpeech(text) {
  const out = []
  for (const { re, label } of CALL_RES) {
    if (re.test(text) && !out.includes(label)) out.push(label)
  }
  return out
}

async function whisperClip(apiKey, clip) {
  const parsed = dataUrlToBuffer(clip.dataUrl)
  if (!parsed || parsed.buf.length < 256) return null

  const form = new FormData()
  const blob = new Blob([parsed.buf], { type: parsed.mime || 'audio/wav' })
  form.append('file', blob, 'ref-call.wav')
  form.append('model', process.env.OPENAI_WHISPER_MODEL?.trim() || 'whisper-1')
  form.append('language', 'en')
  form.append(
    'prompt',
    'Fencing referee calls: Halt, Attack, Riposte, Counter-attack, Touché, Simultaneous, Nothing, Parry, Remise.',
  )

  const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body: form,
    signal: AbortSignal.timeout(12_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return { error: data?.error?.message || `Whisper ${res.status}`, timestamp: clip.timestamp }
  }
  const text = typeof data.text === 'string' ? data.text.trim() : ''
  return {
    timestamp: Number(clip.timestamp) || 0,
    text,
    labels: labelsFromSpeech(text),
  }
}

async function transcribeClips(apiKey, clips) {
  const limited = (Array.isArray(clips) ? clips : []).slice(0, 4)
  const results = await Promise.all(limited.map((c) => whisperClip(apiKey, c).catch((e) => ({
    error: e instanceof Error ? e.message : 'whisper failed',
    timestamp: c.timestamp,
  }))))
  return results.filter(Boolean)
}

function parsePhrases(raw) {
  if (!Array.isArray(raw)) return []
  return raw.flatMap((item) => {
    if (!item || typeof item !== 'object') return []
    const action = String(item.action ?? '')
    const outcome = String(item.outcome ?? '')
    const timestamp = Number(item.timestamp ?? item.tHalt ?? item.tStart)
    if (!ACTIONS.includes(action) || !OUTCOMES.includes(outcome)) return []
    if (!Number.isFinite(timestamp) || timestamp < 0) return []
    const opponentRaw = item.opponentAction != null ? String(item.opponentAction) : ''
    const refGesture = String(item.refGesture ?? 'unknown')
    const sources = Array.isArray(item.sources)
      ? item.sources.filter((s) => typeof s === 'string').slice(0, 6)
      : []
    return [
      {
        timestamp,
        tStart: Number.isFinite(Number(item.tStart)) ? Number(item.tStart) : undefined,
        tHalt: Number.isFinite(Number(item.tHalt)) ? Number(item.tHalt) : timestamp,
        action,
        opponentAction: ACTIONS.includes(opponentRaw) ? opponentRaw : undefined,
        outcome,
        refGesture: REF_GESTURES.includes(refGesture) ? refGesture : 'unknown',
        refWords:
          typeof item.refWords === 'string' ? item.refWords.trim().slice(0, 160) : undefined,
        refSignal:
          typeof item.refSignal === 'string' ? item.refSignal.trim().slice(0, 120) : undefined,
        sources,
        needsReview: Boolean(item.needsReview),
        remark:
          typeof item.remark === 'string'
            ? item.remark
            : 'AI draft — verify ref call',
        confidence: typeof item.confidence === 'number' ? item.confidence : undefined,
      },
    ]
  })
}

/** Server-side rules: hands win for outcome. */
function applyRules(phrases) {
  return phrases.map((p) => {
    const sources = new Set(p.sources || [])
    let { outcome, needsReview } = p
    const flags = []

    if (p.refGesture === 'hand_you' && outcome !== 'point_for') {
      outcome = 'point_for'
      flags.push('hands→point_for')
      sources.add('hands')
      sources.add('rules')
    }
    if (p.refGesture === 'hand_them' && outcome !== 'point_against') {
      outcome = 'point_against'
      flags.push('hands→point_against')
      sources.add('hands')
      sources.add('rules')
    }
    if (
      (p.refGesture === 'simultaneous' || p.refGesture === 'nothing' || p.refGesture === 'incorrect') &&
      outcome !== 'no_touch'
    ) {
      outcome = 'no_touch'
      flags.push('hands→no_touch')
      sources.add('hands')
      sources.add('rules')
    }
    if (p.refWords && /\bsimultaneous\b/i.test(p.refWords) && outcome !== 'no_touch') {
      needsReview = true
      flags.push('speech simul vs score')
      sources.add('rules')
    }
    const renewals = ['Remise', 'Redoublement', 'Reprise']
    const ripostes = ['Riposte', 'Parry-riposte', 'Counter-riposte']
    if (
      outcome === 'point_against' &&
      renewals.includes(p.action) &&
      ripostes.includes(p.opponentAction)
    ) {
      needsReview = true
      flags.push('renewal vs riposte')
      sources.add('rules')
    }

    return {
      ...p,
      outcome,
      needsReview,
      sources: [...sources],
      remark: flags.length
        ? `${p.remark || 'AI draft'} · Rules: ${flags.join('; ')}`
        : p.remark,
    }
  })
}

const SYSTEM_PROMPT = [
  'You are a sabre fencing analyst. NOT a trained pose classifier.',
  'PRIORITY: (1) Referee HAND gestures decide the award/outcome relative to user side.',
  '(2) SPEECH transcripts (Whisper) — what the ref said — lock timing and call type.',
  '(3) VISION of fencers proposes actions only; never override a clear hand award.',
  'User side is explicit left/right — never swap you vs opponent.',
  'FIE sabre ROW t.100–106. JSON only.',
].join(' ')

function buildUserPrompt(side, duration, actions, speechBlock, fewShotBlock) {
  const opp = side === 'left' ? 'right' : 'left'
  return [
    `USER: "you" = ${side} side of screen. Opponent = ${opp}. Never reverse.`,
    `Duration ≈ ${duration || 'unknown'}s.`,
    '',
    'SPEECH (Whisper on loudness clips — may be empty/noisy; be honest):',
    speechBlock,
    '',
    'PRIOR USER CORRECTIONS (few-shot; prefer matching patterns when similar):',
    fewShotBlock,
    '',
    'DECISION ORDER:',
    'A) From frames marked role=ref: which side gets hand raise / simultaneous / nothing?',
    `   hand on ${side} → refGesture=hand_you, outcome=point_for; on ${opp} → hand_them, point_against.`,
    'B) Align phrase tHalt to speech timestamps / Halt moments when consistent.',
    'C) Label actions from taxonomy consistent with award + ROW; set sources array.',
    'D) Set needsReview=true on contradictions (e.g. renewal vs immediate riposte award).',
    '',
    `Actions: ${actions.join(' | ')}`,
    `Outcomes: ${OUTCOMES.join(' | ')}`,
    `refGesture: ${REF_GESTURES.join(' | ')}`,
    'Return ONLY JSON:',
    '{"phrases":[{"timestamp":number,"tStart":number,"tHalt":number,"action":string,"opponentAction":string,"outcome":string,"refGesture":string,"refWords":string,"refSignal":string,"sources":["hands","speech","vision"],"needsReview":boolean,"confidence":number,"remark":string}]}',
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
      error: 'Analysis key missing. Set OPENAI_API_KEY in Netlify env for functions.',
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
  const audioClips = Array.isArray(payload.audioClips) ? payload.audioClips : []
  const fewShot = Array.isArray(payload.fewShot) ? payload.fewShot : []
  const duration = Number(payload.duration) || 0
  const actions = Array.isArray(payload.actions) ? payload.actions : ACTIONS

  if (frames.length === 0) {
    return json(400, { error: 'No frames provided.', phrases: [] })
  }
  if (frames.length > 10) {
    return json(400, { error: 'Too many frames (max 10).', phrases: [] })
  }

  // Phase 1 — speech
  let transcripts = []
  let speechNote = 'No audio clips — speech skipped (peaks-only or decode failed).'
  try {
    transcripts = await transcribeClips(apiKey, audioClips)
    const ok = transcripts.filter((t) => t.text)
    speechNote = ok.length
      ? ok.map((t) => `t=${Number(t.timestamp).toFixed(2)}s: "${t.text}" [${(t.labels || []).join(', ')}]`).join('\n')
      : transcripts.some((t) => t.error)
        ? `Whisper errors: ${transcripts.map((t) => t.error).filter(Boolean).join('; ')}`
        : 'Whisper returned empty text (quiet / unclear audio).'
  } catch (err) {
    speechNote = `Speech failed: ${err instanceof Error ? err.message : 'error'}`
  }

  const fewShotBlock =
    fewShot.length === 0
      ? 'None yet.'
      : fewShot
          .slice(0, 6)
          .map(
            (e, i) =>
              `${i + 1}. you=${e.action}` +
              (e.opponentAction ? ` opp=${e.opponentAction}` : '') +
              ` outcome=${e.outcome}` +
              (e.refWords ? ` said="${String(e.refWords).slice(0, 40)}"` : ''),
          )
          .join('\n')

  const peaksLine =
    audioCues.length > 0
      ? `Loudness peaks: ${audioCues
          .slice(0, 10)
          .map((c) => `t=${Number(c.timestamp).toFixed(2)}`)
          .join(', ')}`
      : 'No loudness peaks.'

  const content = [
    {
      type: 'text',
      text: buildUserPrompt(
        side,
        duration,
        actions,
        `${peaksLine}\n${speechNote}`,
        fewShotBlock,
      ),
    },
  ]

  for (const frame of frames) {
    const timestamp = Number(frame.timestamp)
    const dataUrl = typeof frame.dataUrl === 'string' ? frame.dataUrl : ''
    if (!dataUrl.startsWith('data:image/') || !Number.isFinite(timestamp)) continue
    const role = frame.role === 'ref' ? 'ref' : 'piste'
    content.push({
      type: 'text',
      text: `Frame t=${timestamp.toFixed(2)}s role=${role} — ${
        role === 'ref'
          ? 'look for referee hands/signals/scoreboard'
          : 'look for fencing phrase structure'
      } (${side}=you).`,
    })
    content.push({
      type: 'image_url',
      image_url: { url: dataUrl, detail: 'low' },
    })
  }

  if (content.length < 3) {
    return json(400, { error: 'No valid frame images.', phrases: [] })
  }

  const model = process.env.OPENAI_ANALYSIS_MODEL?.trim() || 'gpt-4o-mini'
  const openaiTimeoutMs = Number(process.env.OPENAI_TIMEOUT_MS) || 18_000

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
        temperature: 0.12,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content },
        ],
      }),
    })

    const data = await response.json().catch(() => ({}))
    if (!response.ok) {
      return json(502, {
        error: data?.error?.message || `OpenAI failed (${response.status})`,
        phrases: [],
        meta: { speechNote, transcripts },
      })
    }

    const text = data?.choices?.[0]?.message?.content
    if (typeof text !== 'string' || !text.trim()) {
      return json(502, { error: 'Empty model response', phrases: [], meta: { speechNote } })
    }

    const parsed = extractJsonObject(text)
    let phrases = parsePhrases(parsed.phrases)

    // Attach nearest Whisper text if model omitted refWords
    for (const p of phrases) {
      if (p.refWords) continue
      const near = transcripts
        .filter((t) => t.text)
        .sort(
          (a, b) =>
            Math.abs(a.timestamp - p.timestamp) - Math.abs(b.timestamp - p.timestamp),
        )[0]
      if (near && Math.abs(near.timestamp - p.timestamp) < 2.5) {
        p.refWords = near.text.slice(0, 160)
        p.sources = [...new Set([...(p.sources || []), 'speech'])]
      }
    }

    phrases = applyRules(phrases)
    if (duration > 0) phrases = phrases.filter((p) => p.timestamp <= duration + 0.5)
    phrases.sort((a, b) => a.timestamp - b.timestamp)

    return json(200, {
      phrases,
      meta: {
        model,
        frameCount: frames.length,
        audioCueCount: audioCues.length,
        whisperCount: transcripts.filter((t) => t.text).length,
        transcripts,
        speechNote,
        note:
          'Hands decide award; Whisper + vision propose timing/actions. Not a trained sabre classifier — Edit when wrong.',
      },
    })
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : ''
    if (name === 'TimeoutError' || name === 'AbortError') {
      return json(504, {
        error: `OpenAI timed out after ${Math.round(openaiTimeoutMs / 1000)}s.`,
        phrases: [],
        meta: { speechNote },
      })
    }
    return json(500, {
      error: err instanceof Error ? err.message : 'Analysis failed',
      phrases: [],
    })
  }
}
