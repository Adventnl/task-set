import type { Appearance } from '../shared/types/appearance'

const STORAGE_KEY = 'task-set:appearance'
const CHOICES: readonly Appearance[] = ['system', 'light', 'dark']

/** This device's appearance. Falls back to the system setting when nothing valid is stored. */
export function readAppearance(): Appearance {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return CHOICES.find((choice) => choice === stored) ?? 'system'
  } catch {
    return 'system' // storage is blocked; the system setting is the only safe default
  }
}

/** Remembers the choice on this device only. Throws when the browser blocks storage. */
export function saveAppearance(appearance: Appearance): void {
  if (appearance === 'system') localStorage.removeItem(STORAGE_KEY)
  else localStorage.setItem(STORAGE_KEY, appearance)
}
