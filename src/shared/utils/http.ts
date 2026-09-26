/** An API response that was reachable but not successful. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'HttpError'
  }
}

/** The API could not be reached (offline, DNS, or no API on this host). */
export class UnreachableError extends Error {
  constructor(message = 'Can’t reach Task Set right now. Check your connection and try again.') {
    super(message)
    this.name = 'UnreachableError'
  }
}

/** Sends a same-origin API request and returns the parsed JSON body. Every API route answers with JSON. */
export async function requestJson(path: string, init: RequestInit = {}): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(path, { ...init, credentials: 'same-origin' })
  } catch {
    throw new UnreachableError()
  }
  const isJson = (response.headers.get('content-type') ?? '').includes('application/json')
  // A static host without the Worker answers /api/* with HTML or 404: treat as offline.
  if (!isJson && (response.ok || response.status === 404)) throw new UnreachableError()
  if (response.status >= 502 && response.status <= 504) throw new UnreachableError()
  const body: unknown = isJson ? await response.json().catch(() => null) : null
  if (!response.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : 'Something went wrong. Try again.'
    throw new HttpError(response.status, message)
  }
  return body
}
