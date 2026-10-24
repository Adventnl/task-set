import { minorUnits } from '../../src/shared/utils/finance'
import type { FinanceFilter } from '../../src/shared/types/finance'
export function financeFilter(url: URL): FinanceFilter {
  const p = url.searchParams,
    get = (k: string) => (p.get(k) ?? '').slice(0, 200)
  const page = Number(get('page') || 0)
  if (!Number.isSafeInteger(page) || page < 0) throw new Error('Invalid page')
  for (const key of ['start', 'end'])
    if (get(key) && !/^\d{4}-\d{2}-\d{2}$/.test(get(key)))
      throw new Error('Invalid date filter')
  for (const key of ['min', 'max'])
    if (get(key) && minorUnits(get(key)) < 0)
      throw new Error('Invalid amount filter')
  return {
    search: get('search'),
    account: get('account'),
    category: get('category'),
    review: get('review'),
    direction: get('direction'),
    start: get('start'),
    end: get('end'),
    min: get('min'),
    max: get('max'),
    tag: get('tag'),
    page,
    oldest: get('oldest') === 'true',
  }
}
