import { Download, Pencil, Plus, Trash2 } from 'lucide-react'
import type { useListsView } from '../../../shared/hooks/useListsView'

export default function ListDetail({ lists, onDelete }: { lists: ReturnType<typeof useListsView>; onDelete: () => void }) {
  const adding = !!lists.selected && lists.busy.has(`add:${lists.selected.id}`)
  return (
    <section aria-label="Checklist items">
      <div className="checklist-tools">
        <button className="button button-secondary" type="button" onClick={lists.startImport}><Download size={16} aria-hidden="true" />Import items</button>
        <div className="checklist-actions">
          <button className="icon-button" type="button" onClick={lists.rename} aria-label="Rename list" title="Rename list"><Pencil size={18} aria-hidden="true" /></button>
          <button className="icon-button button-danger-text" type="button" onClick={onDelete} disabled={lists.busy.size > 0} aria-label="Delete list" title="Delete list"><Trash2 size={18} aria-hidden="true" /></button>
        </div>
      </div>
      <form className="checklist-add" onSubmit={(event) => { event.preventDefault(); void lists.addOne() }}>
        <label htmlFor="checklist-item" className="sr-only">New item</label>
        <input className="text-field" id="checklist-item" placeholder="Add an item…" value={lists.draft} onChange={(event) => lists.setDraft(event.target.value)} autoComplete="off" />
        <button className="button button-primary" type="submit" disabled={adding || !lists.draft.trim()} aria-label="Add item"><Plus size={18} aria-hidden="true" /><span>{adding ? 'Adding…' : 'Add'}</span></button>
      </form>
      {lists.error && !lists.editor && !lists.importing && <p className="form-error" role="alert">{lists.error}</p>}
      {!lists.items.length ? (
        <div className="empty-state">
          <h2>{lists.searching ? 'No matching items' : 'Ready for your first item'}</h2>
          <p>{lists.searching ? 'Try another search.' : 'Add one above, or import a whole list. Each new line becomes an item.'}</p>
        </div>
      ) : (
        <ul className="checklist-items">
          {lists.items.map((item) => (
            <li key={item.id} className={`checklist-item${item.completedAt ? ' is-complete' : ''}`}>
              <label className="checklist-check">
                <input type="checkbox" checked={!!item.completedAt} disabled={lists.busy.has(item.id)} onChange={() => void lists.toggle(item)} />
                <span>{item.text}</span>
              </label>
              <button className="icon-button checklist-remove" type="button" disabled={lists.busy.has(item.id)} onClick={() => void lists.deleteItem(item)} aria-label={`Remove ${item.text}`} title="Remove item"><Trash2 size={16} aria-hidden="true" /></button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
