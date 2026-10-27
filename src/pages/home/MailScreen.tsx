import MailAccountEditor from '../../components/mail/MailAccountEditor'
import MailAccounts from '../../components/mail/MailAccounts'
import MailInbox from '../../components/mail/MailInbox'
import Tabs, { tabId } from '../../components/app/Tabs'
import type { useMail } from '../../shared/hooks/useMail'
import type { Confirmation } from '../../shared/hooks/useWorkspaceView'

const PANEL_ID = 'mail-panel'

export default function MailScreen({ mail, confirm, onClearSearch }: { mail: ReturnType<typeof useMail>; confirm: (confirmation: Confirmation) => void; onClearSearch: () => void }) {
  const tab = `mail-${mail.tab}` as 'mail-inbox' | 'mail-accounts'
  return (
    <div className="mail-screen">
      <Tabs label="Mail" tabs={[{ id: 'mail-inbox', label: 'Unified inbox', count: 0 }, { id: 'mail-accounts', label: 'Accounts', count: mail.accounts?.length ?? 0 }]} selected={tab} panelId={PANEL_ID} onSelect={(id) => { onClearSearch(); mail.choose(id === 'mail-inbox' ? 'inbox' : 'accounts') }} />
      <div className="mail-toolbar">
        <p className="modal-text">Account setup only · Mail is not connected yet</p>
        <button className="button button-quiet" type="button" disabled={mail.loading || mail.busy} onClick={mail.refresh}>{mail.loading ? 'Loading…' : 'Reload accounts'}</button>
      </div>
      {mail.error && <p className="form-error" role="alert">{mail.error}</p>}
      {mail.loading && mail.accounts === null && <p role="status">Loading mail accounts…</p>}
      <div id={PANEL_ID} role="tabpanel" aria-labelledby={tabId(tab)} aria-busy={mail.loading}>
        {mail.accounts !== null && (mail.tab === 'inbox'
          ? <MailInbox accounts={mail.accounts} accountId={mail.accountId} selectedAccount={mail.selectedAccount} onSelectAccount={mail.setAccountId} onSetup={() => { if (mail.accounts?.length) mail.choose('accounts'); else mail.openEditor() }} />
          : <MailAccounts accounts={mail.matchingAccounts} total={mail.accounts.length} busy={mail.busy || mail.loading} onEdit={mail.openEditor} onRemove={(account) => confirm({ title: 'Remove mail account setup?', message: `Remove ${account.address} from Task Set’s setup list? Your mailbox and messages stay with the provider.`, confirmLabel: 'Remove setup', onConfirm: () => mail.remove(account) })} />)}
      </div>
      {mail.editor && <MailAccountEditor key={mail.editor.id} editor={mail.editor} busy={mail.busy} error={mail.formError} onSave={mail.save} onClose={mail.closeEditor} />}
    </div>
  )
}
