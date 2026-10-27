import type {
  FinanceData,
  FinanceDetail,
  FinanceEdit,
  FinanceFilter,
  FinanceMetrics,
  FinancePage,
  RecurringPayment,
  FinanceReport,
  FinanceInsight,
  FinanceWorkbookPreview,
  FinanceReceiptMatch,
} from '../shared/types/finance'
import { requestJson } from '../shared/utils/http'
import type { FinancePreferences } from '../shared/utils/financePreferences'

export function readFinancePreferences(): unknown {
  try {
    return JSON.parse(
      localStorage.getItem('taskset.finance.preferences.v1') ?? 'null',
    )
  } catch {
    return null
  }
}
export function writeFinancePreferences(value: FinancePreferences): void {
  localStorage.setItem('taskset.finance.preferences.v1', JSON.stringify(value))
}
export async function getFinanceReports(
  signal?: AbortSignal,
): Promise<FinanceReport[]> {
  return (await requestJson('/api/finance/reports', {
    signal,
  })) as FinanceReport[]
}
export async function getFinanceWorkbookPreview(
  id: string,
): Promise<FinanceWorkbookPreview> {
  return (await requestJson(
    `/api/finance/reports/${encodeURIComponent(id)}/preview`,
  )) as FinanceWorkbookPreview
}
export async function generateFinanceInsight(
  id: string,
): Promise<FinanceInsight> {
  return (await requestJson('/api/finance/insight', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id }),
  })) as FinanceInsight
}
export async function matchFinanceReceipt(
  file: File,
): Promise<FinanceReceiptMatch> {
  if (file.size > 1024 * 1024)
    throw new Error('Receipts must be 1 MB or smaller')
  return (await requestJson('/api/finance/receipt-match', {
    method: 'POST',
    headers: {
      'Content-Type': file.type,
      'X-Filename': encodeURIComponent(file.name),
    },
    body: file,
  })) as FinanceReceiptMatch
}
export function financeQuery(filter: FinanceFilter): string {
  return new URLSearchParams(
    Object.entries(filter).map(([k, v]) => [k, String(v)]),
  ).toString()
}
export async function getFinance(signal?: AbortSignal): Promise<FinanceData> {
  return (await requestJson('/api/finance', { signal })) as FinanceData
}
export async function getFinanceTransactions(
  filter: FinanceFilter,
  signal?: AbortSignal,
): Promise<FinancePage> {
  return (await requestJson(
    `/api/finance/transactions?${financeQuery(filter)}`,
    { signal },
  )) as FinancePage
}
export async function getFinanceTransaction(
  id: string,
): Promise<FinanceDetail> {
  return (await requestJson(
    `/api/finance/transaction/${encodeURIComponent(id)}`,
  )) as FinanceDetail
}
export async function postFinance(
  path: string,
  body: unknown = {},
): Promise<void> {
  await requestJson(`/api/finance/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}
export async function saveFinanceReview(
  id: string,
  input: FinanceEdit,
): Promise<void> {
  await postFinance('review', { id, input })
}
export async function enableFinancePush(key: string): Promise<void> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window))
    throw new Error(
      'Web Push is unavailable. On iOS, install to the Home Screen first.',
    )
  const permission = await Notification.requestPermission()
  if (permission !== 'granted')
    throw new Error(
      'Notifications were not permitted. The review inbox remains available.',
    )
  const registration = await navigator.serviceWorker.getRegistration()
  if (!registration)
    throw new Error(
      'Open the built application to register its service worker before enabling push',
    )
  const decoded = atob(key.replaceAll('-', '+').replaceAll('_', '/'))
  const applicationServerKey = Uint8Array.from(decoded, (c) => c.charCodeAt(0))
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    }))
  await postFinance('push', subscription.toJSON())
}
export async function downloadFinanceReport(
  filter: FinanceFilter,
  format: string,
  type = 'Transaction Register',
): Promise<void> {
  const response = await fetch(
    `/api/finance/export?${financeQuery(filter)}&format=${format}&type=${encodeURIComponent(type)}`,
    { cache: 'no-store', credentials: 'same-origin' },
  )
  if (!response.ok)
    throw new Error(
      'Report generation failed. Try a smaller period or sign in again.',
    )
  const url = URL.createObjectURL(await response.blob()),
    a = document.createElement('a')
  a.href = url
  a.download = `finance.${format}`
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function getFinanceMetrics(
  filter: FinanceFilter,
  signal?: AbortSignal,
): Promise<FinanceMetrics> {
  return (await requestJson(`/api/finance/metrics?${financeQuery(filter)}`, {
    signal,
  })) as FinanceMetrics
}

export async function getRecurring(
  signal?: AbortSignal,
): Promise<RecurringPayment[]> {
  return (await requestJson('/api/finance/recurring', {
    signal,
  })) as RecurringPayment[]
}
export async function uploadReceipt(id: string, file: File): Promise<void> {
  if (file.size > 1024 * 1024)
    throw new Error('Receipts must be 1 MB or smaller')
  await requestJson(`/api/finance/receipts/${encodeURIComponent(id)}`, {
    method: 'POST',
    headers: {
      'Content-Type': file.type,
      'X-Filename': encodeURIComponent(file.name),
    },
    body: file,
  })
}

export async function restoreFinanceBackup(file: File): Promise<void> {
  if (file.size > 8 * 1024 * 1024)
    throw new Error(
      'Interactive restore supports backups up to 8 MB; larger datasets require an administrator restore',
    )
  await requestJson('/api/finance/restore', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Finance-Confirm': 'RESTORE FINANCE BACKUP',
    },
    body: file,
  })
}
