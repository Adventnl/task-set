import { useLayoutEffect, useRef, useState, type RefObject } from 'react'
import * as lists from '../../services/checklistService'
import type { Checklist, ChecklistItem } from '../types/checklist'
import type { SyncRecord } from '../types/sync'
import { checklistLines, checklistSummaries, orderedChecklistItems } from '../utils/checklist'
import type { useTaskSet } from './useTaskSet'

export function useListsView(data: ReturnType<typeof useTaskSet>, search: string, clearSearch: () => void, scrollRef: RefObject<HTMLDivElement | null>) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [editor, setEditor] = useState<Checklist | 'new' | null>(null)
  const [importing, setImporting] = useState(false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [imports, setImports] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set())
  const pending = useRef(new Set<string>())
  const { checklists, checklistItems } = data.workspace
  const selected = checklists.find((list) => list.id === selectedId) ?? null
  const items = selected ? orderedChecklistItems(checklistItems, selected.id) : []
  const term = search.trim().toLocaleLowerCase()
  const visibleItems = items.filter((item) => !term || item.text.toLocaleLowerCase().includes(term))
  const draft = selected ? drafts[selected.id] ?? '' : ''
  const importText = selected ? imports[selected.id] ?? '' : ''

  useLayoutEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [selected?.id, scrollRef])

  async function run(key: string, operation: () => Promise<SyncRecord[]>, message: string, errorSurface: 'inline' | 'notice' = 'inline') {
    if (pending.current.has(key)) return null
    pending.current.add(key)
    setBusy(new Set(pending.current))
    setError('')
    try { return await data.persist(operation, message) }
    catch (cause) {
      const explanation = cause instanceof Error ? cause.message : 'Could not save on this device. Try again.'
      if (errorSurface === 'notice') data.setNotice(explanation)
      else setError(explanation)
      return null
    }
    finally { pending.current.delete(key); setBusy(new Set(pending.current)) }
  }

  function open(id: string | null) {
    clearSearch()
    setSelectedId(id)
    setImporting(false)
    setError('')
  }

  async function addItems(bulk: boolean) {
    if (!selected) return
    const text = bulk ? importText : draft
    const saved = await run(`add:${selected.id}`, () => lists.addChecklistItems(selected.id, text, checklistItems), 'Items added')
    if (!saved) return
    const setter = bulk ? setImports : setDrafts
    setter((current) => current[selected.id] === text ? { ...current, [selected.id]: '' } : current)
    if (bulk) setImporting(false)
  }

  return {
    selected, items: visibleItems, total: items.length, completed: items.filter((item) => item.completedAt).length,
    summaries: checklistSummaries(checklists, checklistItems, search), searching: !!term,
    open, close: () => open(null), busy, error,
    editor, startNew: () => { setError(''); setEditor('new') },
    rename: () => { if (selected) { setError(''); setEditor(selected) } },
    closeEditor: () => { if (!pending.current.has('name')) { setEditor(null); setError('') } },
    saveName: async (name: string) => {
      if (!editor) return
      const saved = await run('name', () => lists.saveChecklist(name, editor === 'new' ? null : editor), editor === 'new' ? 'List created' : 'List renamed')
      if (saved?.[0]?.type === 'checklist') { open(saved[0].value.id); setEditor(null) }
    },
    draft, setDraft: (text: string) => { if (selected) setDrafts((current) => ({ ...current, [selected.id]: text })) },
    addOne: () => addItems(false), importText, importCount: checklistLines(importText).length,
    setImportText: (text: string) => { if (selected) setImports((current) => ({ ...current, [selected.id]: text })) },
    importing: importing && !!selected, startImport: () => { setError(''); setImporting(true) },
    closeImport: () => { if (!selected || !pending.current.has(`add:${selected.id}`)) { setImporting(false); setError('') } },
    importItems: () => addItems(true),
    toggle: (item: ChecklistItem) => run(item.id, () => lists.setChecklistItemCompleted(item, !item.completedAt), item.completedAt ? 'Item unchecked' : 'Item checked', 'notice'),
    deleteItem: (item: ChecklistItem) => run(item.id, () => lists.deleteChecklistItem(item), 'Item removed', 'notice'),
    deleteList: async () => {
      if (!selected) return false
      const saved = await run(selected.id, () => lists.deleteChecklist(selected, checklistItems), 'List deleted', 'notice')
      if (saved) open(null)
      return !!saved
    },
  }
}
