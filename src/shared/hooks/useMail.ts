import { useEffect, useRef, useState } from 'react'
import { mailService } from '../../services/mailService'
import type { MailAccount, MailAccountEditor, MailAccountInput } from '../types/mail'
import { mailAccountsMatching } from '../utils/mail'

export function useMail(active: boolean, enabled: boolean, search: string) {
  const [accounts, setAccounts] = useState<MailAccount[] | null>(null)
  const [tab, setTab] = useState<'inbox' | 'accounts'>('inbox')
  const [accountId, setAccountId] = useState('all')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editor, setEditor] = useState<MailAccountEditor | null>(null)
  const [formError, setFormError] = useState('')
  const [revision, setRevision] = useState(0)
  const writing = useRef<AbortController | null>(null)

  useEffect(() => {
    setLoading(false)
    setBusy(false)
    setEditor(null)
    setFormError('')
    if (!enabled) { setAccounts(null); setAccountId('all'); setError(''); return }
    if (!active) return
    const controller = new AbortController()
    setLoading(true)
    setError('')
    void mailService.load(AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]))
      .then((result) => {
        if (controller.signal.aborted) return
        setAccounts(result)
        setAccountId((current) => result.some((account) => account.id === current) ? current : 'all')
      })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load mail accounts. Try again.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => {
      controller.abort()
      writing.current?.abort()
      writing.current = null
    }
  }, [active, enabled, revision])

  function choose(next: 'inbox' | 'accounts') { setTab(next) }

  function openEditor(account?: MailAccount) {
    if (!enabled || !active || busy || loading || accounts === null) return
    setFormError('')
    setEditor(account ? { ...account, existing: true } : { id: crypto.randomUUID(), existing: false, provider: 'gmail', address: '', label: '' })
  }

  async function mutate(operation: (signal: AbortSignal) => Promise<void>, inForm = false) {
    if (!enabled || !active || loading || writing.current) return
    const controller = new AbortController()
    writing.current = controller
    setBusy(true)
    if (inForm) setFormError('')
    else setError('')
    try {
      await operation(AbortSignal.any([controller.signal, AbortSignal.timeout(20_000)]))
    } catch (cause) {
      if (!controller.signal.aborted) {
        const message = cause instanceof Error ? cause.message : 'Could not save mail setup. Try again.'
        if (inForm) setFormError(message)
        else setError(message)
      }
    } finally {
      if (writing.current === controller) {
        writing.current = null
        setBusy(false)
      }
    }
  }

  async function save(input: MailAccountInput) {
    if (!editor) return
    const id = editor.id
    await mutate(async (signal) => {
      const saved = await mailService.save(id, input, signal)
      if (signal.aborted) return
      setAccounts((current) => [...(current ?? []).filter((account) => account.id !== id), saved].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)))
      setEditor(null)
    }, true)
  }

  async function remove(account: MailAccount) {
    await mutate(async (signal) => {
      await mailService.remove(account.id, signal)
      if (signal.aborted) return
      setAccounts((current) => current?.filter((item) => item.id !== account.id) ?? null)
      setAccountId((current) => current === account.id ? 'all' : current)
    })
  }

  return {
    accounts, matchingAccounts: mailAccountsMatching(accounts ?? [], search), tab,
    accountId, selectedAccount: accounts?.find((account) => account.id === accountId) ?? null,
    loading, busy, error, editor, formError, choose, setAccountId, openEditor, save, remove,
    closeEditor: () => { if (!writing.current) setEditor(null) },
    refresh: () => { if (!writing.current && !loading) setRevision((current) => current + 1) },
  }
}
