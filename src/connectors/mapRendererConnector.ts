import { importLibrary, setOptions } from '@googlemaps/js-api-loader'
import { GOOGLE_MAPS_ID, GOOGLE_MAPS_KEY, MAP_CENTER, MAP_ZOOM, PLACE_ZOOM } from '../shared/config/maps'
import type { MapRenderer, Place } from '../shared/types/map'
import { googleMapEmbedUrl } from '../shared/utils/map'

let configured = false
function configure() {
  if (!configured) {
    setOptions({ key: GOOGLE_MAPS_KEY, v: 'quarterly', region: 'NZ', language: 'en' })
    configured = true
  }
}

function mountEmbed(element: HTMLElement, onError: (message: string) => void): MapRenderer {
  const frame = document.createElement('iframe')
  frame.title = 'Google Maps'
  frame.src = googleMapEmbedUrl(null)
  frame.allowFullscreen = true
  frame.referrerPolicy = 'strict-origin-when-cross-origin'
  frame.addEventListener('error', () => onError('Google Maps could not load. Your saved places are still available below.'))
  element.replaceChildren(frame)
  return {
    mode: 'embed',
    update() {},
    focus(place) { if (place) frame.src = googleMapEmbedUrl(place) },
    dispose() { frame.remove() },
  }
}

export async function searchGooglePlaces(query: string, signal: AbortSignal): Promise<Place[]> {
  configure()
  const { Place } = await importLibrary('places')
  signal.throwIfAborted()
  const { places } = await Place.searchByText({ textQuery: query, fields: ['displayName', 'location'], locationBias: MAP_CENTER, region: 'nz', maxResultCount: 6 })
  signal.throwIfAborted()
  return places.flatMap((place) => place.location && place.displayName ? [{ name: place.displayName, latitude: place.location.lat(), longitude: place.location.lng() }] : [])
}

/** Google owns the map DOM; user text only enters typed marker titles and place models. */
export async function mountMap(element: HTMLElement, onPick: (place: Place) => void, onError: (message: string) => void): Promise<MapRenderer> {
  if (!GOOGLE_MAPS_KEY) return mountEmbed(element, onError)
  configure()
  const [{ Map }, { AdvancedMarkerElement, PinElement }] = await Promise.all([importLibrary('maps'), importLibrary('marker')])
  const map = new Map(element, { center: MAP_CENTER, zoom: MAP_ZOOM, mapId: GOOGLE_MAPS_ID, gestureHandling: 'cooperative', mapTypeControl: false, streetViewControl: false })
  let disposed = false
  let pickRevision = 0
  let markers: google.maps.marker.AdvancedMarkerElement[] = []
  let focused: google.maps.marker.AdvancedMarkerElement | null = null
  const click = map.addListener('click', (event: google.maps.MapMouseEvent | google.maps.IconMouseEvent) => {
    if (!event.latLng || disposed) return
    const point: Place = { name: 'Pinned place', latitude: event.latLng.lat(), longitude: event.latLng.lng() }
    const revision = ++pickRevision
    if (!('placeId' in event) || !event.placeId) { onPick(point); return }
    event.stop()
    const id = event.placeId
    void importLibrary('places').then(async ({ Place }) => {
      const place = new Place({ id })
      await place.fetchFields({ fields: ['displayName', 'location'] })
      if (!disposed && revision === pickRevision) onPick({ name: place.displayName || point.name, latitude: place.location?.lat() ?? point.latitude, longitude: place.location?.lng() ?? point.longitude })
    }).catch(() => {
      if (!disposed && revision === pickRevision) {
        onError('The place name could not load. You can name this pin yourself.')
        onPick(point)
      }
    })
  })
  function clearMarkers() {
    for (const marker of markers) { google.maps.event.clearInstanceListeners(marker); marker.map = null }
    markers = []
  }
  return {
    mode: 'interactive',
    update(pins, categories) {
      clearMarkers()
      const colors = new globalThis.Map(categories.map((category) => [category.id, category.color]))
      markers = pins.map((pin) => {
        const color = colors.get(pin.categoryId)
        const glyph = new PinElement({ background: color, borderColor: color, glyphColor: 'white' })
        const marker = new AdvancedMarkerElement({ map, position: { lat: pin.latitude, lng: pin.longitude }, title: pin.name, gmpClickable: true })
        marker.append(glyph)
        marker.addEventListener('gmp-click', () => { ++pickRevision; onPick(pin) })
        return marker
      })
    },
    focus(place) {
      ++pickRevision
      if (focused) focused.map = null
      focused = null
      if (!place) return
      map.panTo({ lat: place.latitude, lng: place.longitude })
      map.setZoom(Math.max(map.getZoom() ?? MAP_ZOOM, PLACE_ZOOM))
      focused = new AdvancedMarkerElement({ map, position: { lat: place.latitude, lng: place.longitude }, title: place.name })
    },
    dispose() {
      disposed = true
      ++pickRevision
      click.remove()
      clearMarkers()
      if (focused) focused.map = null
      google.maps.event.clearInstanceListeners(map)
      element.replaceChildren()
    },
  }
}
