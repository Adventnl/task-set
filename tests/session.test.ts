import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { createElement } from 'react'
import HomePage from '../src/pages/home'
import { closeWorkspace, unlockWorkspace, verifySession } from '../src/services/sessionService'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('workspace bootstrap', () => {
  it('locks immediately and waits for old local data cleanup before a new login', async () => {
    const events = new EventTarget()
    vi.stubGlobal('window', events)
    vi.stubGlobal('BroadcastChannel', undefined)
    const locked = vi.fn()
    events.addEventListener('task-set:session-ended', locked)
    let release!: () => void
    const pending = closeWorkspace(() => new Promise<void>((resolve) => { release = resolve }))
    expect(locked).toHaveBeenCalledOnce()
    const fetcher = vi.fn(async () => Response.json({ signedIn: true }))
    vi.stubGlobal('fetch', fetcher)
    const nextLogin = unlockWorkspace('new test login')
    await Promise.resolve()
    expect(fetcher).not.toHaveBeenCalled()
    release()
    await pending
    await nextLogin
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
  it('renders only a locked loading state before session verification', () => {
    const open = vi.fn()
    vi.stubGlobal('indexedDB', { open })
    const html = renderToString(createElement(HomePage))
    expect(html).toContain('Checking access')
    expect(html).not.toContain('view-nav')
    expect(open).not.toHaveBeenCalled()
  })
  it('verifies access without reading local storage and refuses unverified responses', async () => {
    const open = vi.fn()
    vi.stubGlobal('indexedDB', { open })
    const fetcher = vi.fn(async () => Response.json({ signedIn: true }))
    vi.stubGlobal('fetch', fetcher)
    await verifySession()
    expect(fetcher).toHaveBeenCalledWith('/api/session', expect.objectContaining({ cache: 'no-store', credentials: 'same-origin' }))
    expect(open).not.toHaveBeenCalled()
    fetcher.mockResolvedValue(Response.json({}))
    await expect(verifySession()).rejects.toThrow('Could not verify')
    fetcher.mockResolvedValue(Response.json({ error: 'Sign in to continue.' }, { status: 401 }))
    await expect(verifySession()).rejects.toThrow('Sign in')
  })
  it('does not sync or read private data while submitting a password', async () => {
    const fetcher = vi.fn(async () => Response.json({ signedIn: true }))
    vi.stubGlobal('fetch', fetcher)
    await unlockWorkspace('test passphrase')
    expect(fetcher.mock.calls.map((call: unknown[]) => call[0])).toEqual(['/api/session', '/api/session'])
  })
})
