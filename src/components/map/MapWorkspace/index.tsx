import { useState } from 'react'
import { MapPin, Trash2 } from 'lucide-react'
import type { useMapView } from '../../../shared/hooks/useMapView'

export default function MapWorkspace({ map, onDeleteCategory }: { map: ReturnType<typeof useMapView>; onDeleteCategory: (id: string) => void }) {
  const [query, setQuery] = useState('')
  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(map.colors[0])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  return <section className="map-workspace" aria-label="Saved places">
    <form className="map-search" onSubmit={(event) => { event.preventDefault(); void map.search(query) }}><label className="sr-only" htmlFor="place-search">Search for a place</label><input id="place-search" className="text-field" value={query} onChange={(event) => { setQuery(event.target.value); if (!event.target.value.trim()) void map.search('') }} placeholder="Search a restaurant or place in Auckland…" maxLength={200} /><button className="button button-secondary" disabled={map.searching || !query.trim()}>{map.searching ? 'Searching…' : 'Search'}</button></form>
    {map.error && <p className="form-error" role="alert">{map.error}</p>}
    <ul className="row-list">{map.results.map((place, index) => <li key={index}><button className="list-row" type="button" onClick={() => map.pick(place)}>{place.name}<MapPin size={16} aria-hidden="true" /></button></li>)}</ul>
    <div className="map-categories"><button className="button button-small" type="button" aria-pressed={!map.filter} onClick={() => map.setFilter('')}>All places</button>{map.categories.map((category) => <button key={category.id} className="button button-small" type="button" aria-pressed={map.filter === category.id} onClick={() => map.setFilter(category.id)}><span className="category-dot" style={{ background: category.color }} />{category.name}</button>)}</div>
    {map.mapLoading && <p className="modal-note" role="status">Loading Google Maps…</p>}
    {map.mapError && <div role="alert"><p className="form-error">{map.mapError}</p><button className="button button-secondary" type="button" onClick={map.retryMap}>Retry map</button></div>}
    <div className="map-canvas" ref={map.mapRef} aria-busy={map.mapLoading} aria-label={map.mode === 'interactive' ? 'Google Maps. Click a place to save a pin.' : 'Google Maps'} />
    <p className="modal-note">{map.mode === 'interactive' ? 'Search or click a place on Google Maps to save it. Choose a category above to see its coloured pins.' : 'Explore Google Maps here. Use the search above to save a place to a category, or choose a saved place below to show it on the map. This view shows one saved place at a time.'}</p>
    <form className="category-form" onSubmit={(event) => {
      event.preventDefault(); if (busy) return; setBusy(true); setError('')
      void map.createCategory(name, color).then(() => setName('')).catch(() => setError('Could not create that category. Try again.')).finally(() => setBusy(false))
    }}><label className="sr-only" htmlFor="category-name">New category name</label><input id="category-name" className="text-field" value={name} onChange={(event) => setName(event.target.value)} placeholder="New category, e.g. Restaurants" maxLength={60} required /><label className="sr-only" htmlFor="category-color">Pin colour</label><select id="category-color" className="text-field" value={color} onChange={(event) => setColor(event.target.value)}>{map.colors.map((value, index) => <option key={value} value={value}>{['Red', 'Green', 'Blue', 'Amber', 'Purple'][index]}</option>)}</select><button className="button button-secondary" disabled={busy || !name.trim()}>Add category</button></form>
    {error && <p className="form-error" role="alert">{error}</p>}
    {map.filter && <button className="button button-danger-text" type="button" onClick={() => onDeleteCategory(map.filter)}><Trash2 size={16} />Delete this category</button>}
    <ul className="row-list">{map.pins.map((pin) => <li key={pin.id}><button className="list-row" type="button" onClick={() => map.pick(pin)}><span className="list-row-body"><span className="list-row-title">{pin.name}</span><span className="list-row-meta">{map.categories.find((category) => category.id === pin.categoryId)?.name}{pin.note && ` · ${pin.note}`}</span></span><MapPin size={16} style={{ color: map.categories.find((category) => category.id === pin.categoryId)?.color }} /></button></li>)}</ul>
  </section>
}
