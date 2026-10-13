/** Sample JPEG keyframes from a video element for server-side vision analysis. */

export interface VideoFrame {
  timestamp: number
  dataUrl: string
}

function waitForSeek(video: HTMLVideoElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => {
      cleanup()
      resolve()
    }
    const onError = () => {
      cleanup()
      reject(new Error('Could not seek video for frame capture'))
    }
    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
    }
    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })
  })
}

/**
 * Capture evenly spaced frames. Keeps payload small for Netlify function + OpenAI limits.
 * Honest constraint: sparse stills, not continuous video understanding.
 */
export async function captureKeyframes(
  video: HTMLVideoElement,
  options?: { count?: number; maxWidth?: number },
): Promise<{ frames: VideoFrame[]; duration: number }> {
  const count = options?.count ?? 10
  const maxWidth = options?.maxWidth ?? 512
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
      video.currentTime = Math.max(0, timestamp)
      await waitForSeek(video)

      const scale = Math.min(1, maxWidth / video.videoWidth || 1)
      canvas.width = Math.max(1, Math.round((video.videoWidth || maxWidth) * scale))
      canvas.height = Math.max(1, Math.round((video.videoHeight || maxWidth) * scale))
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.72)
      frames.push({ timestamp, dataUrl })
    }
  } finally {
    video.currentTime = previousTime
    if (!wasPaused) void video.play()
  }

  return { frames, duration }
}
