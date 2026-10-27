import type { MailAccount, MailAccountInput } from '../types/mail'

export const MAX_MAIL_ACCOUNTS = 100

/** A deliberately narrow boundary: setup cannot accept passwords, tokens or a connected status. */
export function parseMailAccountInput(value: unknown): MailAccountInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const input = value as Record<string, unknown>
  if (Object.keys(input).some((key) => !['provider', 'address', 'label'].includes(key))) return null
  if (input.provider !== 'gmail' && input.provider !== 'proton' && input.provider !== 'purelymail') return null
  if (typeof input.address !== 'string' || typeof input.label !== 'string') return null
  const address = input.address.trim().toLowerCase(), label = input.label.trim()
  if (address.length > 254 || !/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(address) || label.length > 80 || /[\u0000-\u001f\u007f]/.test(address + label)) return null
  return { provider: input.provider, address, label }
}

export function mailAccountsMatching(accounts: readonly MailAccount[], search: string): MailAccount[] {
  const query = search.trim().toLowerCase()
  return accounts.filter((account) => `${account.address} ${account.label} ${account.provider}`.toLowerCase().includes(query))
}
