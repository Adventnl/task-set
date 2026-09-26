import { afterEach, describe, expect, it, vi } from 'vitest'
import { readAppearance, saveAppearance } from '../src/services/appearanceService'

function memoryStorage(): Storage {
  const values = new Map<string, string>()
  return {
    get length() {
      return values.size
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => void values.delete(key),
    setItem: (key, value) => void values.set(key, value),
  }
}

describe('appearance preference', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('remembers a fixed choice and forgets it when set back to system', () => {
    const storage = memoryStorage()
    vi.stubGlobal('localStorage', storage)
    expect(readAppearance()).toBe('system')
    saveAppearance('light')
    expect(readAppearance()).toBe('light')
    saveAppearance('system')
    expect(readAppearance()).toBe('system')
    expect(storage.length).toBe(0)
  })

  it('falls back to the system setting for unknown values or blocked storage', () => {
    const storage = memoryStorage()
    storage.setItem('task-set:appearance', 'sepia')
    vi.stubGlobal('localStorage', storage)
    expect(readAppearance()).toBe('system')
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new DOMException('Blocked', 'SecurityError')
      },
    })
    expect(readAppearance()).toBe('system')
  })
})
