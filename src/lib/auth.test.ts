/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from 'vitest'
import { getCurrentUser, signIn, signOut, signUp } from './auth'

describe('local auth', () => {
  beforeEach(async () => {
    localStorage.clear()
    sessionStorage.clear()
    await signOut()
  })

  it('creates an account and keeps a session', async () => {
    const user = await signUp('Fencer@Club.com', 'secret12')
    expect(user.email).toBe('fencer@club.com')
    expect(await getCurrentUser()).toMatchObject({ email: 'fencer@club.com' })
  })

  it('signs in with the same email', async () => {
    await signUp('bout@touchstat.app', 'secret12')
    await signOut()
    expect(await getCurrentUser()).toBeNull()
    const user = await signIn('bout@touchstat.app', 'secret12')
    expect(user.email).toBe('bout@touchstat.app')
  })

  it('rejects duplicate signup and bad login', async () => {
    await signUp('dup@touchstat.app', 'secret12')
    await expect(signUp('dup@touchstat.app', 'secret12')).rejects.toThrow(/already exists/i)
    await signOut()
    await expect(signIn('dup@touchstat.app', 'wrongpass')).rejects.toThrow(/Incorrect password/i)
    await expect(signIn('missing@touchstat.app', 'secret12')).rejects.toThrow(/create one first/i)
  })
})
