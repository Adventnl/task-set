import { deleteMailAccount, getMailAccounts, putMailAccount } from '../connectors/mailConnector'
import type { MailAccountInput } from '../shared/types/mail'
import { parseMailAccountInput } from '../shared/utils/mail'

export const mailService = {
  load: getMailAccounts,
  async save(id: string, input: MailAccountInput, signal: AbortSignal) {
    const parsed = parseMailAccountInput(input)
    if (!parsed) throw new Error('Enter a valid email address and a label of up to 80 characters.')
    return putMailAccount(id, parsed, signal)
  },
  remove: deleteMailAccount,
}
