import React from 'react'
import { createRoot } from 'react-dom/client'
import HomePage from './pages/home'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HomePage />
  </React.StrictMode>,
)

// The network-only worker also removes shells cached by earlier versions.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch((error: unknown) => console.error('Service worker update is unavailable.', error))
  })
}
