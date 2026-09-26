import { requestJson } from '../shared/utils/http'

/** Sends an in-memory recording for one-off transcription. The server does not keep the audio. */
export async function transcribeAudio(audio: Blob): Promise<string> {
  const result = await requestJson('/api/ai/transcribe', {
    method: 'POST',
    headers: { 'Content-Type': audio.type },
    body: audio,
  })
  if (!result || typeof result !== 'object' || !('text' in result) || typeof result.text !== 'string' || !result.text.trim()) {
    throw new Error('The transcription response was invalid.')
  }
  return result.text.trim()
}

/** Asks the server to look for tasks in a capture again after its automatic attempts failed. */
export async function requestTaskRetry(captureId: string): Promise<void> {
  await requestJson('/api/ai/retry', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ captureId }),
  })
}
