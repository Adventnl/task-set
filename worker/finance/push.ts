import {
  buildPushPayload,
  type PushSubscription,
} from '@block65/webcrypto-web-push'
import type { AkahuEnv } from './akahu'

/** Only recognised browser push services are eligible; user input can never target arbitrary servers. */
export function parseSubscription(value: unknown): PushSubscription {
  const s = value as Partial<PushSubscription> | null
  if (
    !s ||
    typeof s.endpoint !== 'string' ||
    !s.keys ||
    !/^[A-Za-z0-9_-]{80,100}$/.test(s.keys.p256dh) ||
    !/^[A-Za-z0-9_-]{20,30}$/.test(s.keys.auth)
  )
    throw new Error('Invalid push subscription')
  const url = new URL(s.endpoint)
  if (
    url.protocol !== 'https:' ||
    url.port ||
    url.username ||
    url.password ||
    ![
      'fcm.googleapis.com',
      'updates.push.services.mozilla.com',
      'web.push.apple.com',
    ].includes(url.hostname)
  )
    throw new Error('Unsupported push service')
  return s as PushSubscription
}
export async function deliverPush(
  storage: DurableObjectStorage,
  env: AkahuEnv,
  test = false,
): Promise<void> {
  if (!env.VAPID_PRIVATE_KEY || !env.VAPID_PUBLIC_KEY || !env.VAPID_SUBJECT) {
    if (test) throw new Error('Web Push is not configured on the server')
    return
  }
  const settingsRow = storage.sql
    .exec<{ body: string }>(
      "SELECT body FROM finance_settings WHERE id='preferences'",
    )
    .toArray()[0]
  const settings = settingsRow
    ? (JSON.parse(settingsRow.body) as {
        push: boolean
        notifications?: boolean
      })
    : { push: false, notifications: true }
  if (!test && (!settings.push || settings.notifications === false)) return
  const notifications = storage.sql
    .exec<{ id: string; transaction_id: string }>(
      "SELECT id, transaction_id FROM finance_notifications WHERE push_status = 'pending' ORDER BY created_at LIMIT 100",
    )
    .toArray()
  if (!test && !notifications.length) return
  const subscriptions = storage.sql
    .exec<{ id: string; body: string }>('SELECT id, body FROM finance_push')
    .toArray()
  if (test && !subscriptions.length)
    throw new Error('Enable notifications on this device first')
  let failed = false
  for (const row of subscriptions) {
    const pending = notifications.filter(
      (n) =>
        !storage.sql
          .exec(
            'SELECT id FROM finance_push_deliveries WHERE id = ?',
            `${row.id}:${n.id}`,
          )
          .toArray().length,
    )
    if (!test && !pending.length) continue
    const batchId = test
      ? crypto.randomUUID()
      : pending.map((n) => n.id).join(':')
    const subscription = parseSubscription(JSON.parse(row.body))
    const data = JSON.stringify({
      title: test
        ? 'Finance notifications enabled'
        : 'New transactions detected',
      body: test
        ? 'This device can receive Finance review reminders.'
        : `${pending.length} new transaction${pending.length === 1 ? '' : 's'} available to review.`,
      tag: `finance:${batchId}`,
      url:
        pending.length === 1
          ? `/#finance/${encodeURIComponent(pending[0].transaction_id)}`
          : '/#finance',
    })
    try {
      const payload = await buildPushPayload(
        { data, options: { ttl: 3600 } },
        subscription,
        {
          subject: env.VAPID_SUBJECT,
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
        },
      )
      const response = await fetch(subscription.endpoint, {
        ...payload,
        redirect: 'manual',
        signal: AbortSignal.timeout(15000),
      })
      if (response.status === 404 || response.status === 410)
        storage.sql.exec('DELETE FROM finance_push WHERE id = ?', row.id)
      else if (!response.ok) {
        failed = true
        continue
      }
      for (const n of pending)
        storage.sql.exec(
          'INSERT OR IGNORE INTO finance_push_deliveries VALUES (?)',
          `${row.id}:${n.id}`,
        )
    } catch {
      failed = true
    }
  }
  if (test && failed)
    throw new Error(
      'Push delivery failed. Check the server configuration and device subscription.',
    )
  if (!failed && subscriptions.length)
    for (const n of notifications)
      storage.sql.exec(
        "UPDATE finance_notifications SET push_status = 'sent' WHERE id = ?",
        n.id,
      )
}
