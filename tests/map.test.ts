import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearLocalData, loadData, readOutbox } from '../src/services/localDataService'
import { createCategory, deleteCategory, savePin } from '../src/services/mapService'
import { parseSyncRecord } from '../src/shared/utils/records'
import { parentOf } from '../worker/merge'

describe('saved places', () => {
  beforeEach(() => clearLocalData())
  it('saves categories and pins, edits a pin, and deletes a category with its pins atomically', async () => {
    const [category] = await createCategory('Restaurants', '#c9352b')
    await savePin({ name: 'Cafe', latitude: -36.85, longitude: 174.76 }, category.value.id, '', null)
    const pin = (await loadData()).mapPins[0]
    expect(parentOf({ type: 'mapPin', value: pin })).toEqual({ type: 'mapCategory', id: category.value.id })
    const stale = { ...pin, updatedAt: '2000-01-01T00:00:00.000Z' }
    await savePin({ ...stale, name: 'Favourite cafe' }, pin.categoryId, 'Try dinner', stale)
    const loaded = await loadData()
    expect(loaded.mapPins).toHaveLength(1)
    expect(loaded.mapPins[0]).toMatchObject({ id: pin.id, name: 'Favourite cafe', note: 'Try dinner' })
    expect(loaded.mapPins[0].updatedAt).not.toBe(stale.updatedAt)
    await deleteCategory(loaded.mapCategories[0], loaded.mapPins)
    expect((await loadData()).mapPins).toEqual([])
    expect((await loadData()).mapCategories).toEqual([])
    expect((await readOutbox(10)).every((entry) => entry.record.value.deletedAt)).toBe(true)
  })
  it('rejects invalid coordinates and unsafe category colours at the sync boundary', async () => {
    const [category] = await createCategory('Restaurants', '#c9352b')
    expect(parseSyncRecord({ ...category, value: { ...category.value, color: 'url(https://bad)' } })).toBeNull()
    await savePin({ name: 'Cafe', latitude: -36.85, longitude: 174.76 }, category.value.id, '', null)
    const pin = (await loadData()).mapPins[0]
    expect(parseSyncRecord({ type: 'mapPin', value: { ...pin, latitude: NaN } })).toBeNull()
    expect(parseSyncRecord({ type: 'mapPin', value: { ...pin, longitude: 200 } })).toBeNull()
  })
})
