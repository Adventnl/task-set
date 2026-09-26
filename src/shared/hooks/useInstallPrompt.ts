import { useEffect, useState } from 'react'

/** Chrome and Edge's install prompt. It is not in TypeScript's DOM library, so its shape is declared here. */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

/**
 * `available`: the browser offers its install prompt. `manual`: installing goes through the
 * browser's own menu (Safari, or Chrome after the prompt was dismissed).
 */
export type InstallStatus = 'installed' | 'available' | 'manual'

function runningInstalled(): boolean {
  const scope = navigator as Navigator & { standalone?: boolean }
  return window.matchMedia('(display-mode: standalone)').matches || scope.standalone === true
}

/** Whether Task Set can be installed as an app from this browser, and the action that installs it. */
export function useInstallPrompt() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(runningInstalled)

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault() // shown from Task Set's own button instead of the browser's banner
      setPrompt(event as InstallPromptEvent)
    }
    const onInstalled = () => {
      setPrompt(null)
      setInstalled(true)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function install() {
    if (!prompt) return
    setPrompt(null) // each prompt event can be shown only once
    await prompt.prompt()
    await prompt.userChoice // `appinstalled` reports success
  }

  const status: InstallStatus = installed ? 'installed' : prompt ? 'available' : 'manual'
  return { status, install }
}
