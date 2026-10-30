/**
 * Sabre Analyze — Whisper + optional Jev/Laya gate + rare gpt-4o-mini vision.
 * Priority: hands (award) > speech > vision/Jev. User side never swaps.
 * OPENAI_API_KEY server-only. JEV_API_URL + JEV_API_KEY optional (SystemOne).
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

/** Speech call labels → canonical action (lexicon / aliases). */
const SPEECH_TO_ACTION = {
  Halt: null,
  Touché: 'Simple attack',
  Attack: 'Simple attack',
  Riposte: 'Riposte',
  'Counter-riposte': 'Counter-riposte',
  'Counter-attack': 'Counterattack',
  Parry: 'Parry',
  Simultaneous: 'No action',
  Nothing: 'No action',
  Remise: 'Remise',
  Redoublement: 'Redoublement',
  Reprise: 'Reprise',
  Incorrect: 'No action',
  'Point in line': 'Point in line',
}

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

function getJevConfig() {
  const rawUrl = process.env.JEV_API_URL?.trim() || ''
  const apiKey = process.env.JEV_API_KEY?.trim() || ''
  const escalateThreshold = Number(process.env.JEV_ESCALATE_THRESHOLD)
  const labelMinProb = Number(process.env.JEV_LABEL_MIN_PROB)
  const model = process.env.JEV_MODEL?.trim() || 'jev-latest'
  return {
    rawUrl,
    apiKey,
    escalateThreshold: Number.isFinite(escalateThreshold) ? escalateThreshold : 0.35,
    labelMinProb: Number.isFinite(labelMinProb) ? labelMinProb : 0.45,
    model,
    enabled: Boolean(rawUrl),
  }
}

/** Accept full …/v1/systemone or a host/base URL. */
function resolveSystemOneUrl(rawUrl) {
  if (!rawUrl) return ''
  const trimmed = rawUrl.replace(/\/+$/, '')
  if (/\/v1\/systemone$/i.test(trimmed)) return trimmed
  return `${trimmed}/v1/systemone`
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
  { re: /\bredouble(?:ment)?\b/i, label: 'Redoublement' },
  { re: /\breprise\b/i, label: 'Reprise' },
  { re: /\bpoint in line\b|\bin line\b/i, label: 'Point in line' },
]

function labelsFromSpeech(text) {
  const out = []
  for (const { re, label } of CALL_RES) {
    if (re.test(text) && !out.includes(label)) out.push(label)
  }
  return out
}

function gestureHintFromSpeech(text) {
  if (/\bsimultaneous\b|\bsimul\b/i.test(text)) return 'simultaneous'
  if (/\bnothing\b|\bno(?:\s+touch)?\b/i.test(text)) return 'nothing'
  if (/\bincorrect\b/i.test(text)) return 'incorrect'
  if (/\briposte\b|\bparry\b|\bparade\b/i.test(text)) return 'parry'
  if (/\battack\b|\bremise\b|\bcounter/i.test(text)) return 'attack'
  return undefined
}

function actionFromSpeechLabels(labels) {
  for (const label of labels) {
    const mapped = SPEECH_TO_ACTION[label]
    if (mapped && ACTIONS.includes(mapped)) return mapped
  }
  return null
}

function outcomeFromGesture(gesture) {
  if (gesture === 'hand_you') return 'point_for'
  if (gesture === 'hand_them') return 'point_against'
  if (gesture === 'simultaneous' || gesture === 'nothing' || gesture === 'incorrect') {
    return 'no_touch'
  }
  return null
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
    /** Rough clip length from WAV byte size (16-bit mono ~32kB/s) — order-of-magnitude only. */
    approxSeconds: Math.max(0.5, parsed.buf.length / 32_000),
  }
}

