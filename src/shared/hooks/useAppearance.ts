import { useLayoutEffect, useState } from 'react'
import { readAppearance, saveAppearance } from '../../services/appearanceService'
import type { Appearance } from '../types/appearance'

const SCHEME_QUERY = { light: '(prefers-color-scheme: light)', dark: '(prefers-color-scheme: dark)' } as const

/**
 * Sets the page's color scheme. The browser toolbar colors come from the theme-color tags in
 * index.html, so a fixed choice points both tags at that scheme.
 */
function applyAppearance(appearance: Appearance): void {
  const root = document.documentElement
  if (appearance === 'system') delete root.dataset.theme
  else root.dataset.theme = appearance
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"][data-scheme]')) {
    const scheme = meta.dataset.scheme === 'dark' ? 'dark' : 'light'
    meta.media = appearance === 'system' ? SCHEME_QUERY[scheme] : appearance === scheme ? 'all' : 'not all'
  }
}

/** Light, dark, or the system setting, remembered on this device. */
export function useAppearance() {
  const [appearance, setAppearance] = useState(readAppearance)
  const [saveFailed, setSaveFailed] = useState(false)

  // Before paint, so a fixed choice never flashes the other scheme.
  useLayoutEffect(() => applyAppearance(appearance), [appearance])

  function chooseAppearance(next: Appearance) {
    setAppearance(next)
    try {
      saveAppearance(next)
      setSaveFailed(false)
    } catch {
      setSaveFailed(true)
    }
  }

  return { appearance, chooseAppearance, saveFailed }
}
