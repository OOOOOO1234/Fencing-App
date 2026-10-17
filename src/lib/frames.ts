/** Sample JPEG keyframes from a video element for server-side vision analysis. */

export interface VideoFrame {
  timestamp: number
  dataUrl: string
}

const SEEK_TIMEOUT_MS = 2500

function waitForSeek(video: HTMLVideoElement, target: number): Promise<void> {
  return new Promise((resolve) => {
    // Some browsers never fire `seeked` if already at the target (or very close).
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

/**
 * Capture evenly spaced frames. Keeps payload small for Netlify (~10–26s) + OpenAI.
 * Seeks always time out so Analyze never hangs forever on stubborn codecs.
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
  const count = options?.count ?? 6
  const maxWidth = options?.maxWidth ?? 384
  const quality = options?.quality ?? 0.55
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

  const frames: VideoFrame[] = []
  const step = duration / count

  try {
    for (let i = 0; i < count; i += 1) {
      const timestamp = Math.min(duration - 0.05, step * i + step / 2)
      await waitForSeek(video, Math.max(0, timestamp))

      const vw = video.videoWidth || maxWidth
      const vh = video.videoHeight || Math.round(maxWidth * 0.56)
      const scale = Math.min(1, maxWidth / vw)
      canvas.width = Math.max(1, Math.round(vw * scale))
      canvas.height = Math.max(1, Math.round(vh * scale))
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', quality)
      frames.push({ timestamp: video.currentTime || timestamp, dataUrl })
      options?.onProgress?.(i + 1, count)
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
