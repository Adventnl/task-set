import { useEffect, useRef, useState } from 'react'
import * as maps from '../../services/mapService'
import type { MapPin, MapRenderer, Place } from '../types/map'
import { GOOGLE_MAPS_KEY } from '../config/maps'
import type { useTaskSet } from './useTaskSet'

export function useMapView(data: ReturnType<typeof useTaskSet>, active: boolean) {
  const [filter, setFilter] = useState('')
  const [place, setPlace] = useState<Place | null>(null)
  const [editing, setEditing] = useState<MapPin | null>(null)
  const [results, setResults] = useState<Place[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState('')
  const [mapError, setMapError] = useState('')
  const [mapLoading, setMapLoading] = useState(true)
  const [mapRevision, setMapRevision] = useState(0)
  const mode: MapRenderer['mode'] = GOOGLE_MAPS_KEY ? 'interactive' : 'embed'
  const mapRef = useRef<HTMLDivElement>(null)
  const session = useRef<Awaited<ReturnType<typeof maps.createMap>> | null>(null)
  const request = useRef<AbortController | null>(null)
  const { mapCategories: categories, mapPins: pins } = data.workspace
  const visible = filter ? pins.filter((pin) => pin.categoryId === filter) : pins
  const visibleRef = useRef(visible)
  visibleRef.current = visible
  const categoriesRef = useRef(categories)
  categoriesRef.current = categories
  const placeRef = useRef(place)
  placeRef.current = place

  function pick(value: Place) { setPlace(value); setEditing('id' in value ? value as MapPin : null) }
  useEffect(() => {
    if (!active || !mapRef.current) return
    let alive = true
    let mounted: Awaited<ReturnType<typeof maps.createMap>> | null = null
    setMapLoading(true)
    setMapError('')
    void maps.createMap(mapRef.current, pick, (message) => { if (alive) setMapError(message) }).then((renderer) => {
      mounted = renderer
      if (!alive) { renderer.dispose(); return }
      session.current = renderer
      renderer.update(visibleRef.current, categoriesRef.current)
      renderer.focus(placeRef.current)
      setMapLoading(false)
    }).catch(() => { if (alive) { setMapLoading(false); setMapError('Google Maps could not load. Your saved places are still available below.') } })
    return () => { alive = false; mounted?.dispose(); session.current = null; request.current?.abort(); setSearching(false) }
  }, [active, mapRevision])
  useEffect(() => { session.current?.update(visible, categories) }, [pins, categories, filter, active])
  useEffect(() => { session.current?.focus(place) }, [place])
  useEffect(() => {
    if (filter && !categories.some((category) => category.id === filter)) setFilter('')
    if (editing && !pins.some((pin) => pin.id === editing.id)) { setPlace(null); setEditing(null) }
  }, [categories, pins, editing, filter])
  async function search(query: string) {
    request.current?.abort()
    if (!query.trim()) { setResults([]); setSearching(false); setError(''); return }
    const controller = new AbortController()
    request.current = controller
    setSearching(true); setError('')
    try { const found = await maps.findPlaces(query.trim(), controller.signal); if (!controller.signal.aborted) setResults(found) }
    catch (cause) { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Search failed.') }
    finally { if (!controller.signal.aborted) setSearching(false) }
  }
  return {
    categories, pins: visible, filter, setFilter, mapRef, place, editing, pick, results, searching, error, search,
    mode, mapLoading, mapError, retryMap: () => setMapRevision((value) => value + 1),
    colors: maps.MAP_COLORS,
    closePlace: () => { setPlace(null); setEditing(null) },
    createCategory: (name: string, color: string) => data.persist(() => maps.createCategory(name, color), 'Category added'),
    savePlace: (value: Place, categoryId: string, note: string) => data.persist(() => maps.savePin(value, categoryId, note, editing), 'Place saved'),
    deletePin: (pin: MapPin) => data.commit(pin.id, () => maps.deletePin(pin), 'Place removed', 'Could not remove that place.'),
    deleteCategory: (id: string) => { const category = categories.find((item) => item.id === id); return category ? data.commit(id, () => maps.deleteCategory(category, pins), 'Category and pins removed', 'Could not delete the category.') : Promise.resolve(false) },
  }
}
