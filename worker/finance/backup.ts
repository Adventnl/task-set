import { Buffer } from 'node:buffer'
import { object } from './akahu'

// Constant table membership and columns prevent restored content from becoming SQL identifiers.
const TABLES = [
  'accounts',
  'categories',
  'rules',
  'budgets',
  'transactions',
  'bookkeeping',
  'balances',
  'notifications',
  'audit',
  'syncs',
  'settings',
  'exports',
  'recurring',
  'attachments',
] as const
const bytesToBase64 = (bytes: ArrayBuffer) =>
  Buffer.from(bytes).toString('base64')
export function backup(storage: DurableObjectStorage): Response {
  const encoder = new TextEncoder()
  const snapshot = storage.transactionSync(
    () =>
      new Map(
        TABLES.map((table) => [
          table,
          storage.sql.exec(`SELECT * FROM finance_${table}`).toArray(),
        ]),
      ),
  )
  function* chunks(): Generator<string> {
    yield '{"version":1,"tables":{'
    for (const [index, table] of TABLES.entries()) {
      yield `${index ? ',' : ''}"${table}":[`
      let first = true
      for (const row of snapshot.get(table)!) {
        const values = { ...row }
        if (table === 'attachments' || table === 'exports') {
          if (values.bytes instanceof ArrayBuffer)
            values.bytes = bytesToBase64(values.bytes)
          else if (ArrayBuffer.isView(values.bytes))
            values.bytes = Buffer.from(
              values.bytes.buffer,
              values.bytes.byteOffset,
              values.bytes.byteLength,
            ).toString('base64')
        }
        yield (first ? '' : ',') + JSON.stringify(values)
        first = false
      }
      yield ']'
    }
    yield '}}'
  }
  const iterator = chunks()
  return new Response(
    new ReadableStream({
      pull(controller) {
        const next = iterator.next()
        if (next.done) controller.close()
        else controller.enqueue(encoder.encode(next.value))
      },
    }),
    {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition':
          'attachment; filename="finance-private-backup.json"',
        'Cache-Control': 'private, no-store',
      },
    },
  )
}
export function restore(storage: DurableObjectStorage, value: unknown): void {
  const data = object(value)
  if (data.version !== 1) throw new Error('Unsupported backup version')
  const tables = object(data.tables),
    checked = new Map<
      string,
      { columns: string[]; rows: Record<string, unknown>[] }
    >()
  for (const table of TABLES) {
    const source = tables[table]
    if (!Array.isArray(source)) throw new Error('Incomplete finance backup')
    const columns = storage.sql
      .exec<{ name: string }>(`PRAGMA table_info(finance_${table})`)
      .toArray()
      .map((c) => c.name)
    const rows = source.map((value) => {
      const row = { ...object(value) }
      // Older backups predate saved workbook binaries.
      if (table === 'exports' && !('bytes' in row)) row.bytes = null
      if (
        Object.keys(row).length !== columns.length ||
        columns.some((name) => !(name in row))
      )
        throw new Error('Backup columns do not match')
      for (const [key, value] of Object.entries(row))
        if (
          (!['string', 'number'].includes(typeof value) && value !== null) ||
          (typeof value === 'number' && !Number.isSafeInteger(value))
        )
          throw new Error('Invalid backup value: ' + key)
      if (typeof row.body === 'string' && table !== 'settings') {
        const body = object(JSON.parse(row.body))
        if (
          table === 'transactions' &&
          (!Number.isSafeInteger(body.amount) ||
            !['settled', 'pending', 'missing-pending'].includes(
              String(body.status),
            ) ||
            typeof body.id !== 'string' ||
            typeof body.date !== 'string' ||
            !Number.isFinite(Date.parse(body.date)))
        )
          throw new Error('Invalid transaction in backup')
      }
      if (table === 'attachments' || (table === 'exports' && row.bytes !== null)) {
        if (
          typeof row.bytes !== 'string' ||
          !/^[A-Za-z0-9+/]*={0,2}$/.test(row.bytes)
        )
          throw new Error('Invalid attachment in backup')
        return {
          ...row,
          bytes: Uint8Array.from(Buffer.from(row.bytes, 'base64')).buffer,
        }
      }
      return row
    })
    checked.set(table, { columns, rows })
  }
  storage.transactionSync(() => {
    for (const table of [...TABLES].reverse())
      storage.sql.exec(`DELETE FROM finance_${table}`)
    // Push subscriptions are intentionally absent from backups and reset on restore.
    storage.sql.exec(
      'DELETE FROM finance_push; DELETE FROM finance_push_deliveries;',
    )
    for (const table of TABLES) {
      const { columns, rows } = checked.get(table)!
      for (const row of rows)
        storage.sql.exec(
          `INSERT INTO finance_${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`,
          ...columns.map((c) => row[c] as string | number | null | ArrayBuffer),
        )
    }
  })
}
