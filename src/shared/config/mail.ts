import type { MailProvider } from '../types/mail'

export const MAIL_PROVIDERS: Record<MailProvider, {
  name: string
  method: string
  summary: string
  steps: readonly string[]
  guideUrl: string
  webmailUrl: string
}> = {
  gmail: {
    name: 'Gmail',
    method: 'Google authorization',
    summary: 'Each Gmail or Google Workspace account will need its own authorization.',
    steps: [
      'Configure a Google OAuth app with the Gmail API enabled.',
      'Authorize each account separately with read-only mail access.',
      'Task Set still needs the OAuth callback, secure token storage and mail sync before linking is available.',
    ],
    guideUrl: 'https://developers.google.com/workspace/gmail/api/auth/scopes',
    webmailUrl: 'https://mail.google.com/',
  },
  proton: {
    name: 'Proton Mail',
    method: 'Proton Mail Bridge',
    summary: 'Proton’s encrypted mail needs Bridge on a computer. Bridge requires a paid Proton Mail plan.',
    steps: [
      'Install Proton Mail Bridge on a computer and sign in to each Proton account.',
      'Bridge provides local IMAP access; the hosted Task Set app cannot reach it directly.',
      'Task Set needs a secure companion connection to that computer before Proton mail can appear here.',
    ],
    guideUrl: 'https://proton.me/support/imap-smtp-and-pop3-setup',
    webmailUrl: 'https://mail.proton.me/',
  },
  purelymail: {
    name: 'Purelymail',
    method: 'IMAP over TLS',
    summary: 'Use your full mailbox address, including your own domain. Aliases can share one underlying mailbox.',
    steps: [
      'Use imap.purelymail.com on port 993 with SSL/TLS and your full email address as the username.',
      'If two-factor authentication is enabled, create an app password in Purelymail.',
      'Task Set still needs secure credential storage and an IMAP sync connector before linking is available.',
    ],
    guideUrl: 'https://purelymail.com/docs/setup/technical',
    webmailUrl: 'https://inbox.purelymail.com/',
  },
}

export const MAIL_PROVIDER_IDS = Object.keys(MAIL_PROVIDERS) as MailProvider[]
