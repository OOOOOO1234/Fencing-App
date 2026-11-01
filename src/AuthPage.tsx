import { useState, type FormEvent } from 'react'
import { signIn, signUp, type AuthMode, type AuthUser } from './lib/auth'

interface AuthPageProps {
  onAuthed: (user: AuthUser) => void
}

export function AuthPage({ onAuthed }: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)

    if (mode === 'signup' && password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    try {
      const user =
        mode === 'login' ? await signIn(email, password) : await signUp(email, password)
      if (mode === 'signup') {
        setNotice('Account created — you’re in.')
      }
      onAuthed(user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page auth-page">
      <div className="atmosphere" aria-hidden />

      <header className="masthead auth-masthead">
        <h1 className="brand">TouchStat</h1>
        <p className="lede uvp">
          TouchStat delivers instant, AI-powered video breakdown for every fencing touch,
          turning raw bout footage into clear, actionable action stats for Foil, Épée, and
          Saber.
        </p>
      </header>

      <section className="auth-panel" aria-labelledby="auth-title">
        <div className="auth-tabs" role="tablist" aria-label="Account">
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'login'}
            className={mode === 'login' ? 'auth-tab auth-tab-on' : 'auth-tab'}
            onClick={() => {
              setMode('login')
              setError(null)
              setNotice(null)
            }}
          >
            Log in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'signup'}
            className={mode === 'signup' ? 'auth-tab auth-tab-on' : 'auth-tab'}
            onClick={() => {
              setMode('signup')
              setError(null)
              setNotice(null)
            }}
          >
            Create account
          </button>
        </div>

        <h2 id="auth-title" className="auth-title">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h2>
        <p className="auth-lede">
          {mode === 'login'
            ? 'Sign in with your email to open your bouts and opponent study.'
            : 'Use your email to save TouchStat across devices when cloud sync is on.'}
        </p>

        <form className="auth-form" onSubmit={(e) => void submit(e)}>
          <label className="auth-field">
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@club.com"
            />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 6 characters"
            />
          </label>

          {mode === 'signup' ? (
            <label className="auth-field">
              <span>Confirm password</span>
              <input
                type="password"
                name="confirm"
                autoComplete="new-password"
                required
                minLength={6}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
          ) : null}

          {error ? (
            <p className="auth-error" role="alert">
              {error}
            </p>
          ) : null}
          {notice ? (
            <p className="auth-notice" role="status">
              {notice}
            </p>
          ) : null}

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy ? 'Working…' : mode === 'login' ? 'Log in' : 'Create account'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? (
            <>
              New here?{' '}
              <button type="button" className="text-btn" onClick={() => setMode('signup')}>
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{' '}
              <button type="button" className="text-btn" onClick={() => setMode('login')}>
                Log in
              </button>
            </>
          )}
        </p>
      </section>
    </div>
  )
}
