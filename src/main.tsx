import React from 'react'
import { createRoot } from 'react-dom/client'
import HomePage from './pages/home'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HomePage />
  </React.StrictMode>,
)

// The service worker lets the installed app open without a connection.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((error: unknown) => console.error('Offline support is unavailable.', error))
  })
}
