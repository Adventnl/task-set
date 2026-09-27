import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { keepScreenAwake, readKeepAwake, saveKeepAwake } from '../src/services/keepAwakeService'

function sentinel() {
  const target = new EventTarget()
  return Object.assign(target, { release: vi.fn(async () => { target.dispatchEvent(new Event('release')) }) })
}

let doc: EventTarget & { visibilityState: string }
beforeEach(() => {
  doc = Object.assign(new EventTarget(), { visibilityState: 'visible' })
  vi.stubGlobal('document', doc)
})
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('keep screen on', () => {
  it('saves the device preference and handles inaccessible storage', () => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key), setItem: (key: string, value: string) => values.set(key, value) })
    expect(readKeepAwake()).toBe(false)
    saveKeepAwake(true)
    expect(readKeepAwake()).toBe(true)
    saveKeepAwake(false)
    expect(readKeepAwake()).toBe(false)
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('Blocked') }, setItem: () => { throw new Error('Blocked') } })
    expect(readKeepAwake()).toBe(false)
    expect(() => saveKeepAwake(true)).toThrow('Blocked')
  })

  it('acquires a lock, pauses in the background, reacquires and releases on cleanup', async () => {
    const first = sentinel(), second = sentinel()
    const request = vi.fn().mockResolvedValueOnce(first).mockResolvedValueOnce(second)
    vi.stubGlobal('navigator', { wakeLock: { request } })
    const status = vi.fn()
    const stop = keepScreenAwake(status)
    await vi.waitFor(() => expect(status).toHaveBeenLastCalledWith('active'))
    doc.visibilityState = 'hidden'
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(first.release).toHaveBeenCalledOnce()
    expect(status).toHaveBeenLastCalledWith('paused')
    doc.visibilityState = 'visible'
    doc.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(status).toHaveBeenLastCalledWith('active'))
    expect(request).toHaveBeenCalledTimes(2)
    stop()
    expect(second.release).toHaveBeenCalledOnce()
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(request).toHaveBeenCalledTimes(2)
  })

  it('releases a late request when switched off and avoids duplicate requests', async () => {
    let resolve!: (value: ReturnType<typeof sentinel>) => void
    const request = vi.fn(() => new Promise((done) => { resolve = done }))
    vi.stubGlobal('navigator', { wakeLock: { request } })
    const status = vi.fn()
    const stop = keepScreenAwake(status)
    doc.dispatchEvent(new Event('visibilitychange'))
    expect(request).toHaveBeenCalledOnce()
    stop()
    const lock = sentinel()
    resolve(lock)
    await vi.waitFor(() => expect(lock.release).toHaveBeenCalledOnce())
    expect(status).not.toHaveBeenCalledWith('active')
  })

  it('reports unsupported browsers, denied requests and system release', async () => {
    const status = vi.fn()
    vi.stubGlobal('navigator', {})
    keepScreenAwake(status)()
    expect(status).toHaveBeenLastCalledWith('unavailable')
    vi.stubGlobal('navigator', { wakeLock: { request: vi.fn().mockRejectedValue(new Error('Denied')) } })
    const denied = keepScreenAwake(status)
    await vi.waitFor(() => expect(status).toHaveBeenLastCalledWith('error'))
    denied()
    const lock = sentinel()
    vi.stubGlobal('navigator', { wakeLock: { request: vi.fn().mockResolvedValue(lock) } })
    const stop = keepScreenAwake(status)
    await vi.waitFor(() => expect(status).toHaveBeenLastCalledWith('active'))
    await lock.release()
    expect(status).toHaveBeenLastCalledWith('paused')
    stop()
  })
})