async function transcribeClips(apiKey, clips) {
  const limited = (Array.isArray(clips) ? clips : []).slice(0, 4)
  const results = await Promise.all(
    limited.map((c) =>
      whisperClip(apiKey, c).catch((e) => ({
        error: e instanceof Error ? e.message : 'whisper failed',
        timestamp: c.timestamp,
      })),
    ),
  )
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
      ? item.sources.filter((s) => typeof s === 'string').slice(0, 8)
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
          typeof item.remark === 'string' ? item.remark : 'AI draft — verify ref call',
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
      (p.refGesture === 'simultaneous' ||
        p.refGesture === 'nothing' ||
        p.refGesture === 'incorrect') &&
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

/** Rough OpenAI $ — Whisper ~$0.006/min; gpt-4o-mini text+vision ballpark. */
function estimateCostUsd({ whisperSeconds, gptInputTokens, gptOutputTokens, gptVisionFrames }) {
  const whisperUsd = (whisperSeconds / 60) * 0.006
  // low-detail image ≈ 85 tokens; text tokens separate
  const visionTokens = gptVisionFrames * 85
  const inTok = (gptInputTokens || 0) + visionTokens
  const outTok = gptOutputTokens || 0
  const gptUsd = (inTok / 1_000_000) * 0.15 + (outTok / 1_000_000) * 0.6
  return {
    whisperUsd: Number(whisperUsd.toFixed(5)),
    gptUsd: Number(gptUsd.toFixed(5)),
    totalUsd: Number((whisperUsd + gptUsd).toFixed(5)),
    note: 'Rough OpenAI list-price estimate; Jev/Laya billed separately if configured.',
  }
}

/**
 * POST SystemOne-compatible /v1/systemone (Jev / Laya / layahost).
 * Returns { ok, answers, usage, model, error?, latencyMs }.
 */
async function callSystemOne({ url, apiKey, model, state, questions, timeoutMs = 8_000 }) {
  const headers = { 'Content-Type': 'application/json' }
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`
  const started = Date.now()
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({ model, state, questions, lang: 'en', cache: false }),
    })
    const data = await res.json().catch(() => ({}))
    const latencyMs = Date.now() - started
    if (!res.ok) {
      const detail =
        typeof data?.detail === 'string'
          ? data.detail
          : Array.isArray(data?.detail)
            ? data.detail.map((d) => d.msg || JSON.stringify(d)).join('; ')
            : data?.error?.message || `SystemOne ${res.status}`
      return { ok: false, error: detail, latencyMs, answers: null, usage: null, model: null }
    }
    return {
      ok: true,
      answers: data.answers || {},
      usage: data.usage || null,
      model: data.model || model,
      latencyMs,
      meta: data.meta || null,
    }
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'SystemOne unreachable',
      latencyMs: Date.now() - started,
      answers: null,
      usage: null,
      model: null,
    }
  }
}

function buildGateState({ side, duration, audioCues, transcripts, fewShot }) {
  const okSpeech = transcripts.filter((t) => t.text)
  return {
    sport: 'sabre',
    task: 'referee_phrase_gate',
    side,
    durationSec: duration || null,
    loudnessPeaks: audioCues.slice(0, 10).map((c) => ({
      t: Number(c.timestamp),
      level: c.level != null ? Number(c.level) : undefined,
    })),
    whisper: okSpeech.map((t) => ({
      t: t.timestamp,
      text: t.text,
      labels: t.labels || [],
    })),
    fewShotCount: Array.isArray(fewShot) ? fewShot.length : 0,
    notes:
      'Escalate to GPT vision when speech is empty/noisy, hands unclear, or action ambiguous. Skip when Whisper labels clearly map to a sabre action and agree with gesture hints.',
  }
}

function speechHandsAgree(transcripts) {
  const ok = transcripts.filter((t) => t.text)
  if (ok.length === 0) return { agree: false, reason: 'no_speech' }
  const withAction = ok.filter((t) => actionFromSpeechLabels(t.labels || []))
  if (withAction.length === 0) return { agree: false, reason: 'no_actionable_labels' }
  // Gesture hints from speech should not contradict each other across clips
  const gestures = [
    ...new Set(ok.map((t) => gestureHintFromSpeech(t.text)).filter(Boolean)),
  ]
  const conflicting =
    gestures.includes('simultaneous') &&
    (gestures.includes('attack') || gestures.includes('parry'))
  if (conflicting) return { agree: false, reason: 'conflicting_gesture_hints' }
  return {
    agree: true,
    reason: 'speech_labels_map',
    sampleAction: actionFromSpeechLabels(withAction[0].labels || []),
  }
}

function actionCriteria() {
  const criteria = {}
  for (const a of ACTIONS) criteria[a] = null
  return criteria
}

/** J2: label easy phrases via SystemOne choice over 17 actions (text state; no VL required). */
async function jevLabelPhrases({ jev, stateBase, transcripts, audioCues, side }) {
  const url = resolveSystemOneUrl(jev.rawUrl)
  const peaks = audioCues.length
    ? audioCues.slice(0, 6)
    : transcripts.filter((t) => t.text).map((t) => ({ timestamp: t.timestamp }))
  const slots = peaks.slice(0, 4)
  if (slots.length === 0) {
    return { phrases: [], used: false, error: 'no_peaks_or_speech', escalateAnyway: true }
  }

  const questions = {}
  for (let i = 0; i < slots.length; i++) {
    questions[`your_action_${i}`] = {
      type: 'choice',
      instructions: `For phrase slot ${i} (near Halt/peak), what is YOUR (${side}) sabre action?`,
      criteria: actionCriteria(),
    }
    questions[`opp_action_${i}`] = {
      type: 'choice',
      instructions: `For phrase slot ${i}, what is the OPPONENT sabre action?`,
      criteria: actionCriteria(),
    }
  }

  const result = await callSystemOne({
    url,
    apiKey: jev.apiKey,
    model: jev.model,
    state: {
      ...stateBase,
      task: 'label_sabre_phrases',
      slots: slots.map((s, i) => {
        const ts = Number(s.timestamp)
        const near = transcripts
          .filter((t) => t.text)
          .sort((a, b) => Math.abs(a.timestamp - ts) - Math.abs(b.timestamp - ts))[0]
        return {
          index: i,
          t: ts,
          refWords: near && Math.abs(near.timestamp - ts) < 2.5 ? near.text : undefined,
          labels: near?.labels || [],
        }
      }),
    },
    questions,
    timeoutMs: 10_000,
  })

  if (!result.ok) {
    return { phrases: [], used: false, error: result.error, escalateAnyway: true, result }
  }

  const phrases = []
  let anyLow = false
  for (let i = 0; i < slots.length; i++) {
    const ya = result.answers[`your_action_${i}`]
    const oa = result.answers[`opp_action_${i}`]
    const yourChoice = ya?.choice
    const oppChoice = oa?.choice
    const yourProb =
      typeof ya?.probabilities?.[yourChoice] === 'number'
        ? ya.probabilities[yourChoice]
        : typeof ya?.confidence === 'number'
          ? ya.confidence
          : 0
    const oppProb =
      typeof oa?.probabilities?.[oppChoice] === 'number'
        ? oa.probabilities[oppChoice]
        : typeof oa?.confidence === 'number'
          ? oa.confidence
          : 0
    if (yourProb < jev.labelMinProb) {
      anyLow = true
      continue
    }
    const ts = Number(slots[i].timestamp) || 0
    const near = transcripts
      .filter((t) => t.text)
      .sort((a, b) => Math.abs(a.timestamp - ts) - Math.abs(b.timestamp - ts))[0]
    const refWords =
      near && Math.abs(near.timestamp - ts) < 2.5 ? near.text.slice(0, 160) : undefined
    const labels = near?.labels || []
    let action = ACTIONS.includes(yourChoice) ? yourChoice : actionFromSpeechLabels(labels)
    if (!action) action = 'Simple attack'
    const opponentAction = ACTIONS.includes(oppChoice) && oppProb >= jev.labelMinProb
      ? oppChoice
      : undefined
    const gHint = refWords ? gestureHintFromSpeech(refWords) : undefined
    let refGesture = gHint && REF_GESTURES.includes(gHint) ? gHint : 'unknown'
    let outcome = outcomeFromGesture(refGesture) || 'point_for'
    if (labels.includes('Simultaneous') || labels.includes('Nothing')) {
      outcome = 'no_touch'
      refGesture = labels.includes('Simultaneous') ? 'simultaneous' : 'nothing'
    }
    phrases.push({
      timestamp: ts,
      tHalt: ts,
      tStart: Math.max(0, ts - 1.2),
      action,
      opponentAction,
      outcome,
      refGesture,
      refWords,
      sources: ['jev', 'speech'].filter(Boolean),
      needsReview: yourProb < 0.6,
      confidence: yourProb,
      remark: `Jev draft (p=${yourProb.toFixed(2)}) — verify ref call`,
    })
  }

  return {
    phrases,
    used: true,
    escalateAnyway: anyLow || phrases.length === 0,
    result,
    lowConfidence: anyLow,
  }
}

/** Lexicon-only drafts when J1 skips GPT and J2 unavailable/low. */
function lexiconDrafts(transcripts, audioCues) {
  const slots =
    transcripts.filter((t) => t.text).length > 0
      ? transcripts.filter((t) => t.text)
      : audioCues.slice(0, 4).map((c) => ({ timestamp: c.timestamp, text: '', labels: [] }))

  return slots.slice(0, 4).flatMap((t) => {
    const labels = t.labels || labelsFromSpeech(t.text || '')
    const action = actionFromSpeechLabels(labels) || 'Simple attack'
    const gHint = t.text ? gestureHintFromSpeech(t.text) : undefined
    let refGesture = gHint || 'unknown'
    let outcome = outcomeFromGesture(refGesture) || 'point_for'
    if (labels.includes('Simultaneous') || labels.includes('Nothing')) {
      outcome = 'no_touch'
      refGesture = labels.includes('Simultaneous') ? 'simultaneous' : 'nothing'
    }
    const ts = Number(t.timestamp) || 0
    return [
      {
        timestamp: ts,
        tHalt: ts,
        tStart: Math.max(0, ts - 1.2),
        action,
        outcome,
        refGesture,
        refWords: t.text ? String(t.text).slice(0, 160) : undefined,
        sources: t.text ? ['speech'] : ['audio_peak'],
        needsReview: !t.text || !actionFromSpeechLabels(labels),
        confidence: actionFromSpeechLabels(labels) ? 0.55 : 0.3,
        remark: 'Lexicon draft (GPT skipped) — verify ref call',
      },
    ]
  })
}

async function runGptVision({
  apiKey,
  model,
  side,
  duration,
  actions,
  frames,
  speechBlock,
  fewShotBlock,
  openaiTimeoutMs,
}) {
  const content = [
    {
      type: 'text',
      text: buildUserPrompt(side, duration, actions, speechBlock, fewShotBlock),
    },
  ]

  let visionFrames = 0
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
    visionFrames += 1
  }

  if (visionFrames === 0) {
    return { ok: false, error: 'No valid frame images.', status: 400 }
  }

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
    return {
      ok: false,
      error: data?.error?.message || `OpenAI failed (${response.status})`,
      status: 502,
      data,
    }
  }

  const text = data?.choices?.[0]?.message?.content
  if (typeof text !== 'string' || !text.trim()) {
    return { ok: false, error: 'Empty model response', status: 502, data }
  }

  const usage = data.usage || {}
  return {
    ok: true,
    text,
    visionFrames,
    promptTokens: usage.prompt_tokens || 0,
    completionTokens: usage.completion_tokens || 0,
    data,
  }
}

function attachWhisperWords(phrases, transcripts) {
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
  return phrases
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
  const jev = getJevConfig()

  if (frames.length === 0) {
    return json(400, { error: 'No frames provided.', phrases: [] })
  }
  if (frames.length > 10) {
    return json(400, { error: 'Too many frames (max 10).', phrases: [] })
  }

  // ——— J0 cost counters ———
  const costLog = {
    phraseCount: 0,
    whisperClips: 0,
    whisperOk: 0,
    whisperSecondsApprox: 0,
    gptVisionCalls: 0,
    gptVisionFrames: 0,
    gptPromptTokens: 0,
    gptCompletionTokens: 0,
    jevEscalateCalls: 0,
    jevLabelCalls: 0,
    jevSkippedGpt: false,
    path: 'gpt', // gpt | jev_lexicon | jev_label | jev_fallback_gpt
    escalateProb: null,
    estimate: null,
  }

  // Phase 1 — speech (always; keep Whisper)
  let transcripts = []
  let speechNote = 'No audio clips — speech skipped (peaks-only or decode failed).'
  try {
    transcripts = await transcribeClips(apiKey, audioClips)
    costLog.whisperClips = transcripts.length
    const ok = transcripts.filter((t) => t.text)
    costLog.whisperOk = ok.length
    costLog.whisperSecondsApprox = Number(
      transcripts.reduce((s, t) => s + (t.approxSeconds || 0), 0).toFixed(2),
    )
    speechNote = ok.length
      ? ok
          .map(
            (t) =>
              `t=${Number(t.timestamp).toFixed(2)}s: "${t.text}" [${(t.labels || []).join(', ')}]`,
          )
          .join('\n')
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

  const speechBlock = `${peaksLine}\n${speechNote}`
  const model = process.env.OPENAI_ANALYSIS_MODEL?.trim() || 'gpt-4o-mini'
  const openaiTimeoutMs = Number(process.env.OPENAI_TIMEOUT_MS) || 18_000

  const stateBase = buildGateState({ side, duration, audioCues, transcripts, fewShot })
  const agree = speechHandsAgree(transcripts)

  let skipGpt = false
  let jevGateMeta = null

  // ——— J1 escalate gate ———
  if (jev.enabled) {
    const url = resolveSystemOneUrl(jev.rawUrl)
    costLog.jevEscalateCalls = 1
    const gate = await callSystemOne({
      url,
      apiKey: jev.apiKey,
      model: jev.model,
      state: stateBase,
      questions: {
        escalate_to_gpt: {
          type: 'noul',
          instructions:
            'Should we escalate this sabre bout segment to GPT vision? True if speech is empty/noisy, action ambiguous, or hands unclear. False if Whisper labels clearly map to a sabre action and timing peaks align.',
          criteria: {
            true: 'Need GPT vision — unclear speech, conflicting cues, or hard phrase',
            false: 'Skip GPT — speech/lexicon enough for a draft',
          },
        },
        needs_review: {
          type: 'noul',
          instructions: 'Should a human review the drafted phrases carefully?',
        },
      },
    })

    jevGateMeta = {
      ok: gate.ok,
      error: gate.error || null,
      latencyMs: gate.latencyMs,
      model: gate.model,
      endpoint: url,
      escalateThreshold: jev.escalateThreshold,
    }

    if (!gate.ok) {
      // Graceful fallback: full GPT
      costLog.path = 'jev_fallback_gpt'
      console.info('[analyze/cost]', JSON.stringify({ ...costLog, jevError: gate.error }))
    } else {
      const escalateProb = Number(gate.answers?.escalate_to_gpt?.noul)
      costLog.escalateProb = Number.isFinite(escalateProb) ? escalateProb : null
      jevGateMeta.escalateProb = costLog.escalateProb
      jevGateMeta.needsReviewProb = Number(gate.answers?.needs_review?.noul)
      jevGateMeta.usage = gate.usage
      jevGateMeta.agree = agree

      if (
        Number.isFinite(escalateProb) &&
        escalateProb < jev.escalateThreshold &&
        agree.agree
      ) {
        skipGpt = true
        costLog.jevSkippedGpt = true
      } else {
        costLog.path = 'gpt'
      }
    }
  } else {
    // No JEV_API_URL → today's full GPT path
    costLog.path = 'gpt'
  }

  let phrases = []

  try {
    if (skipGpt) {
      // ——— J2: try Jev labels; else lexicon ———
      costLog.jevLabelCalls = 1
      const labeled = await jevLabelPhrases({
        jev,
        stateBase,
        transcripts,
        audioCues,
        side,
      })

      if (labeled.used && labeled.phrases.length > 0 && !labeled.escalateAnyway) {
        phrases = labeled.phrases
        costLog.path = 'jev_label'
        jevGateMeta = {
          ...(jevGateMeta || {}),
          label: {
            ok: true,
            count: labeled.phrases.length,
            lowConfidence: labeled.lowConfidence,
            usage: labeled.result?.usage,
            model: labeled.result?.model,
          },
        }
      } else if (labeled.escalateAnyway && labeled.used === false) {
        // Label call failed → fall back to GPT (graceful)
        skipGpt = false
        costLog.path = 'jev_fallback_gpt'
        costLog.jevSkippedGpt = false
        jevGateMeta = {
          ...(jevGateMeta || {}),
          label: { ok: false, error: labeled.error, escalateAnyway: true },
        }
      } else if (labeled.escalateAnyway && labeled.phrases.length === 0) {
        // Low confidence on all → escalate to GPT
        skipGpt = false
        costLog.path = 'jev_fallback_gpt'
        costLog.jevSkippedGpt = false
        jevGateMeta = {
          ...(jevGateMeta || {}),
          label: { ok: true, escalateAnyway: true, reason: 'low_label_prob' },
        }
      } else if (labeled.phrases.length > 0) {
        // Partial: keep labeled; do not GPT (still savings)
        phrases = labeled.phrases
        costLog.path = 'jev_label'
      } else {
        phrases = lexiconDrafts(transcripts, audioCues)
        costLog.path = 'jev_lexicon'
      }
    }

    if (!skipGpt) {
      const gpt = await runGptVision({
        apiKey,
        model,
        side,
        duration,
        actions,
        frames,
        speechBlock,
        fewShotBlock,
        openaiTimeoutMs,
      })
      if (!gpt.ok) {
        costLog.estimate = estimateCostUsd({
          whisperSeconds: costLog.whisperSecondsApprox,
          gptInputTokens: 0,
          gptOutputTokens: 0,
          gptVisionFrames: 0,
        })
        console.info('[analyze/cost]', JSON.stringify({ ...costLog, error: gpt.error }))
        return json(gpt.status || 502, {
          error: gpt.error,
          phrases: [],
          meta: { speechNote, transcripts, cost: costLog, jev: jevGateMeta },
        })
      }
      costLog.gptVisionCalls = 1
      costLog.gptVisionFrames = gpt.visionFrames
      costLog.gptPromptTokens = gpt.promptTokens
      costLog.gptCompletionTokens = gpt.completionTokens
      if (costLog.path !== 'jev_fallback_gpt') costLog.path = 'gpt'

      const parsed = extractJsonObject(gpt.text)
      phrases = parsePhrases(parsed.phrases)
    }

    phrases = attachWhisperWords(phrases, transcripts)
    phrases = applyRules(phrases)
    if (duration > 0) phrases = phrases.filter((p) => p.timestamp <= duration + 0.5)
    phrases.sort((a, b) => a.timestamp - b.timestamp)
    costLog.phraseCount = phrases.length
    costLog.estimate = estimateCostUsd({
      whisperSeconds: costLog.whisperSecondsApprox,
      gptInputTokens: costLog.gptPromptTokens,
      gptOutputTokens: costLog.gptCompletionTokens,
      gptVisionFrames: costLog.gptVisionFrames,
    })

    // Internal note for operators (also in Netlify function logs)
    console.info(
      '[analyze/cost]',
      JSON.stringify({
        path: costLog.path,
        phrases: costLog.phraseCount,
        whisperOk: costLog.whisperOk,
        whisperSec: costLog.whisperSecondsApprox,
        gptCalls: costLog.gptVisionCalls,
        gptFrames: costLog.gptVisionFrames,
        escalateProb: costLog.escalateProb,
        skippedGpt: costLog.jevSkippedGpt,
        estimateUsd: costLog.estimate?.totalUsd,
      }),
    )

    const pathNote =
      costLog.path === 'jev_label'
        ? 'Jev labeled; GPT vision skipped.'
        : costLog.path === 'jev_lexicon'
          ? 'Lexicon draft; GPT vision skipped.'
          : costLog.path === 'jev_fallback_gpt'
            ? 'Jev unreachable or low confidence — full GPT.'
            : jev.enabled
              ? 'GPT vision used (escalate gate).'
              : 'GPT vision used (JEV_API_URL unset).'

    return json(200, {
      phrases,
      meta: {
        model: costLog.gptVisionCalls ? model : costLog.path.startsWith('jev') ? 'jev/laya' : model,
        frameCount: frames.length,
        audioCueCount: audioCues.length,
        whisperCount: costLog.whisperOk,
        transcripts,
        speechNote,
        cost: costLog,
        jev: jevGateMeta,
        note: `${pathNote} Hands decide award; Whisper + vision/Jev propose timing/actions. Not a trained sabre classifier — Edit when wrong.`,
      },
    })
  } catch (err) {
    const name = err && typeof err === 'object' && 'name' in err ? String(err.name) : ''
    costLog.estimate = estimateCostUsd({
      whisperSeconds: costLog.whisperSecondsApprox,
      gptInputTokens: costLog.gptPromptTokens,
      gptOutputTokens: costLog.gptCompletionTokens,
      gptVisionFrames: costLog.gptVisionFrames,
    })
    console.info('[analyze/cost]', JSON.stringify({ ...costLog, error: String(err) }))
    if (name === 'TimeoutError' || name === 'AbortError') {
      return json(504, {
        error: `OpenAI timed out after ${Math.round(openaiTimeoutMs / 1000)}s.`,
        phrases: [],
        meta: { speechNote, cost: costLog, jev: jevGateMeta },
      })
    }
    return json(500, {
      error: err instanceof Error ? err.message : 'Analysis failed',
      phrases: [],
      meta: { cost: costLog, jev: jevGateMeta },
    })
  }
}
