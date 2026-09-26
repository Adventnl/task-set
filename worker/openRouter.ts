const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions'
const TIMEOUT_MS = 30_000

export interface ChatMessage {
  role: 'system' | 'user'
  content: string
}

export interface StructuredChat {
  model: string
  messages: ChatMessage[]
  /** JSON Schema the answer must follow. */
  schema: object
  maxTokens: number
}

function messageContent(body: unknown): string | null {
  const choices = body && typeof body === 'object' && 'choices' in body && Array.isArray(body.choices) ? body.choices : []
  const message: unknown = choices[0] && typeof choices[0] === 'object' && 'message' in choices[0] ? choices[0].message : null
  const content = message && typeof message === 'object' && 'content' in message ? message.content : null
  return typeof content === 'string' ? content : null
}

/**
 * Runs one OpenRouter chat completion that must answer in JSON matching `chat.schema`. Only
 * providers that honor the schema are used. Returns the answer text; throws on any failure.
 */
export async function openRouterStructuredChat(apiKey: string, chat: StructuredChat): Promise<string> {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: chat.model,
      messages: chat.messages,
      response_format: { type: 'json_schema', json_schema: { name: 'answer', schema: chat.schema } },
      provider: { require_parameters: true },
      max_tokens: chat.maxTokens,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  })
  if (!response.ok) throw new Error(`OpenRouter returned HTTP ${response.status}`)
  const content = messageContent(await response.json())
  if (content === null) throw new Error('OpenRouter response had no answer')
  return content
}
