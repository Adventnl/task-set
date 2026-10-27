import { ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { MAIL_PROVIDERS } from '../../../shared/config/mail'
import type { MailAccount } from '../../../shared/types/mail'
import MailSetupGuide from '../MailSetupGuide'

export default function MailAccounts({ accounts, total, busy, onEdit, onRemove }: {
  accounts: MailAccount[]
  total: number
  busy: boolean
  onEdit: (account: MailAccount) => void
  onRemove: (account: MailAccount) => void
}) {
  if (!accounts.length) return <p className="agenda-empty">{total ? 'No accounts match your search.' : 'No mail accounts saved yet. Add each mailbox you want to bring together.'}</p>
  return (
    <ul className="mail-accounts">
      {accounts.map((account) => (
        <li key={account.id} className="mail-account">
          <div className="mail-account-heading">
            <div className="mail-account-identity">
              <h3>{account.label || account.address}</h3>
              {account.label && <p>{account.address}</p>}
              <p>{MAIL_PROVIDERS[account.provider].name} <span aria-hidden="true">·</span> Setup required</p>
            </div>
            <div className="mail-account-actions">
              <button className="icon-button" type="button" disabled={busy} aria-label={`Edit ${account.address}`} onClick={() => onEdit(account)}><Pencil size={17} aria-hidden="true" /></button>
              <button className="icon-button" type="button" disabled={busy} aria-label={`Remove ${account.address}`} onClick={() => onRemove(account)}><Trash2 size={17} aria-hidden="true" /></button>
            </div>
          </div>
          <details className="mail-provider-details">
            <summary>Connection setup</summary>
            <MailSetupGuide provider={account.provider} />
          </details>
          <a className="button button-quiet" href={MAIL_PROVIDERS[account.provider].webmailUrl} target="_blank" rel="noopener noreferrer">Open {MAIL_PROVIDERS[account.provider].name} <ExternalLink size={14} aria-hidden="true" /></a>
        </li>
      ))}
    </ul>
  )
}
