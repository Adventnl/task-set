import type { MailAccount, MailAccountInput } from '../shared/types/mail'
import { requestJson } from '../shared/utils/http'

export async function getMailAccounts(signal: AbortSignal): Promise<MailAccount[]> {
  return await requestJson('/api/mail/accounts', { signal }) as MailAccount[]
}

export async function putMailAccount(id: string, input: MailAccountInput, signal: AbortSignal): Promise<MailAccount> {
  return await requestJson(`/api/mail/accounts/${encodeURIComponent(id)}`, {
    method: 'PUT', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input),
  }) as MailAccount
}

export async function deleteMailAccount(id: string, signal: AbortSignal): Promise<void> {
  await requestJson(`/api/mail/accounts/${encodeURIComponent(id)}`, { method: 'DELETE', signal })
}
