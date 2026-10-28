export type ReviewState = 'needs-review' | 'reviewed' | 'later' | 'ignored'
export interface FinanceAccount {
  id: string
  name: string
  institution: string
  connection: string
  type: string
  currency: string
  masked: string
  status: string
  current: number | null
  available: number | null
  balanceAt: string | null
  transactionsAt: string | null
  syncedAt: string
  included: boolean
  archived: boolean
}
export interface FinanceTransaction {
  receiptCount?: number
  upstreamMissingAt?: string | null
  id: string
  providerId: string | null
  accountId: string
  description: string
  merchant: string
  amount: number
  currency: string
  type: string
  date: string
  providerUpdatedAt: string | null
  balance: number | null
  status: 'pending' | 'settled' | 'missing-pending'
  importedAt: string
  observedAt: string
  providerCategory: string | null
  category: string
  notes: string
  tags: string[]
  review: ReviewState
  reviewedAt: string | null
  excluded: boolean
  transferId: string | null
  refundId: string | null
  ruleId: string | null
  splits: { category: string; amount: number }[]
}
export interface FinanceCategory {
  id: string
  name: string
  kind: 'income' | 'expense' | 'special'
  hidden: boolean
  color: string
  parentId: string | null
  system?: boolean
}
export interface FinanceRule {
  id: string
  text: string
  match: 'exact' | 'contains'
  category: string
  priority: number
  enabled: boolean
  accountId: string | null
  direction: 'any' | 'debit' | 'credit'
}
export interface FinanceBudget {
  id: string
  category: string | null
  amount: number
  period: 'weekly' | 'monthly'
  start: string
  archived: boolean
}
export interface FinanceNotification {
  id: string
  transactionId: string
  createdAt: string
  readAt: string | null
}
export interface FinanceBalance {
  accountId: string
  current: number | null
  available: number | null
  currency: string
  reportedAt: string | null
  observedAt: string
}
export interface FinanceSync {
  id: string
  startedAt: string
  finishedAt: string | null
  status: string
  imported: number
  error: string | null
}
export interface FinanceSettings {
  notifications: boolean
  push: boolean
  privateNotifications: boolean
  currency: string
  timezone: string
}
export interface FinanceData {
  categoryCounts?: Record<string, number>
  insightsAvailable?: boolean
  unreadCount: number
  configured: boolean
  initialized: boolean
  accounts: FinanceAccount[]
  categories: FinanceCategory[]
  rules: FinanceRule[]
  budgets: FinanceBudget[]
  notifications: FinanceNotification[]
  balances: FinanceBalance[]
  syncs: FinanceSync[]
  transactionCount: number
  earliest: string | null
  lastSync: string | null
  refreshRequestedAt: string | null
  settings: FinanceSettings
  vapidPublicKey: string | null
}
export interface FinanceFilter {
  search: string
  account: string
  category: string
  review: string
  direction: string
  start: string
  end: string
  min: string
  max: string
  tag: string
  page: number
  oldest: boolean
}
export interface FinancePage {
  items: FinanceTransaction[]
  total: number
  income: number
  expenses: number
}
export interface FinanceEdit {
  category: string
  notes: string
  tags: string[]
  review: ReviewState
  excluded: boolean
  transferId: string | null
  refundId: string | null
  splits: { category: string; amount: number }[]
  createRule: boolean
}
export type FinanceTab =
  | 'Overview'
  | 'Review Inbox'
  | 'Transactions'
  | 'Accounts'
  | 'Analytics'
  | 'Reports'
  | 'Finance Settings'
  | 'Categories'
export interface FinanceMetrics {
  todayIncome: number
  todaySpending: number
  monthIncome: number
  monthExpenses: number
  previousExpenses: number
  median: number | null
  income: number
  expenses: number
  net: number
  count: number
  reviewCount: number
  reviewIncome: number
  reviewExpenses: number
  categories: { id: string; amount: number }[]
  months: { id: string; income: number; expenses: number }[]
  merchants: { id: string; amount: number; count: number }[]
  daily: { id: string; amount: number }[]
  budgetUsage: { id: string; spent: number; start: string; end: string }[]
}

export interface RecurringPayment {
  id: string
  merchant: string
  amount: number
  frequency: 'weekly' | 'fortnightly' | 'monthly' | 'annual'
  lastPayment: string
  estimatedNext: string
  monthlyEquivalent: number
  annualEquivalent: number
  confirmed: boolean
  active: boolean
  notes: string
}

export interface FinanceAttachment {
  id: string
  name: string
  mime: string
  created_at: string
}
export interface FinanceDetail {
  transaction: FinanceTransaction
  audit: { changed_at: string; before_body: string; after_body: string }[]
  attachments: FinanceAttachment[]
  insight?: FinanceInsight | null
}

export interface FinanceInsight {
  description: string | null
  generatedAt: string
}
export interface FinanceReport {
  id: string
  createdAt: string
  type: string
  format: 'csv' | 'xlsx'
  filter: FinanceFilter
  count: number
  saved: boolean
}
export interface FinanceWorkbookPreview {
  sheets: {
    name: string
    totalRows: number
    totalColumns: number
    page: number
    rows: string[][]
  }[]
}
export interface FinanceReceiptMatch {
  merchant: string
  date: string
  amount: number
  currency: string
  candidates: FinanceTransaction[]
}
