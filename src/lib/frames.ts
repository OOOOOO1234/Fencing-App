/** Sample JPEG keyframes from a video element for server-side vision analysis. */

export interface VideoFrame {
  timestamp: number
  dataUrl: string
  /** hint for the model: piste action vs likely ref/award moment */
  role?: 'piste' | 'ref'
}

const SEEK_TIMEOUT_MS = 2500

function waitForSeek(video: HTMLVideoElement, target: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(video.currentTime - target) < 0.08 && video.readyState >= 2) {
      resolve()
      return
    }

    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      cleanup()
      resolve()
    }

    const onSeeked = () => finish()
    const onError = () => finish()
    const timer = window.setTimeout(finish, SEEK_TIMEOUT_MS)

    const cleanup = () => {
      window.clearTimeout(timer)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
    }

    video.addEventListener('seeked', onSeeked)
    video.addEventListener('error', onError)
    try {
      video.currentTime = Math.max(0, target)
    } catch {
      finish()
    }
  })
}

async function snapFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  timestamp: number,
  maxWidth: number,
  quality: number,
  role?: 'piste' | 'ref',
): Promise<VideoFrame> {
  await waitForSeek(video, Math.max(0, timestamp))
  const vw = video.videoWidth || maxWidth
  const vh = video.videoHeight || Math.round(maxWidth * 0.56)
  const scale = Math.min(1, maxWidth / vw)
  canvas.width = Math.max(1, Math.round(vw * scale))
  canvas.height = Math.max(1, Math.round(vh * scale))

  if (role === 'ref') {
    // Bias crop toward upper/center — refs often stand mid-piste facing camera.
    const sw = vw * 0.7
    const sh = vh * 0.55
    const sx = (vw - sw) / 2
    const sy = vh * 0.05
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  } else {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
  }

  return {
    timestamp: video.currentTime || timestamp,
    dataUrl: canvas.toDataURL('image/jpeg', quality),
    role,
  }
}

/**
 * Evenly spaced frames (legacy / fallback).
 */
export async function captureKeyframes(
  video: HTMLVideoElement,
  options?: {
    count?: number
    maxWidth?: number
    quality?: number
    onProgress?: (done: number, total: number) => void
  },
): Promise<{ frames: VideoFrame[]; duration: number }> {
  return captureSmartFrames(video, {
    anchors: [],
    evenCount: options?.count ?? 6,
    maxWidth: options?.maxWidth,
    quality: options?.quality,
    onProgress: options?.onProgress,
  })
}

/**
 * Dense sampling around Halt/speech anchors + a few even piste frames.
 * Caps total frames for Netlify payload / timeout.
 */
export async function captureSmartFrames(
  video: HTMLVideoElement,
  options?: {
    /** Times (sec) near Halt / speech / loudness peaks. */
    anchors?: number[]
    evenCount?: number
    maxFrames?: number
    maxWidth?: number
    quality?: number
    onProgress?: (done: number, total: number) => void
  },
): Promise<{ frames: VideoFrame[]; duration: number }> {
  const evenCount = options?.evenCount ?? 3
  const maxFrames = options?.maxFrames ?? 8
  const maxWidth = options?.maxWidth ?? 384
  const quality = options?.quality ?? 0.55
  const anchors = options?.anchors ?? []
  const duration = Number.isFinite(video.duration) ? video.duration : 0

  if (!duration || duration <= 0) {
    throw new Error('Video duration unavailable — wait for the video to load, then try again.')
  }

  const wasPaused = video.paused
  const previousTime = video.currentTime
  video.pause()

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas unavailable for frame capture')

  type Plan = { t: number; role: 'piste' | 'ref' }
  const plan: Plan[] = []

  // Around each anchor: piste just before + ref-biased at/after halt
  const topAnchors = [...anchors].sort((a, b) => a - b).slice(0, 4)
  for (const a of topAnchors) {
    plan.push({ t: Math.max(0, a - 0.35), role: 'piste' })
    plan.push({ t: Math.min(duration - 0.05, a + 0.15), role: 'ref' })
  }

  const step = duration / Math.max(1, evenCount)
  for (let i = 0; i < evenCount; i += 1) {
    plan.push({
      t: Math.min(duration - 0.05, step * i + step / 2),
      role: 'piste',
    })
  }

  // Dedupe by ~0.25s buckets, prefer ref role
  plan.sort((a, b) => a.t - b.t || (a.role === 'ref' ? -1 : 1))
  const picked: Plan[] = []
  for (const p of plan) {
    const clash = picked.find((x) => Math.abs(x.t - p.t) < 0.25)
    if (clash) {
      if (clash.role !== 'ref' && p.role === 'ref') clash.role = 'ref'
      continue
    }
    picked.push({ ...p })
    if (picked.length >= maxFrames) break
  }

  const frames: VideoFrame[] = []
  try {
    for (let i = 0; i < picked.length; i += 1) {
      const p = picked[i]!
      frames.push(await snapFrame(video, canvas, ctx, p.t, maxWidth, quality, p.role))
      options?.onProgress?.(i + 1, picked.length)
    }
  } finally {
    try {
      video.currentTime = previousTime
    } catch {
      /* ignore */
    }
    if (!wasPaused) void video.play().catch(() => undefined)
  }

  if (frames.length === 0) {
    throw new Error('Could not capture any frames from this video.')
  }

  return { frames, duration }
}
