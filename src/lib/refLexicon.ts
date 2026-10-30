/** FIE Gestes et Mots + English call lexicon for speech → structured ref fields. */

export const REF_GESTURES = [
  'hand_you',
  'hand_them',
  'simultaneous',
  'nothing',
  'attack',
  'parry',
  'incorrect',
  'unknown',
] as const

export type RefGesture = (typeof REF_GESTURES)[number]

export type AnalysisSource =
  | 'hands'
  | 'speech'
  | 'vision'
  | 'audio_peak'
  | 'rules'
  | 'edit'
  | 'jev'

/** Spoken tokens we care about (normalized). */
const CALL_PATTERNS: Array<{ re: RegExp; label: string; gestureHint?: RefGesture }> = [
  { re: /\bhalt\b/i, label: 'Halt' },
  { re: /\btouch[eé]?\b|\btouch[eé]d?\b/i, label: 'Touché' },
  { re: /\battack\b/i, label: 'Attack', gestureHint: 'attack' },
  { re: /\briposte\b/i, label: 'Riposte', gestureHint: 'parry' },
  { re: /\bcounter[- ]?riposte\b/i, label: 'Counter-riposte' },
  { re: /\bcounter[- ]?attack\b|\barr[eê]t\b|\bstop[- ]?hit\b/i, label: 'Counter-attack', gestureHint: 'attack' },
  { re: /\bparry\b|\bparade\b/i, label: 'Parry', gestureHint: 'parry' },
  { re: /\bsimultaneous\b|\bsimul\b/i, label: 'Simultaneous', gestureHint: 'simultaneous' },
  { re: /\bnothing\b|\bno(?:\s+touch)?\b|\baucun\b/i, label: 'Nothing', gestureHint: 'nothing' },
  { re: /\bremise\b/i, label: 'Remise', gestureHint: 'attack' },
  { re: /\bredouble(?:ment)?\b/i, label: 'Redoublement', gestureHint: 'attack' },
  { re: /\breprise\b/i, label: 'Reprise', gestureHint: 'attack' },
  { re: /\bincorrect\b|\btoo short\b/i, label: 'Incorrect', gestureHint: 'incorrect' },
  { re: /\bpoint in line\b|\bin line\b/i, label: 'Point in line' },
]

export function normalizeTranscript(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

export function extractCallLabels(text: string): string[] {
  const found: string[] = []
  for (const { re, label } of CALL_PATTERNS) {
    if (re.test(text) && !found.includes(label)) found.push(label)
  }
  return found
}

export function gestureHintFromSpeech(text: string): RefGesture | undefined {
  for (const { re, gestureHint } of CALL_PATTERNS) {
    if (gestureHint && re.test(text)) return gestureHint
  }
  return undefined
}

/** Compact chip text for UI. */
export function formatRefChip(input: {
  refWords?: string
  refGesture?: RefGesture
  refSignal?: string
}): string | null {
  if (input.refWords?.trim()) {
    const labels = extractCallLabels(input.refWords)
    if (labels.length) return labels.slice(0, 3).join(' · ')
    const short = input.refWords.trim().slice(0, 42)
    return short
  }
  if (input.refGesture && input.refGesture !== 'unknown') {
    return input.refGesture.replace(/_/g, ' ')
  }
  if (input.refSignal?.trim()) return input.refSignal.trim().slice(0, 42)
  return null
}
