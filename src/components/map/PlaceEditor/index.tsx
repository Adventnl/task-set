import { useState, type FormEvent } from 'react'
import type { MapCategory, MapPin, Place } from '../../../shared/types/map'
import Modal from '../../app/Modal'

export default function PlaceEditor({ place, pin, categories, onClose, onSave, onDelete }: { place: Place; pin: MapPin | null; categories: MapCategory[]; onClose: () => void; onSave: (place: Place, categoryId: string, note: string) => Promise<unknown>; onDelete: () => void }) {
  const [name, setName] = useState(place.name)
  const [categoryId, setCategoryId] = useState(pin?.categoryId ?? categories[0]?.id ?? '')
  const [note, setNote] = useState(pin?.note ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault(); if (busy) return
    setBusy(true)
    try { await onSave({ ...place, name: name.trim() }, categoryId, note); onClose() }
    catch { setError('Could not save this place. Try again.'); setBusy(false) }
  }
  return <Modal labelledBy="place-title" onClose={onClose}><form onSubmit={submit}>
    <h2 id="place-title" className="modal-title">{pin ? 'Edit place' : 'Save a place'}</h2>
    <label className="field-label field-label-spaced" htmlFor="place-name">Place name</label><input id="place-name" className="text-field" value={name} maxLength={200} required autoFocus onChange={(event) => setName(event.target.value)} />
    <label className="field-label field-label-spaced" htmlFor="place-category">Category</label><select id="place-category" className="text-field" value={categoryId} required onChange={(event) => setCategoryId(event.target.value)}>{categories.map((category) => <option value={category.id} key={category.id}>{category.name}</option>)}</select>
    {!categories.length && <p className="modal-note">Create a category first, then choose your place.</p>}
    <label className="field-label field-label-spaced" htmlFor="place-note">Notes (optional)</label><textarea id="place-note" className="text-field text-area" rows={2} value={note} maxLength={4000} onChange={(event) => setNote(event.target.value)} />
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-actions">{pin && <button className="button button-danger-text" type="button" disabled={busy} onClick={onDelete}>Delete pin</button>}<button className="button button-secondary" type="button" onClick={onClose}>Cancel</button><button className="button button-primary" disabled={busy || !name.trim() || !categories.some((category) => category.id === categoryId)}>{busy ? 'Saving…' : 'Save pin'}</button></div>
  </form></Modal>
}
