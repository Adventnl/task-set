import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { addChecklistItems, deleteChecklist, deleteChecklistItem, saveChecklist, setChecklistItemCompleted } from '../src/services/checklistService'
import { applyRemote, clearLocalData, loadData, readOutbox } from '../src/services/localDataService'
import { PRIMARY_SECTIONS, SIDEBAR_SECTIONS, sectionOf } from '../src/shared/config/views'
import { checklistLines, checklistSummaries, orderedChecklistItems } from '../src/shared/utils/checklist'
import { EMPTY_WORKSPACE, MAX_RECORD_BYTES, mergeRecords, parseSyncRecord } from '../src/shared/utils/records'
import { CHILD_TYPE, deletedRecord, mergeRecord, parentOf } from '../worker/merge'

describe('Lists', () => {
  beforeEach(() => clearLocalData())

  async function createList(name = 'Dinner guests') {
    await saveChecklist(name, null)
    return (await loadData()).checklists[0]
  }

  it('splits every kind of newline, skips blank lines, and preserves duplicates and punctuation', () => {
    expect(checklistLines('  Alex  \r\n\r\nSam\n Alex\rJordan & Jo ')).toEqual(['Alex', 'Sam', 'Alex', 'Jordan & Jo'])
    expect(checklistLines(' \n\r\n\t')).toEqual([])
  })

  it('creates a named list before adding single or bulk items, preserving import order after reloading', async () => {
    const list = await createList('  Dinner guests  ')
    expect(list.name).toBe('Dinner guests')
    expect((await loadData()).checklistItems).toEqual([])
    await addChecklistItems(list.id, 'Zoe\r\nAlex\n\nSam\nAlex', [])
    await addChecklistItems(list.id, 'Jordan', (await loadData()).checklistItems)
    const data = await loadData()
    expect(orderedChecklistItems(data.checklistItems, list.id).map((item) => item.text)).toEqual(['Zoe', 'Alex', 'Sam', 'Alex', 'Jordan'])
    expect(new Set(data.checklistItems.map((item) => item.id)).size).toBe(5)
    expect(data.captures).toEqual([])
    expect(data.tasks).toEqual([])
    expect(await readOutbox(20)).toHaveLength(6)
  })

  it('keeps checked items in the same place and lets them be unchecked, renamed, and removed', async () => {
    const list = await createList()
    await addChecklistItems(list.id, 'Zoe\nAlex', [])
    const item = orderedChecklistItems((await loadData()).checklistItems, list.id)[0]
    await setChecklistItemCompleted(item, true)
    let data = await loadData()
    const checked = data.checklistItems.find((entry) => entry.id === item.id)!
    expect(checked.completedAt).toBeTruthy()
    expect(checked.updatedAt > item.updatedAt).toBe(true)
    expect(orderedChecklistItems(data.checklistItems, list.id)[0].text).toBe('Zoe')
    expect(checklistSummaries(data.checklists, data.checklistItems, '')[0]).toMatchObject({ total: 2, completed: 1 })
    await setChecklistItemCompleted(checked, false)
    await saveChecklist('Guest arrivals', list)
    data = await loadData()
    expect(data.checklists[0]).toMatchObject({ id: list.id, name: 'Guest arrivals', createdAt: list.createdAt })
    expect(data.checklistItems.every((entry) => !entry.completedAt)).toBe(true)
    await deleteChecklistItem(item)
    expect((await loadData()).checklistItems.map((entry) => entry.text)).toEqual(['Alex'])
  })

  it('rejects invalid names, empty imports, and oversized imports without saving a partial batch', async () => {
    await expect(saveChecklist(' ', null)).rejects.toThrow('name')
    await expect(saveChecklist('a'.repeat(201), null)).rejects.toThrow('200')
    const list = await createList()
    await expect(addChecklistItems(list.id, '\n ', [])).rejects.toThrow('at least one')
    await expect(addChecklistItems(list.id, `Alex\n${'x'.repeat(MAX_RECORD_BYTES)}`, [])).rejects.toThrow('too large')
    expect((await loadData()).checklistItems).toEqual([])
    expect(await readOutbox(10)).toHaveLength(1)
  })

  it('deletes a list and its items atomically while preserving other lists and items', async () => {
    const list = await createList()
    await addChecklistItems(list.id, 'Alex\nSam', [])
    await saveChecklist('Groceries', null)
    const other = (await loadData()).checklists.find((entry) => entry.id !== list.id)!
    await addChecklistItems(other.id, 'Milk', [])
    await deleteChecklist(list, (await loadData()).checklistItems)
    const data = await loadData()
    expect(data.checklists.map((entry) => entry.id)).toEqual([other.id])
    expect(data.checklistItems.map((entry) => entry.text)).toEqual(['Milk'])
    expect((await readOutbox(10)).filter((entry) => entry.record.value.deletedAt)).toHaveLength(3)
  })

  it('finds lists by name or item text, excluding deleted items', async () => {
    const list = await createList()
    await addChecklistItems(list.id, 'Zoe\nAlex', [])
    const data = await loadData()
    expect(checklistSummaries(data.checklists, data.checklistItems, 'DINNER')).toHaveLength(1)
    expect(checklistSummaries(data.checklists, data.checklistItems, 'zoe')).toHaveLength(1)
    expect(checklistSummaries(data.checklists, data.checklistItems, 'missing')).toEqual([])
    expect(checklistSummaries(data.checklists, data.checklistItems.map((item) => ({ ...item, deletedAt: item.createdAt })), 'Zoe')).toEqual([])
  })

  it('validates new sync records and enforces immutable item ownership and parent deletion', async () => {
    const list = await createList()
    await addChecklistItems(list.id, 'Alex', [])
    const item = (await loadData()).checklistItems[0]
    const record = { type: 'checklistItem' as const, value: item }
    expect(parseSyncRecord({ type: 'checklist', value: list })).toEqual({ type: 'checklist', value: list })
    expect(parseSyncRecord(record)).toEqual(record)
    for (const fields of [{ listId: '../bad' }, { text: ' ' }, { position: -1 }, { position: 0.5 }, { position: Infinity }, { completedAt: 'bad' }]) {
      expect(parseSyncRecord({ ...record, value: { ...item, ...fields } })).toBeNull()
    }
    const later = new Date(Date.parse(item.updatedAt) + 1000).toISOString()
    expect(mergeRecord(record, { ...record, value: { ...item, listId: 'other', completedAt: later, updatedAt: later } })?.value).toMatchObject({ listId: list.id, completedAt: later })
    expect(mergeRecord(record, record)).toBeNull()
    expect(CHILD_TYPE.checklist).toBe('checklistItem')
    expect(parentOf(record)).toEqual({ type: 'checklist', id: list.id })
    const deleted = deletedRecord(record, later)
    expect(mergeRecord(deleted, { ...record, value: { ...item, updatedAt: new Date(Date.parse(later) + 1000).toISOString() } })).toBeNull()
    const merged = mergeRecords(EMPTY_WORKSPACE, [{ type: 'checklist', value: list }, record])
    expect(mergeRecords(merged, [deleted]).checklistItems).toEqual([])
  })

  it('applies remote lists and items and preserves an unsent local check during a pull', async () => {
    const list = await createList()
    await addChecklistItems(list.id, 'Alex', [])
    const data = await loadData()
    const records = [{ type: 'checklist' as const, value: list }, { type: 'checklistItem' as const, value: data.checklistItems[0] }]
    await clearLocalData()
    expect(await applyRemote(records, 2)).toEqual(records)
    await setChecklistItemCompleted(data.checklistItems[0], true)
    expect(await applyRemote([records[1]], 3)).toEqual([])
    expect((await loadData()).checklistItems[0].completedAt).toBeTruthy()
    await clearLocalData()
    await applyRemote(records, 2)
    await applyRemote(records.map((record) => deletedRecord(record, '2026-10-21T12:00:00.000Z')), 4)
    expect((await loadData()).checklists).toEqual([])
    expect((await loadData()).checklistItems).toEqual([])
  })

  it('shows all sections in sidebar order and keeps the phone bar compact', () => {
    expect(SIDEBAR_SECTIONS).toEqual(['feed', 'calendar', 'github', 'lists', 'tasks', 'map', 'meetings', 'finances'])
    expect(PRIMARY_SECTIONS).toEqual(['feed', 'calendar', 'github', 'lists', 'meetings'])
    expect(sectionOf('lists')).toBe('lists')
    expect(sectionOf('archive')).toBe('tasks')
  })
})
