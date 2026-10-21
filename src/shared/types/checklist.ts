export interface Checklist {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}

/** Each item syncs independently, so checking one item never overwrites another. */
export interface ChecklistItem {
  id: string
  listId: string
  text: string
  position: number
  completedAt: string | null
  createdAt: string
  updatedAt: string
  deletedAt: string | null
}
