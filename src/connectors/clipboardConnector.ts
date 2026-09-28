/** Copies text to the system clipboard. Rejects when the browser refuses, such as outside a secure page. */
export async function writeClipboard(text: string): Promise<void> {
  if (!navigator.clipboard?.writeText) throw new Error('This browser cannot copy.')
  await navigator.clipboard.writeText(text)
}
