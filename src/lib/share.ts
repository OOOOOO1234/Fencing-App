import type { Bout } from '../types'

/** Encode a bout (no video) into a URL-safe share fragment for coach read-only views. */
export function encodeSharePayload(bout: Bout): string {
  const payload = {
    ...bout,
    hasVideo: false,
  }
  const json = JSON.stringify(payload)
  const bytes = new TextEncoder().encode(json)
  let binary = ''
  bytes.forEach((b) => {
    binary += String.fromCharCode(b)
  })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function decodeSharePayload(fragment: string): Bout | null {
  try {
    const padded = fragment.replace(/-/g, '+').replace(/_/g, '/')
    const pad = padded.length % 4 === 0 ? '' : '='.repeat(4 - (padded.length % 4))
    const binary = atob(padded + pad)
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0))
    const json = new TextDecoder().decode(bytes)
    const bout = JSON.parse(json) as Bout
    if (!bout?.id || !Array.isArray(bout.phrases)) return null
    return { ...bout, hasVideo: false }
  } catch {
    return null
  }
}

export function buildShareUrl(bout: Bout): string {
  const encoded = encodeSharePayload(bout)
  const url = new URL(window.location.href)
  url.searchParams.set('share', '1')
  url.hash = encoded
  // Drop path noise; keep origin + pathname for SPA
  return url.toString()
}
