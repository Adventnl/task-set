import type { Checklist, ChecklistItem } from '../shared/types/checklist'
import type { SyncRecord } from '../shared/types/sync'
import { checklistLines } from '../shared/utils/checklist'
import { markDeleted, MAX_TITLE_LENGTH } from '../shared/utils/records'
import { createId, saveLocal } from './localDataService'

function editTime(existing: { updatedAt: string } | null): string {
  return new Date(Math.max(Date.now(), existing ? Date.parse(existing.updatedAt) + 1 : 0)).toISOString()
}

export function saveChecklist(name: string, existing: Checklist | null): Promise<SyncRecord[]> {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > MAX_TITLE_LENGTH) return Promise.reject(new Error(`Give your list a name of up to ${MAX_TITLE_LENGTH} characters.`))
  const now = editTime(existing)
  return saveLocal([{ type: 'checklist', value: { id: existing?.id ?? createId(), name: trimmed,
    createdAt: existing?.createdAt ?? now, updatedAt: now, deletedAt: null } }])
}

/** One transaction makes a bulk import all-or-nothing, including its sync queue. */
export function addChecklistItems(listId: string, text: string, existing: ChecklistItem[]): Promise<SyncRecord[]> {
  const lines = checklistLines(text)
  if (!lines.length) return Promise.reject(new Error('Write at least one item, with one item per line.'))
  const start = existing.reduce((position, item) => item.listId === listId ? Math.max(position, item.position + 1) : position, 0)
  const now = new Date().toISOString()
  return saveLocal(lines.map((line, index): SyncRecord => ({ type: 'checklistItem', value: {
    id: createId(), listId, text: line, position: start + index, completedAt: null,
    createdAt: now, updatedAt: now, deletedAt: null,
  } })))
}

export function setChecklistItemCompleted(item: ChecklistItem, completed: boolean): Promise<SyncRecord[]> {
  const now = editTime(item)
  return saveLocal([{ type: 'checklistItem', value: { ...item, completedAt: completed ? now : null, updatedAt: now } }])
}

export function deleteChecklistItem(item: ChecklistItem): Promise<SyncRecord[]> {
  return saveLocal([{ type: 'checklistItem', value: markDeleted(item, editTime(item)) }])
}

export function deleteChecklist(list: Checklist, items: ChecklistItem[]): Promise<SyncRecord[]> {
  const now = editTime(list)
  return saveLocal([{ type: 'checklist', value: markDeleted(list, now) },
    ...items.filter((item) => item.listId === list.id).map((item): SyncRecord => ({ type: 'checklistItem', value: markDeleted(item, now > item.updatedAt ? now : editTime(item)) }))])
}
