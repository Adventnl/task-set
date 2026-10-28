import ExcelJS from 'exceljs'
import type { FinanceBalance } from '../../src/shared/types/finance'
import { nzDay } from '../../src/shared/utils/finance'
import { csvCell } from '../../src/shared/utils/finance'
import { financeFilter } from './filters'
import type { FinanceStore } from './store'

export async function report(
  store: FinanceStore,
  storage: DurableObjectStorage,
  url: URL,
): Promise<Response> {
  const filter = financeFilter(url),
    data = store.transactions(filter, true),
    metadata = store.metadata()
  let headings = [
    'Record ID',
    'Akahu ID',
    'Transaction date',
    'Detected at',
    'Account',
    'Merchant',
    'Original description',
    'Category',
    'Amount',
    'Currency',
    'Status',
    'Review',
    'Notes',
    'Tags',
    'Transfer match',
    'Refund match',
  ]
  let rows: (string | number | Date | null)[][] = data.items.map((t) => [
    t.id,
    t.providerId,
    new Date(t.date),
    new Date(t.importedAt),
    metadata.accounts.find((a) => a.id === t.accountId)?.name ?? t.accountId,
    t.merchant,
    t.description,
    metadata.categories.find((c) => c.id === t.category)?.name ?? t.category,
    t.amount / 100,
    t.currency,
    t.status,
    t.review,
    t.notes,
    t.tags.join(', '),
    t.transferId,
    t.refundId,
  ])
  const type = url.searchParams.get('type') ?? 'Transaction Register',
    metrics = store.metrics(filter)
  const allBalances = storage.sql
    .exec<{ body: string }>(
      'SELECT body FROM finance_balances ORDER BY observed_at',
    )
    .toArray()
    .map((r) => JSON.parse(r.body) as FinanceBalance)
    .filter(
      (b) =>
        (!filter.account || b.accountId === filter.account) &&
        (!filter.start ||
          nzDay(b.reportedAt ?? b.observedAt) >= filter.start) &&
        (!filter.end || nzDay(b.reportedAt ?? b.observedAt) <= filter.end),
    )
  const types = [
    'Monthly Financial Summary',
    'Annual Financial Summary',
    'Income and Expense Statement',
    'Cash Flow Summary',
    'Category Spending Breakdown',
    'Merchant Spending Report',
    'Transaction Register',
    'Account Balance History',
    'Budget Versus Actual Report',
    'Recurring Payment Summary',
    'Custom Date Range Report',
  ]
  if (!types.includes(type)) throw new Error('Unknown report type')
  if (
    type === 'Category Spending Breakdown' ||
    type === 'Income and Expense Statement'
  ) {
    headings = ['Category', 'Kind', 'Net Amount NZD']
    const amounts = new Map<string, number>()
    for (const t of data.items)
      if (
        t.currency === 'NZD' &&
        t.status === 'settled' &&
        !t.excluded &&
        !t.transferId
      )
        for (const split of t.splits.length
          ? t.splits
          : [{ category: t.category, amount: t.amount }])
          amounts.set(
            split.category,
            (amounts.get(split.category) ?? 0) + split.amount,
          )
    rows = [...amounts].map(([id, amount]) => [
      metadata.categories.find((c) => c.id === id)?.name ?? id,
      metadata.categories.find((c) => c.id === id)?.kind ?? 'special',
      amount / 100,
    ])
  } else if (type === 'Merchant Spending Report') {
    headings = ['Merchant', 'Net Spending NZD', 'Transactions']
    rows = metrics.merchants.map((m) => [m.id, m.amount / 100, m.count])
  } else if (type === 'Account Balance History') {
    headings = [
      'Account',
      'Bank Reported At UTC',
      'Observed At UTC',
      'Current',
      'Available',
      'Currency',
    ]
    rows = allBalances.map((b) => [
      b.accountId,
      b.reportedAt ? new Date(b.reportedAt) : null,
      new Date(b.observedAt),
      b.current === null ? null : b.current / 100,
      b.available === null ? null : b.available / 100,
      b.currency,
    ])
  } else if (type === 'Budget Versus Actual Report') {
    headings = [
      'Category',
      'Period From',
      'Period To',
      'Budget NZD',
      'Spent NZD',
      'Remaining NZD',
    ]
    rows = metrics.budgetUsage.map((u) => {
      const b = metadata.budgets.find((b) => b.id === u.id)!
      return [
        b.category,
        u.start,
        u.end,
        b.amount / 100,
        u.spent / 100,
        (b.amount - u.spent) / 100,
      ]
    })
  } else if (type === 'Recurring Payment Summary') {
    headings = [
      'Merchant',
      'Amount NZD',
      'Frequency',
      'Last Payment',
      'Estimated Next',
      'Annual Equivalent NZD',
    ]
    rows = store
      .recurring({ ...filter, start: '', end: '' })
      .filter((r) => r.confirmed && r.active)
      .map((r) => [
        r.merchant,
        r.amount / 100,
        r.frequency,
        new Date(r.lastPayment),
        new Date(r.estimatedNext),
        r.annualEquivalent / 100,
      ])
  } else if (
    [
      'Monthly Financial Summary',
      'Annual Financial Summary',
      'Cash Flow Summary',
    ].includes(type)
  ) {
    headings = ['Period', 'Income NZD', 'Expenses NZD', 'Net Cash Flow NZD']
    const periods = new Map<string, { income: number; expenses: number }>()
    for (const m of metrics.months) {
      const key = type === 'Annual Financial Summary' ? m.id.slice(0, 4) : m.id,
        previous = periods.get(key) ?? { income: 0, expenses: 0 }
      periods.set(key, {
        income: previous.income + m.income,
        expenses: previous.expenses + m.expenses,
      })
    }
    rows = [...periods].map(([id, v]) => [
      id,
      v.income / 100,
      v.expenses / 100,
      (v.income - v.expenses) / 100,
    ])
  }
  const format = url.searchParams.get('format') ?? 'csv'
  let content: BodyInit
  if (format === 'xlsx') {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = 'Task Set'
    workbook.created = new Date()
    const summary = workbook.addWorksheet('Summary')
    summary.addRows([
      [type, 'NZD — Pacific/Auckland'],
      ['Period from', filter.start || 'All retained history'],
      ['Period to', filter.end || 'Latest available'],
      ['Income (settled)', data.income / 100],
      ['Expenses net of matched refunds', data.expenses / 100],
      ['Net cash flow', (data.income - data.expenses) / 100],
      ['Transactions', data.total],
      ['Last application sync', metadata.lastSync],
      [
        'Limitations',
        'Pending and confirmed transfers excluded from totals. Bank history may be incomplete. Dates in transaction sheet are UTC.',
      ],
    ])
    summary.getColumn(1).width = 38
    summary.getColumn(2).width = 70
    for (let i = 4; i <= 6; i++)
      summary.getCell(i, 2).numFmt = '"NZ$"#,##0.00;[Red]-"NZ$"#,##0.00'
    const sheet = workbook.addWorksheet(
      type === 'Transaction Register' || type === 'Custom Date Range Report'
        ? 'Transactions'
        : 'Report',
    )
    sheet.addRow(headings)
    rows.forEach((r) => sheet.addRow(r))
    sheet.views = [{ state: 'frozen', ySplit: 1 }]
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headings.length },
    }
    sheet.columns.forEach((col) => {
      col.width = 24
    })
    sheet.getColumn(
      type === 'Transaction Register' || type === 'Custom Date Range Report'
        ? 9
        : 2,
    ).numFmt = '"NZ$"#,##0.00;[Red]-"NZ$"#,##0.00'
    sheet.eachRow((row, index) => {
      if (index > 1)
        row.eachCell((cell) => {
          if (cell.value instanceof Date) cell.numFmt = 'yyyy-mm-dd hh:mm'
        })
    })
    const balances = workbook.addWorksheet('Observed Balances')
    balances.addRow([
      'Account',
      'Reported at UTC',
      'Observed at UTC',
      'Current',
      'Available',
      'Currency',
    ])
    allBalances.forEach((b) =>
      balances.addRow([
        b.accountId,
        b.reportedAt ? new Date(b.reportedAt) : null,
        new Date(b.observedAt),
        b.current === null ? null : b.current / 100,
        b.available === null ? null : b.available / 100,
        b.currency,
      ]),
    )
    balances.columns.forEach((c) => {
      c.width = 25
    })
    balances.getColumn(2).numFmt = balances.getColumn(3).numFmt =
      'yyyy-mm-dd hh:mm'
    const categories = workbook.addWorksheet('Categories')
    categories.addRow(['ID', 'Name', 'Kind'])
    metadata.categories.forEach((c) =>
      categories.addRow([c.id, c.name, c.kind]),
    )
    categories.columns.forEach((c) => {
      c.width = 30
    })
    for (const ws of workbook.worksheets) ws.getRow(1).font = { bold: true }
    content = new Uint8Array(await workbook.xlsx.writeBuffer())
  } else if (format === 'csv')
    content =
      '\ufeff' +
      [
        headings.map(csvCell).join(','),
        ...rows.map((r) =>
          r
            .map((v) =>
              v instanceof Date
                ? csvCell(v.toISOString())
                : typeof v === 'number'
                  ? String(v)
                  : csvCell(v),
            )
            .join(','),
        ),
      ].join('\r\n')
  else throw new Error('Unsupported report format')
  const bytes =
    typeof content === 'string'
      ? new TextEncoder().encode(content)
      : (content as Uint8Array)
  if (bytes.byteLength > 1_500_000)
    throw new Error(
      'This report is too large to save. Choose a smaller date range or an account.',
    )
  const id = crypto.randomUUID()
  storage.sql.exec(
    'INSERT INTO finance_exports (id, created_at, body, bytes) VALUES (?, ?, ?, ?)',
    id,
    new Date().toISOString(),
    JSON.stringify({ type, format, filter, count: data.total }),
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  )
  if (url.searchParams.get('view') === '1')
    return Response.json(
      { id },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
  return new Response(content, {
    headers: {
      'Content-Type':
        format === 'xlsx'
          ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          : 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="finance-${new Date().toISOString().slice(0, 10)}.${format}"`,
      'Cache-Control': 'private, no-store',
    },
  })
}
