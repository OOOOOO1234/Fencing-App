import { useEffect, useState, type FormEvent } from 'react'
import { hasSupabase } from '../lib/config'
import {
  getSyncStatus,
  pullCloudToLocal,
  pushLocalToCloud,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  type SyncStatus,
} from '../lib/sync'

interface AccountPanelProps {
  onSynced: () => Promise<void>
}

export function AccountPanel({ onSynced }: AccountPanelProps) {
  const [status, setStatus] = useState<SyncStatus | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  async function refreshStatus() {
    setStatus(await getSyncStatus())
  }

  useEffect(() => {
    void refreshStatus()
  }, [])

  async function handleAuth(event: FormEvent, mode: 'in' | 'up') {
    event.preventDefault()
    setBusy(true)
    setMessage(null)
    try {
      if (mode === 'in') await signInWithEmail(email, password)
      else await signUpWithEmail(email, password)
      await refreshStatus()
      setMessage(mode === 'in' ? 'Signed in.' : 'Check email to confirm if required, then sign in.')
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Auth failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="account-panel" aria-labelledby="account-heading">
      <div className="section-head">
        <h2 id="account-heading">Account & sync</h2>
        <p className="muted">
          Local browser storage always works. Paste Supabase keys to enable sign-in and cross-device
          sync.
        </p>
      </div>

      {!hasSupabase() ? (
        <p className="banner demo" role="status">
          Cloud sync pending keys: set <code>VITE_SUPABASE_URL</code> and{' '}
          <code>VITE_SUPABASE_ANON_KEY</code> in Netlify / <code>.env</code>, then redeploy. See{' '}
          <code>.env.example</code>.
        </p>
      ) : null}

      {status ? (
        <p className="muted">
          Status:{' '}
          <strong>
            {status.state === 'ready'
              ? `signed in${status.email ? ` as ${status.email}` : ''}`
              : status.state}
          </strong>
          {status.state !== 'ready' ? ` — ${status.message}` : null}
        </p>
      ) : null}

      {hasSupabase() && status?.state !== 'ready' ? (
        <form className="upload-form" onSubmit={(e) => void handleAuth(e, 'in')}>
          <label>
            Email
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </label>
          <label>
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </label>
          <div className="form-actions">
            <button type="submit" className="btn primary" disabled={busy}>
              Sign in
            </button>
            <button
              type="button"
              className="btn secondary"
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true)
                  setMessage(null)
                  try {
                    await signUpWithEmail(email, password)
                    await refreshStatus()
                    setMessage('Check email to confirm if required, then sign in.')
                  } catch (err) {
                    setMessage(err instanceof Error ? err.message : 'Sign up failed')
                  } finally {
                    setBusy(false)
                  }
                })()
              }}
            >
              Sign up
            </button>
          </div>
        </form>
      ) : null}

      {status?.state === 'ready' ? (
        <div className="form-actions">
          <button
            type="button"
            className="btn primary"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true)
                const result = await pushLocalToCloud()
                setMessage(result.message)
                setBusy(false)
              })()
            }}
          >
            Push to cloud
          </button>
          <button
            type="button"
            className="btn secondary"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true)
                const result = await pullCloudToLocal()
                setMessage(result.message)
                await onSynced()
                setBusy(false)
              })()
            }}
          >
            Pull from cloud
          </button>
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={() => {
              void (async () => {
                await signOut()
                await refreshStatus()
                setMessage('Signed out.')
              })()
            }}
          >
            Sign out
          </button>
        </div>
      ) : null}

      {message ? <p className="muted">{message}</p> : null}
    </section>
  )
}
