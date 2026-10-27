import { parseMailAccountInput } from '../src/shared/utils/mail'
import { json, readJson } from './http'
import { MailConflict, type MailStore } from './mailStore'

/** Authentication and same-origin checks run in the main Worker before this handler. */
export async function mailApi(request: Request, store: MailStore): Promise<Response> {
  const path = new URL(request.url).pathname
  if (path === '/api/mail/accounts' && request.method === 'GET') return json(store.accounts())
  const id = /^\/api\/mail\/accounts\/([a-zA-Z0-9-]{1,80})$/.exec(path)?.[1]
  if (!id) return json({ error: 'Not found' }, 404)
  if (request.method === 'DELETE') {
    store.remove(id)
    return json({ removed: true })
  }
  if (request.method !== 'PUT') return json({ error: 'Method not allowed' }, 405)
  const input = parseMailAccountInput(await readJson(request, 2048))
  if (!input) return json({ error: 'Choose a provider, enter a valid email address and keep the label under 81 characters. Do not include credentials.' }, 400)
  try {
    return json(store.save(id, input))
  } catch (cause) {
    if (cause instanceof MailConflict) return json({ error: cause.message }, 409)
    throw cause
  }
}
