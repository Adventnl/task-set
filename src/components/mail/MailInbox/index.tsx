import { Inbox } from 'lucide-react'
import type { MailAccount } from '../../../shared/types/mail'

export default function MailInbox({ accounts, accountId, selectedAccount, onSelectAccount, onSetup }: {
  accounts: MailAccount[]
  accountId: string
  selectedAccount: MailAccount | null
  onSelectAccount: (id: string) => void
  onSetup: () => void
}) {
  return (
    <section aria-label="Unified inbox">
      <div className="mail-inbox-toolbar">
        <label className="field-label" htmlFor="mail-inbox-account">Mailbox</label>
        <select id="mail-inbox-account" className="text-field" value={accountId} onChange={(event) => onSelectAccount(event.target.value)}>
          <option value="all">All accounts</option>
          {accounts.map((account) => <option key={account.id} value={account.id}>{account.label ? `${account.label} · ${account.address}` : account.address}</option>)}
        </select>
      </div>
      <div className="empty-state mail-empty">
        <Inbox size={28} strokeWidth={1.5} aria-hidden="true" />
        <h2>{selectedAccount ? 'This mailbox needs setup' : 'One place for your mail'}</h2>
        <p>{selectedAccount ? `${selectedAccount.address} is saved for setup. Its messages have not been imported.` : 'Bring your Gmail, Proton Mail and Purelymail accounts together, including your own domains.'}</p>
        <p>Live mail connections are the next stage. {accounts.length ? 'Your saved accounts are ready for connection setup.' : 'Start by adding the accounts you want to link.'}</p>
        <button className="button button-primary" type="button" onClick={onSetup}>{accounts.length ? 'Review account setup' : 'Add your first account'}</button>
      </div>
    </section>
  )
}
