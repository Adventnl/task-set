import { DurableObject } from 'cloudflare:workers'
import type { LiveMessage, PullResponse, SyncRecord } from '../src/shared/types/sync'
import type { Capture } from '../src/shared/types/task'
import { extractSuggestions } from './extraction'
import { CHILD_TYPE, deletedRecord, mergeRecord, parentOf, suggestionTask } from './merge'
import type { Suggestion } from './validation'

const PAGE_SIZE = 500
const AI_BATCH = 5
const MAX_AI_ATTEMPTS = 3
const AI_RETRY_BASE_MS = 15_000

type RecordType = SyncRecord['type']
type RecordRow = { type: RecordType; body: string; seq: number }
type QueueRow = { capture_id: string; attempts: number }

/**
 * One private workspace. SQLite holds every record with a change sequence number; devices pull
 * by sequence and are nudged over hibernating WebSockets when it moves. `parent_id` links a child
 * to its parent (a task to its capture, a meeting note to its meeting) so deletions cascade.
 */
export class TaskSpace extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'))
    ctx.blockConcurrencyWhile(async () => {
      const sql = this.ctx.storage.sql
      sql.exec(`
        CREATE TABLE IF NOT EXISTS records (
          type TEXT NOT NULL,
          id TEXT NOT NULL,
          parent_id TEXT,
          body TEXT NOT NULL,
          seq INTEGER NOT NULL,
          PRIMARY KEY (type, id)
        );
        CREATE INDEX IF NOT EXISTS records_by_seq ON records (seq);
        CREATE TABLE IF NOT EXISTS ai_queue (
          capture_id TEXT PRIMARY KEY,
          attempts INTEGER NOT NULL,
          run_at INTEGER NOT NULL
        );
      `)
      // Before meetings, the only parent was a capture, in a column named for it.
      const columns = sql.exec<{ name: string }>('PRAGMA table_info(records)').toArray()
      if (columns.some((column) => column.name === 'capture_id')) {
        sql.exec('DROP INDEX IF EXISTS records_by_capture; ALTER TABLE records RENAME COLUMN capture_id TO parent_id;')
      }
      sql.exec('CREATE INDEX IF NOT EXISTS records_by_parent ON records (type, parent_id);')
    })
  }

  pull(since: number): PullResponse {
    const latest = this.latestSeq()
    // A cursor ahead of the server means storage was reset: send everything again.
    const from = since > latest ? 0 : since
    const rows = this.ctx.storage.sql
      .exec<RecordRow>('SELECT type, body, seq FROM records WHERE seq > ? ORDER BY seq LIMIT ?', from, PAGE_SIZE + 1)
      .toArray()
    const page = rows.slice(0, PAGE_SIZE)
    return {
      records: page.map((row) => ({ type: row.type, value: JSON.parse(row.body) }) as SyncRecord),
      cursor: page.at(-1)?.seq ?? latest,
      more: rows.length > PAGE_SIZE,
    }
  }

  async push(records: SyncRecord[]): Promise<{ cursor: number }> {
    const start = this.latestSeq()
    let seq = start
    let queued = false
    // Parents first so children in the same batch always follow their parent.
    const ordered = [...records].sort((a, b) => Number(!!parentOf(a)) - Number(!!parentOf(b)))
    for (const record of ordered) {
      const merged = mergeRecord(this.read(record.type, record.value.id), record)
      if (!merged) continue
      const next = this.withoutDeletedParent(merged)
      this.write(next, ++seq)
      if (next.type === 'capture' && next.value.ai === 'queued') {
        this.ctx.storage.sql.exec('INSERT OR REPLACE INTO ai_queue VALUES (?, 0, ?)', next.value.id, Date.now())
        queued = true
      }
      if (next.value.deletedAt) seq = this.deleteChildren(next, seq)
    }
    if (queued) await this.ctx.storage.setAlarm(Date.now())
    if (seq !== start) this.broadcast(seq)
    return { cursor: seq }
  }

  /** Requeues a capture whose extraction failed. Returns false when there is nothing to retry. */
  async retryAi(captureId: string): Promise<boolean> {
    const capture = this.readCapture(captureId)
    if (!capture || capture.deletedAt || capture.ai !== 'failed') return false
    const seq = this.latestSeq() + 1
    this.write({ type: 'capture', value: { ...capture, ai: 'queued' } }, seq)
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO ai_queue VALUES (?, 0, ?)', captureId, Date.now())
    await this.ctx.storage.setAlarm(Date.now())
    this.broadcast(seq)
    return true
  }

  async fetch(request: Request): Promise<Response> {
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
      return Response.json({ error: 'Expected a WebSocket' }, { status: 426 })
    }
    const { 0: client, 1: server } = new WebSocketPair()
    this.ctx.acceptWebSocket(server)
    return new Response(null, { status: 101, webSocket: client })
  }

  // Clients only send keep-alive pings, which the auto-response answers without waking the object.
  webSocketMessage(): void {}

  async alarm(): Promise<void> {
    const jobs = this.ctx.storage.sql
      .exec<QueueRow>('SELECT capture_id, attempts FROM ai_queue WHERE run_at <= ? ORDER BY run_at LIMIT ?', Date.now(), AI_BATCH)
      .toArray()
    for (const job of jobs) await this.runExtraction(job)
    const next = this.ctx.storage.sql.exec<{ run_at: number | null }>('SELECT MIN(run_at) AS run_at FROM ai_queue').one().run_at
    if (next !== null) await this.ctx.storage.setAlarm(Math.max(next, Date.now()))
  }

  private async runExtraction(job: QueueRow): Promise<void> {
    const capture = this.readCapture(job.capture_id)
    if (!capture || capture.deletedAt) {
      this.ctx.storage.sql.exec('DELETE FROM ai_queue WHERE capture_id = ?', job.capture_id)
      return
    }
    let suggestions: Suggestion[]
    try {
      suggestions = await extractSuggestions(this.env, capture)
    } catch (error) {
      this.recordFailure(job, error)
      return
    }
    // Other requests may run during the AI call; re-read so a deletion is respected.
    const latest = this.readCapture(capture.id)
    this.ctx.storage.sql.exec('DELETE FROM ai_queue WHERE capture_id = ?', capture.id)
    if (!latest || latest.deletedAt) return
    let seq = this.latestSeq()
    suggestions.forEach((suggestion, index) => {
      const task = suggestionTask(latest, suggestion, index)
      if (!this.read('task', task.id)) this.write({ type: 'task', value: task }, ++seq)
    })
    this.write({ type: 'capture', value: { ...latest, ai: 'ready' } }, ++seq)
    this.broadcast(seq)
  }

  /** Backs off and retries; after the last attempt the capture shows a manual retry. */
  private recordFailure(job: QueueRow, error: unknown): void {
    const attempts = job.attempts + 1
    const message = error instanceof Error ? error.message : String(error)
    console.error(JSON.stringify({ event: 'ai_extraction_failed', attempts, message }))
    if (attempts < MAX_AI_ATTEMPTS) {
      const runAt = Date.now() + AI_RETRY_BASE_MS * 4 ** job.attempts
      this.ctx.storage.sql.exec('UPDATE ai_queue SET attempts = ?, run_at = ? WHERE capture_id = ?', attempts, runAt, job.capture_id)
      return
    }
    this.ctx.storage.sql.exec('DELETE FROM ai_queue WHERE capture_id = ?', job.capture_id)
    const latest = this.readCapture(job.capture_id)
    if (!latest || latest.deletedAt) return
    const seq = this.latestSeq() + 1
    this.write({ type: 'capture', value: { ...latest, ai: 'failed' } }, seq)
    this.broadcast(seq)
  }

  /** A child made on one device for a parent deleted on another is deleted too. */
  private withoutDeletedParent(record: SyncRecord): SyncRecord {
    const parent = parentOf(record)
    const deletedAt = parent && !record.value.deletedAt ? this.read(parent.type, parent.id)?.value.deletedAt : null
    return deletedAt ? deletedRecord(record, deletedAt) : record
  }

  /** Deletes a deleted parent's children; deleting a capture also cancels its pending AI work. */
  private deleteChildren(parent: SyncRecord, seq: number): number {
    if (parent.type === 'capture') this.ctx.storage.sql.exec('DELETE FROM ai_queue WHERE capture_id = ?', parent.value.id)
    const childType = CHILD_TYPE[parent.type]
    if (!childType) return seq
    const rows = this.ctx.storage.sql
      .exec<{ body: string }>('SELECT body FROM records WHERE type = ? AND parent_id = ?', childType, parent.value.id)
      .toArray()
    let next = seq
    for (const row of rows) {
      const child = { type: childType, value: JSON.parse(row.body) } as SyncRecord
      if (!child.value.deletedAt) this.write(deletedRecord(child, parent.value.deletedAt ?? parent.value.updatedAt), ++next)
    }
    return next
  }

  private latestSeq(): number {
    return this.ctx.storage.sql.exec<{ seq: number | null }>('SELECT MAX(seq) AS seq FROM records').one().seq ?? 0
  }

  /** Stored bodies were validated before they were written, so they are trusted here. */
  private read(type: RecordType, id: string): SyncRecord | null {
    const row = this.ctx.storage.sql.exec<{ body: string }>('SELECT body FROM records WHERE type = ? AND id = ?', type, id).toArray()[0]
    return row ? ({ type, value: JSON.parse(row.body) } as SyncRecord) : null
  }

  private readCapture(id: string): Capture | null {
    const record = this.read('capture', id)
    return record?.type === 'capture' ? record.value : null
  }

  private write(record: SyncRecord, seq: number): void {
    this.ctx.storage.sql.exec(
      'INSERT OR REPLACE INTO records (type, id, parent_id, body, seq) VALUES (?, ?, ?, ?, ?)',
      record.type,
      record.value.id,
      parentOf(record)?.id ?? null,
      JSON.stringify(record.value),
      seq,
    )
  }

  private broadcast(cursor: number): void {
    const message = JSON.stringify({ type: 'changed', cursor } satisfies LiveMessage)
    for (const socket of this.ctx.getWebSockets()) {
      try {
        socket.send(message)
      } catch {
        // The socket is already closing; that device catches up when it reconnects.
      }
    }
  }
}
