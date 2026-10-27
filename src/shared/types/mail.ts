export type MailProvider = 'gmail' | 'proton' | 'purelymail'

/** Setup metadata only. Provider credentials and mail are not collected in this stage. */
export interface MailAccountInput {
  provider: MailProvider
  address: string
  label: string
}

export interface MailAccount extends MailAccountInput {
  id: string
  status: 'setup-required'
  createdAt: string
}

export interface MailAccountEditor extends MailAccountInput {
  id: string
  existing: boolean
}
