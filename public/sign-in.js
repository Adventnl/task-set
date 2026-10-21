// This page never imports the workspace or reads its local storage.
// Update older service workers even when the visitor has not signed in.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' }).catch(() => {
    // The server still enforces authentication if service workers are unavailable.
  })
}
