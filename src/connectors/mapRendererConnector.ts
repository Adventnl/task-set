import * as L from 'leaflet'
import type { MapCategory, MapPin, Place } from '../shared/types/map'
import 'leaflet/dist/leaflet.css'

const TILES = import.meta.env.VITE_MAP_TILES_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
/** Leaflet owns the map DOM; names enter through textContent, never interpreted HTML. */
export function mountMap(element: HTMLElement, onPick: (place: Place) => void, onTileError: () => void) {
  const map = L.map(element).setView([-36.8485, 174.7633], 12)
  L.tileLayer(TILES, { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).on('tileerror', onTileError).addTo(map)
  const markers = L.layerGroup().addTo(map)
  const picked = L.layerGroup().addTo(map)
  map.on('click', (event: L.LeafletMouseEvent) => onPick({ name: 'Pinned place', latitude: event.latlng.lat, longitude: event.latlng.lng }))
  const resize = new ResizeObserver(() => map.invalidateSize())
  resize.observe(element)
  return {
    update(pins: MapPin[], categories: MapCategory[]) {
      markers.clearLayers()
      const colors = new Map(categories.map((category) => [category.id, category.color]))
      for (const pin of pins) {
        const glyph = document.createElement('span')
        glyph.className = 'map-pin-glyph'
        glyph.style.setProperty('--pin-color', colors.get(pin.categoryId) ?? '#c9352b')
        const icon = L.divIcon({ html: glyph, className: 'map-pin-marker', iconSize: [28, 36], iconAnchor: [14, 36] })
        const marker = L.marker([pin.latitude, pin.longitude], { icon, title: pin.name, alt: pin.name }).addTo(markers)
        const label = document.createElement('span')
        label.textContent = pin.name
        marker.bindTooltip(label)
        marker.on('click', () => onPick(pin))
      }
    },
    focus(place: Place | null) {
      picked.clearLayers()
      if (!place) return
      map.setView([place.latitude, place.longitude], Math.max(map.getZoom(), 15))
      L.circleMarker([place.latitude, place.longitude], { radius: 12, color: '#8f5f00', fillOpacity: 0.2 }).addTo(picked)
    },
    dispose() { resize.disconnect(); map.remove() },
  }
}
