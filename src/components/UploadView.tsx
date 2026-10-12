import { useId, useState, type FormEvent } from 'react'
import type { FencerSide } from '../types'

interface UploadViewProps {
  onCreate: (input: {
    title: string
    side: FencerSide
    file: File | null
  }) => Promise<void>
  onDemo: () => Promise<void>
  onCancel: () => void
}

export function UploadView({ onCreate, onDemo, onCancel }: UploadViewProps) {
  const titleId = useId()
  const fileId = useId()
  const [title, setTitle] = useState('')
  const [side, setSide] = useState<FencerSide>('left')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!file) {
      setError('Choose one bout video to upload.')
      return
    }
    setBusy(true)
    try {
      await onCreate({
        title: title.trim() || file.name.replace(/\.[^.]+$/, ''),
        side,
        file,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
      setBusy(false)
    }
  }

  async function handleDemo() {
    setBusy(true)
    setError(null)
    try {
      await onDemo()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load demo')
      setBusy(false)
    }
  }

  return (
    <section className="upload-view" aria-labelledby="upload-heading">
      <div className="section-head">
        <h2 id="upload-heading">Upload one bout</h2>
        <p className="muted">
          One video at a time. Say whether you are the left or right fencer. Then tag phrases on
          the timeline — the stats come from those tags (not from AI vision).
        </p>
      </div>

      <form className="upload-form" onSubmit={handleSubmit}>
        <label htmlFor={titleId}>
          Bout title
          <input
            id={titleId}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Club DE — pool bout 3"
            autoComplete="off"
          />
        </label>

        <fieldset>
          <legend>You are fencing on the</legend>
          <div className="side-toggle" role="radiogroup" aria-label="Your side of the strip">
            <label className={side === 'left' ? 'active' : undefined}>
              <input
                type="radio"
                name="side"
                value="left"
                checked={side === 'left'}
                onChange={() => setSide('left')}
              />
              Left
            </label>
            <label className={side === 'right' ? 'active' : undefined}>
              <input
                type="radio"
                name="side"
                value="right"
                checked={side === 'right'}
                onChange={() => setSide('right')}
              />
              Right
            </label>
          </div>
        </fieldset>

        <label htmlFor={fileId}>
          Bout video
          <input
            id={fileId}
            type="file"
            accept="video/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
        {file ? <p className="file-name">{file.name}</p> : null}

        {error ? (
          <p className="error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="form-actions">
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : 'Start tagging'}
          </button>
          <button type="button" className="btn ghost" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        </div>
      </form>

      <div className="demo-callout">
        <p>
          <strong>No video handy?</strong> Load a clearly labeled demo bout with sample phrase tags
          so you can browse the stats table. Demo data is not AI analysis.
        </p>
        <button type="button" className="btn secondary" onClick={handleDemo} disabled={busy}>
          Load demo bout
        </button>
      </div>
    </section>
  )
}
