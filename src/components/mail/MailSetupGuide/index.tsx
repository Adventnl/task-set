import { ExternalLink } from 'lucide-react'
import { MAIL_PROVIDERS } from '../../../shared/config/mail'
import type { MailProvider } from '../../../shared/types/mail'

export default function MailSetupGuide({ provider }: { provider: MailProvider }) {
  const guide = MAIL_PROVIDERS[provider]
  return (
    <div className="mail-setup-guide">
      <p className="modal-text">{guide.summary}</p>
      <ol>{guide.steps.map((step) => <li key={step}>{step}</li>)}</ol>
      <a className="button button-quiet" href={guide.guideUrl} target="_blank" rel="noopener noreferrer">
        {guide.name} setup guide <ExternalLink size={14} aria-hidden="true" />
      </a>
    </div>
  )
}
