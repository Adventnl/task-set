export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } })
}

/** Reads a request body, stopping as soon as it exceeds `maxBytes`. Returns null when empty or too large. */
export async function readBody(request: Request, maxBytes: number): Promise<Uint8Array | null> {
  if (Number(request.headers.get('content-length')) > maxBytes) return null
  const reader = request.body?.getReader()
  if (!reader) return null
  const chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > maxBytes) {
      await reader.cancel()
      return null
    }
    chunks.push(value)
  }
  if (!size) return null
  const result = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    result.set(chunk, offset)
    offset += chunk.byteLength
  }
  return result
}

/** Parses a bounded JSON body. Returns undefined when it is missing, too large, or not JSON. */
export async function readJson(request: Request, maxBytes: number): Promise<unknown> {
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) return undefined
  const bytes = await readBody(request, maxBytes)
  if (!bytes) return undefined
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return undefined
  }
}
