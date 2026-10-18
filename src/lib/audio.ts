/** Loudness peaks from bout audio — likely Halt / Touché / call moments. */

export interface AudioCue {
  /** Seconds into the video. */
  timestamp: number
  /** Relative loudness 0–1 within this clip. */
  loudness: number
}

/**
 * Decode the video/audio file and find loudness peaks.
 * Practical path for Analyze: timestamps only (tiny payload) — not full speech ASR.
 * Returns [] if the browser cannot decode audio (silent clip, codec, etc.).
 */
export async function extractAudioCues(
  source: File | Blob,
  options?: {
    maxPeaks?: number
    /** RMS window size in seconds. */
    windowSec?: number
    /** Peak must be at least this fraction of the clip max RMS. */
    minRelative?: number
  },
): Promise<AudioCue[]> {
  const maxPeaks = options?.maxPeaks ?? 8
  const windowSec = options?.windowSec ?? 0.12
  const minRelative = options?.minRelative ?? 0.45

  let ctx: AudioContext | null = null
  try {
    const buffer = await source.arrayBuffer()
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return []
    ctx = new AC()
    const audio = await ctx.decodeAudioData(buffer.slice(0))
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
      const v = Math.sqrt(sum / windowSamples)
      const t = (start + windowSamples / 2) / sampleRate
      rms.push({ t, v })
    }

    if (rms.length === 0) return []
    const maxV = Math.max(...rms.map((r) => r.v), 1e-9)
    const threshold = maxV * minRelative

    // Local maxima above threshold, then keep top-N by loudness with spacing.
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
  } catch {
    return []
  } finally {
    if (ctx) void ctx.close().catch(() => undefined)
  }
}
