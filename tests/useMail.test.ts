// @vitest-environment jsdom
import { act, createElement, StrictMode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { useMail } from '../src/shared/hooks/useMail'
import { mailService } from '../src/services/mailService'
import type { MailAccount } from '../src/shared/types/mail'

vi.mock('../src/services/mailService', () => ({ mailService: { load: vi.fn(), save: vi.fn(), remove: vi.fn() } }))
const account: MailAccount = { id: 'first', provider: 'gmail', address: 'first@example.com', label: 'Personal', status: 'setup-required', createdAt: '2026-10-27T00:00:00Z' }
let root: Root, container: HTMLDivElement, mail: ReturnType<typeof useMail>
function Probe({ active = true, enabled = true, search = '' }: { active?: boolean; enabled?: boolean; search?: string }) { mail = useMail(active, enabled, search); return null }
async function render(props = {}) { await act(async () => root.render(createElement(StrictMode, null, createElement(Probe, props)))) }
beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  container = document.createElement('div'); document.body.append(container); root = createRoot(container)
  vi.mocked(mailService.load).mockResolvedValue([account])
  vi.mocked(mailService.save).mockResolvedValue({ ...account, label: 'Updated' })
  vi.mocked(mailService.remove).mockResolvedValue(undefined)
})
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.resetAllMocks(); vi.unstubAllGlobals() })

it('loads on entry, filters saved accounts and preserves the registry on a failed reload', async () => {
  await render({ active: false }); expect(mailService.load).not.toHaveBeenCalled()
  await render({ search: 'PERSONAL' }); expect(mail.matchingAccounts).toEqual([account])
  await render({ search: 'missing' }); expect(mail.matchingAccounts).toEqual([])
  vi.mocked(mailService.load).mockRejectedValueOnce(new Error('Offline'))
  await act(async () => mail.refresh())
  expect(mail.accounts).toEqual([account]); expect(mail.error).toBe('Offline')
  expect(mail.loading).toBe(false)
})

it('retains a failed edit and coalesces duplicate saves before the next render', async () => {
  await render()
  await act(async () => mail.openEditor(account))
  vi.mocked(mailService.save).mockRejectedValueOnce(new Error('Address already saved'))
  const input = { provider: account.provider, address: account.address, label: 'Updated' }
  await act(async () => mail.save(input))
  expect(mail.editor?.id).toBe(account.id)
  expect(mail.formError).toBe('Address already saved')
  expect(mail.accounts).toEqual([account])
  let finish!: (saved: MailAccount) => void
  vi.mocked(mailService.save).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
  let pending!: Promise<void>
  await act(async () => {
    pending = mail.save(input)
    void mail.save(input)
    mail.closeEditor()
  })
  expect(mailService.save).toHaveBeenCalledTimes(2)
  expect(mail.editor?.id).toBe(account.id)
  await act(async () => { finish({ ...account, label: 'Updated' }); await pending })
  expect(mail.editor).toBeNull()
  expect(mail.accounts?.[0].label).toBe('Updated')
})

it('keeps accounts on failed removal and resets a removed mailbox selection after success', async () => {
  await render()
  await act(async () => mail.setAccountId(account.id))
  vi.mocked(mailService.remove).mockRejectedValueOnce(new Error('Offline'))
  await act(async () => mail.remove(account))
  expect(mail.accounts).toEqual([account]); expect(mail.accountId).toBe(account.id)
  expect(mail.error).toBe('Offline')
  await act(async () => mail.remove(account))
  expect(mail.accounts).toEqual([]); expect(mail.accountId).toBe('all')
})

it('aborts abandoned reads and ignores late responses after sign-out', async () => {
  const pending: { signal: AbortSignal; resolve: (accounts: MailAccount[]) => void }[] = []
  vi.mocked(mailService.load).mockImplementation((signal) => new Promise((resolve) => pending.push({ signal, resolve })))
  await render()
  await render({ enabled: false })
  expect(pending.every(({ signal }) => signal.aborted)).toBe(true)
  await act(async () => pending.forEach(({ resolve }) => resolve([account])))
  expect(mail.accounts).toBeNull(); expect(mail.loading).toBe(false)
})

it('ignores a late write after leaving Mail and reloads server truth on reentry', async () => {
  await render()
  await act(async () => mail.openEditor(account))
  let finish!: (saved: MailAccount) => void
  vi.mocked(mailService.save).mockReturnValueOnce(new Promise((resolve) => { finish = resolve }))
  let pending!: Promise<void>
  await act(async () => { pending = mail.save({ provider: 'gmail', address: account.address, label: 'Late' }) })
  const signal = vi.mocked(mailService.save).mock.calls[0][2]
  await render({ active: false })
  expect(signal.aborted).toBe(true)
  await act(async () => { finish({ ...account, label: 'Late' }); await pending })
  expect(mail.accounts).toEqual([account]); expect(mail.editor).toBeNull()
  vi.mocked(mailService.load).mockResolvedValueOnce([{ ...account, label: 'Server' }])
  await render()
  expect(mail.accounts?.[0].label).toBe('Server')
})
