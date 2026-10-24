export const FINANCE_SCHEMA = `
CREATE TABLE IF NOT EXISTS finance_accounts (id TEXT PRIMARY KEY, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS finance_transactions (
 id TEXT PRIMARY KEY, provider_id TEXT UNIQUE, account_id TEXT NOT NULL REFERENCES finance_accounts(id),
 date TEXT NOT NULL, amount INTEGER NOT NULL, status TEXT NOT NULL, original_raw TEXT NOT NULL, raw TEXT NOT NULL, body TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS finance_tx_date ON finance_transactions(date, id);
CREATE INDEX IF NOT EXISTS finance_tx_account ON finance_transactions(account_id, date);
CREATE INDEX IF NOT EXISTS finance_tx_pending ON finance_transactions(status, account_id, amount);
CREATE TABLE IF NOT EXISTS finance_bookkeeping (transaction_id TEXT PRIMARY KEY REFERENCES finance_transactions(id), body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS finance_categories (id TEXT PRIMARY KEY, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS finance_rules (id TEXT PRIMARY KEY, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS finance_budgets (id TEXT PRIMARY KEY, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS finance_balances (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES finance_accounts(id), observed_at TEXT NOT NULL, body TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS finance_balances_date ON finance_balances(account_id, observed_at);
CREATE TABLE IF NOT EXISTS finance_notifications (id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL UNIQUE REFERENCES finance_transactions(id), created_at TEXT NOT NULL, read_at TEXT, push_status TEXT NOT NULL DEFAULT 'pending');
CREATE TABLE IF NOT EXISTS finance_audit (id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL REFERENCES finance_transactions(id), changed_at TEXT NOT NULL, before_body TEXT NOT NULL, after_body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS finance_syncs (id TEXT PRIMARY KEY, started_at TEXT NOT NULL, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS finance_settings (id TEXT PRIMARY KEY, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS finance_push (id TEXT PRIMARY KEY, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS finance_recurring (id TEXT PRIMARY KEY, body TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS finance_attachments (id TEXT PRIMARY KEY, transaction_id TEXT NOT NULL REFERENCES finance_transactions(id), name TEXT NOT NULL, mime TEXT NOT NULL, created_at TEXT NOT NULL, bytes BLOB NOT NULL);
CREATE TABLE IF NOT EXISTS finance_push_deliveries (id TEXT PRIMARY KEY);
CREATE TABLE IF NOT EXISTS finance_exports (id TEXT PRIMARY KEY, created_at TEXT NOT NULL, body TEXT NOT NULL);
`
export const DEFAULT_CATEGORIES = {
  income: [
    'Salary',
    'Business Income',
    'Freelance Income',
    'Interest',
    'Refunds',
    'Gifts Received',
    'Other Income',
  ],
  expense: [
    'Groceries',
    'Restaurants',
    'Coffee & Drinks',
    'Shopping',
    'Clothing',
    'Electronics',
    'Transport',
    'Fuel',
    'Public Transport',
    'Travel',
    'Accommodation',
    'Entertainment',
    'Subscriptions',
    'Utilities',
    'Housing',
    'Education',
    'Healthcare',
    'Insurance',
    'Banking Fees',
    'Gifts',
    'Donations',
    'Taxes',
    'Other Expenses',
  ],
  special: [
    'Internal Transfer',
    'Savings Transfer',
    'Credit Card Payment',
    'Cash Withdrawal',
    'Refund / Reversal',
    'Uncategorized',
  ],
} as const
export function categoryId(name: string): string {
  return name
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '-')
    .replace(/-$/, '')
}
