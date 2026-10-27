import { expect, it, vi } from 'vitest'
import {
  merchantInsight,
  parseMerchantInsight,
} from '../worker/finance/insights'
import {
  parseReceiptFacts,
  receiptCandidates,
  readReceipt,
  readReceiptFacts,
} from '../worker/finance/receipts'
import type { FinanceTransaction } from '../src/shared/types/finance'
it('accepts merchant descriptions with source evidence, abstains on uncertainty and refuses personal/business claims', () => {
  expect(
    parseMerchantInsight(
      {
        certain: true,
        evidence: 'KFC',
        description: 'KFC fast-food restaurant.',
      },
      'KFC Quays Street',
    ),
  ).toBe('KFC fast-food restaurant.')
  expect(
    parseMerchantInsight(
      { certain: false, description: 'A ride', evidence: 'Bolt' },
      'Bolt.eu',
    ),
  ).toBeNull()
  expect(
    parseMerchantInsight(
      { certain: true, description: 'Business expense', evidence: 'KFC' },
      'KFC',
    ),
  ).toBeNull()
  expect(() =>
    parseMerchantInsight(
      { certain: true, description: 'Unknown', evidence: 'Invented' },
      'KFC',
    ),
  ).toThrow('verified')
})
it('asks the configured AI for merchant context without sending amounts, notes, categories or account facts', async () => {
  const run = vi
    .fn()
    .mockResolvedValue({
      response: {
        certain: true,
        evidence: 'Bolt.eu',
        description: 'Bolt transport service',
      },
    })
  const tx = {
    merchant: 'Bolt.eu',
    description: 'Bolt.eu',
    notes: 'private note',
    amount: -2000,
    accountId: 'private-account',
  } as FinanceTransaction
  const result = await merchantInsight(
    { AI: { run } as unknown as Env['AI'] },
    tx,
  )
  expect(result.description).toBe('Bolt transport service')
  expect(JSON.stringify(run.mock.calls)).not.toMatch(
    /private note|private-account|-2000/,
  )
  await expect(merchantInsight({}, tx)).rejects.toThrow('configured AI')
})
it('validates receipt facts, refuses missing currency and matches exact cents within three Auckland calendar days', () => {
  const facts = parseReceiptFacts({
    merchant: 'KFC',
    amount: '24.50',
    currency: 'NZD',
    date: '2026-10-27',
  })
  const tx = {
    id: 'right',
    amount: -2450,
    currency: 'NZD',
    date: '2026-10-26T12:00:00Z',
  } as FinanceTransaction
  expect(
    receiptCandidates(facts, [
      tx,
      { ...tx, id: 'foreign', currency: 'AUD' },
      { ...tx, id: 'credit', amount: 2450 },
      { ...tx, id: 'wrong-total', amount: -2400 },
      { ...tx, id: 'too-old', date: '2026-10-01T00:00:00Z' },
    ]).map((t) => t.id),
  ).toEqual(['right'])
  expect(() =>
    parseReceiptFacts({
      merchant: 'KFC',
      amount: '24.50',
      currency: null,
      date: '2026-10-27',
    }),
  ).toThrow('unclear')
  expect(() =>
    parseReceiptFacts({
      merchant: 'KFC',
      amount: '24.50',
      currency: 'NZD',
      date: '2026-02-30',
    }),
  ).toThrow('unclear')
})
it('validates receipt headers and keeps PDFs on the manual attachment path', async () => {
  const file = await readReceipt(
    new Request('https://local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/pdf' },
      body: '%PDF-fixture',
    }),
  )
  await expect(readReceiptFacts({}, file)).rejects.toThrow('receipt photos')
  await expect(
    readReceipt(
      new Request('https://local', {
        method: 'POST',
        headers: { 'Content-Type': 'image/png' },
        body: 'not an image',
      }),
    ),
  ).rejects.toThrow('valid PNG')
})
