import type { Checklist, ChecklistItem } from '../types/checklist'
import { byCreatedAt } from './records'

/** Preserve words, duplicates, and order; whitespace-only lines are not items. */
export function checklistLines(text: string): string[] {
  return text.split(/\r\n|[\n\r]/).map((line) => line.trim()).filter(Boolean)
}

export function orderedChecklistItems(items: ChecklistItem[], listId: string): ChecklistItem[] {
  return items.filter((item) => item.listId === listId && !item.deletedAt)
    .sort((a, b) => a.position - b.position || byCreatedAt(a, b))
}

export function checklistSummaries(lists: Checklist[], items: ChecklistItem[], search: string) {
  const grouped = new Map<string, ChecklistItem[]>()
  for (const item of items) {
    if (item.deletedAt) continue
    const group = grouped.get(item.listId) ?? []
    group.push(item)
    grouped.set(item.listId, group)
  }
  const term = search.trim().toLocaleLowerCase()
  return lists.filter((list) => !list.deletedAt).map((list) => {
    const entries = grouped.get(list.id) ?? []
    return { list, total: entries.length, completed: entries.filter((item) => item.completedAt).length,
      matches: !term || list.name.toLocaleLowerCase().includes(term) || entries.some((item) => item.text.toLocaleLowerCase().includes(term)) }
  }).filter((summary) => summary.matches)
}
