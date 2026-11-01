import { hasSupabase } from './config'
import {
  getSyncStatus,
  signInWithEmail as cloudSignIn,
  signOut as cloudSignOut,
  signUpWithEmail as cloudSignUp,
} from './sync'

const USERS_KEY = 'touchstat:local-users:v1'
const SESSION_KEY = 'touchstat:session:v1'

export type AuthMode = 'login' | 'signup'

export type AuthUser = {
  email: string
  source: 'supabase' | 'local'
}

type LocalUsers = Record<string, { password: string; createdAt: string }>

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

function readUsers(): LocalUsers {
  try {
    const raw = localStorage.getItem(USERS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as LocalUsers
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeUsers(users: LocalUsers) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users))
}

function readLocalSession(): AuthUser | null {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY) ?? localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { email?: string }
    if (!parsed?.email) return null
    return { email: parsed.email, source: 'local' }
  } catch {
    return null
  }
}

function writeLocalSession(email: string) {
  const payload = JSON.stringify({ email, signedInAt: new Date().toISOString() })
  sessionStorage.setItem(SESSION_KEY, payload)
  localStorage.setItem(SESSION_KEY, payload)
}

function clearLocalSession() {
  sessionStorage.removeItem(SESSION_KEY)
  localStorage.removeItem(SESSION_KEY)
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  if (hasSupabase()) {
    const status = await getSyncStatus()
    if (status.state === 'ready' && status.email) {
      return { email: status.email, source: 'supabase' }
    }
    if (status.state === 'ready') {
      return { email: 'signed-in', source: 'supabase' }
    }
    // Fall through to local if cloud signed out — supports demo accounts
  }
  return readLocalSession()
}

export async function signIn(email: string, password: string): Promise<AuthUser> {
  const normalized = normalizeEmail(email)
  if (!normalized || !normalized.includes('@')) {
    throw new Error('Enter a valid email address.')
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.')
  }

  if (hasSupabase()) {
    try {
      await cloudSignIn(normalized, password)
      return { email: normalized, source: 'supabase' }
    } catch (err) {
      // If cloud rejects, try local accounts (prototype / offline users)
      const local = tryLocalSignIn(normalized, password)
      if (local) return local
      throw err instanceof Error ? err : new Error('Sign in failed.')
    }
  }

  return localSignIn(normalized, password)
}

function tryLocalSignIn(email: string, password: string): AuthUser | null {
  const users = readUsers()
  const row = users[email]
  if (!row || row.password !== password) return null
  writeLocalSession(email)
  return { email, source: 'local' }
}

function localSignIn(email: string, password: string): AuthUser {
  const users = readUsers()
  const row = users[email]
  if (!row) throw new Error('No account for that email — create one first.')
  if (row.password !== password) throw new Error('Incorrect password.')
  writeLocalSession(email)
  return { email, source: 'local' }
}

export async function signUp(email: string, password: string): Promise<AuthUser> {
  const normalized = normalizeEmail(email)
  if (!normalized || !normalized.includes('@')) {
    throw new Error('Enter a valid email address.')
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.')
  }

  if (hasSupabase()) {
    try {
      await cloudSignUp(normalized, password)
      writeLocalSession(normalized)
      return { email: normalized, source: 'supabase' }
    } catch (err) {
      // Mirror into local so the prototype still works if confirm-email is on
      const message = err instanceof Error ? err.message : ''
      if (/already/i.test(message)) throw err
    }
  }

  const users = readUsers()
  if (users[normalized]) {
    throw new Error('An account with that email already exists. Log in instead.')
  }
  users[normalized] = { password, createdAt: new Date().toISOString() }
  writeUsers(users)
  writeLocalSession(normalized)
  return { email: normalized, source: hasSupabase() ? 'supabase' : 'local' }
}

export async function signOut(): Promise<void> {
  clearLocalSession()
  if (hasSupabase()) {
    try {
      await cloudSignOut()
    } catch {
      // ignore
    }
  }
}
