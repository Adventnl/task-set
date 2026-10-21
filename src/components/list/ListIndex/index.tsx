import { ChevronRight, Plus } from 'lucide-react'
import type { checklistSummaries } from '../../../shared/utils/checklist'

export default function ListIndex({ summaries, searching, onOpen, onCreate }: {
  summaries: ReturnType<typeof checklistSummaries>
  searching: boolean
  onOpen: (id: string) => void
  onCreate: () => void
}) {
  if (!summaries.length) return (
    <div className="empty-state">
      <h2>{searching ? 'No matching lists' : 'A list for anything'}</h2>
      <p>{searching ? 'Try another name or item.' : 'Dinner guests, groceries, or whatever you want to check off. Name a list, then add your items.'}</p>
      {!searching && <button className="button button-primary empty-state-action" type="button" onClick={onCreate}><Plus size={18} aria-hidden="true" />New list</button>}
    </div>
  )
  return (
    <ul className="checklist-index" aria-label="Your lists">
      {summaries.map(({ list, total, completed }) => (
        <li key={list.id}>
          <button type="button" className="checklist-link" onClick={() => onOpen(list.id)}>
            <span className="checklist-link-copy"><span className="checklist-name">{list.name}</span><span className="checklist-count">{total ? `${completed} of ${total} checked` : 'No items yet'}</span></span>
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  )
}
