/** Loudness peaks + short WAV clips for Whisper (server-side). */

export interface AudioCue {
  timestamp: number
  loudness: number
}

export interface AudioClip {
  /** Center / peak time in the bout (seconds). */
  timestamp: number
  /** WAV as data URL (audio/wav;base64,...). Keep short. */
  dataUrl: string
  durationSec: number
}

function writeString(view: DataView, offset: number, str: string) {
  for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i))
}

/** Encode mono PCM float samples to a small 16-bit WAV data URL. */
function encodeWavDataUrl(samples: Float32Array, sampleRate: number): string {
  const numChannels = 1
  const bitsPerSample = 16
  const blockAlign = (numChannels * bitsPerSample) / 8
  const byteRate = sampleRate * blockAlign
  const dataSize = samples.length * blockAlign
  const buffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(buffer)

  writeString(view, 0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(view, 8, 'WAVE')
  writeString(view, 12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  writeString(view, 36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let i = 0; i < samples.length; i += 1) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0))
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    offset += 2
  }

  const bytes = new Uint8Array(buffer)
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return `data:audio/wav;base64,${btoa(binary)}`
}

async function decodeAudio(source: File | Blob): Promise<{
  ctx: AudioContext
  audio: AudioBuffer
} | null> {
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  const ctx = new AC()
  try {
    const buffer = await source.arrayBuffer()
    const audio = await ctx.decodeAudioData(buffer.slice(0))
    return { ctx, audio }
  } catch {
    void ctx.close().catch(() => undefined)
    return null
  }
}

/**
 * Decode the video/audio file and find loudness peaks.
 * Returns [] if the browser cannot decode audio.
 */
export async function extractAudioCues(
  source: File | Blob,
  options?: {
    maxPeaks?: number
    windowSec?: number
    minRelative?: number
  },
): Promise<AudioCue[]> {
  const maxPeaks = options?.maxPeaks ?? 8
  const windowSec = options?.windowSec ?? 0.12
  const minRelative = options?.minRelative ?? 0.45

  const decoded = await decodeAudio(source)
  if (!decoded) return []
  const { ctx, audio } = decoded

  try {
    const channel = audio.getChannelData(0)
    if (!channel.length || audio.duration <= 0) return []

    const sampleRate = audio.sampleRate
    const windowSamples = Math.max(64, Math.floor(windowSec * sampleRate))
    const hop = Math.max(32, Math.floor(windowSamples / 2))
    const rms: { t: number; v: number }[] = []

    for (let start = 0; start + windowSamples < channel.length; start += hop) {
      let sum = 0
      for (let i = 0; i < windowSamples; i += 1) {
        const s = channel[start + i] ?? 0
        sum += s * s
      }
      rms.push({
        t: (start + windowSamples / 2) / sampleRate,
        v: Math.sqrt(sum / windowSamples),
      })
    }

    if (rms.length === 0) return []
    const maxV = Math.max(...rms.map((r) => r.v), 1e-9)
    const threshold = maxV * minRelative

    const candidates: AudioCue[] = []
    for (let i = 1; i < rms.length - 1; i += 1) {
      const prev = rms[i - 1]!
      const cur = rms[i]!
      const next = rms[i + 1]!
      if (cur.v >= threshold && cur.v >= prev.v && cur.v >= next.v) {
        candidates.push({
          timestamp: Number(cur.t.toFixed(2)),
          loudness: Number((cur.v / maxV).toFixed(3)),
        })
      }
    }

    candidates.sort((a, b) => b.loudness - a.loudness)
    const picked: AudioCue[] = []
    const minGap = 0.6
    for (const c of candidates) {
      if (picked.some((p) => Math.abs(p.timestamp - c.timestamp) < minGap)) continue
      picked.push(c)
      if (picked.length >= maxPeaks) break
    }
    return picked.sort((a, b) => a.timestamp - b.timestamp)
  } finally {
    void ctx.close().catch(() => undefined)
  }
}

/**
 * Cut short mono WAV clips around peaks for Whisper.
 * Downsamples to 16 kHz to keep Netlify payloads small.
 */
export async function extractAudioClips(
  source: File | Blob,
  peaks: AudioCue[],
  options?: {
    maxClips?: number
    /** Half-window around peak (seconds). */
    padSec?: number
    targetRate?: number
  },
): Promise<AudioClip[]> {
  const maxClips = options?.maxClips ?? 4
  const padSec = options?.padSec ?? 1.25
  const targetRate = options?.targetRate ?? 16_000

  const decoded = await decodeAudio(source)
  if (!decoded) return []
  const { ctx, audio } = decoded

  try {
    const channel = audio.getChannelData(0)
    const srcRate = audio.sampleRate
    const clips: AudioClip[] = []
    const top = [...peaks].sort((a, b) => b.loudness - a.loudness).slice(0, maxClips)

    for (const peak of top.sort((a, b) => a.timestamp - b.timestamp)) {
      const startSec = Math.max(0, peak.timestamp - padSec)
      const endSec = Math.min(audio.duration, peak.timestamp + padSec)
      const startSample = Math.floor(startSec * srcRate)
      const endSample = Math.floor(endSec * srcRate)
      if (endSample - startSample < srcRate * 0.2) continue

      const slice = channel.subarray(startSample, endSample)
      // Downsample
      const ratio = srcRate / targetRate
      const outLen = Math.max(1, Math.floor(slice.length / ratio))
      const down = new Float32Array(outLen)
      for (let i = 0; i < outLen; i += 1) {
        down[i] = slice[Math.floor(i * ratio)] ?? 0
      }

      const dataUrl = encodeWavDataUrl(down, targetRate)
      // Rough size guard (~900KB base64 ≈ skip)
      if (dataUrl.length > 900_000) continue

      clips.push({
        timestamp: peak.timestamp,
        dataUrl,
        durationSec: Number(((endSec - startSec)).toFixed(2)),
      })
    }
    return clips
  } finally {
    void ctx.close().catch(() => undefined)
  }
}
