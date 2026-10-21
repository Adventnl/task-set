import { readFileSync } from 'node:fs'
import { runInNewContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'

function worker() {
  const listeners = new Map<string, (event: unknown) => void>()
  const remove = vi.fn(async () => true)
  const fetcher = vi.fn(async () => new Response('network'))
  const claim = vi.fn(async () => {})
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    URL,
    self: { location: { origin: 'https://task.test' }, addEventListener: (type: string, fn: (event: unknown) => void) => listeners.set(type, fn), clients: { claim }, skipWaiting: async () => {} },
    caches: { keys: async () => ['task-set-shell-v1', 'task-set-shell-v2', 'task-set:github-responses', 'another-app'], delete: remove },
    fetch: fetcher,
  })
  return { listeners, remove, fetcher, claim }
}

describe('authenticated service worker migration', () => {
  it('removes every obsolete offline app shell before claiming existing tabs', async () => {
    const { listeners, remove, claim } = worker()
    let activation!: Promise<void>
    listeners.get('activate')!({ waitUntil: (pending: Promise<void>) => { activation = pending } })
    await activation
    expect(remove.mock.calls.map(([name]: unknown[]) => name)).toEqual(['task-set-shell-v1', 'task-set-shell-v2'])
    expect(claim).toHaveBeenCalledOnce()
  })
  it('always goes to the server, including navigations, bundles and API requests', async () => {
    const { listeners, fetcher } = worker()
    for (const path of ['/', '/assets/app.js', '/api/session']) {
      const request = new Request(`https://task.test${path}`)
      let pending!: Promise<Response>
      listeners.get('fetch')!({ request, respondWith: (response: Promise<Response>) => { pending = response } })
      expect(await (await pending).text()).toBe('network')
      expect(fetcher).toHaveBeenLastCalledWith(request, { cache: 'no-store' })
    }
  })
  it('cannot fall back to a cached app when offline', async () => {
    const { listeners, fetcher } = worker()
    fetcher.mockRejectedValue(new TypeError('Offline'))
    let pending!: Promise<Response>
    listeners.get('fetch')!({ request: new Request('https://task.test/'), respondWith: (response: Promise<Response>) => { pending = response } })
    await expect(pending).rejects.toThrow('Offline')
  })
})
