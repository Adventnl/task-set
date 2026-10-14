import { MAP_ZOOM, PLACE_ZOOM } from '../config/maps'
import type { Place } from '../types/map'

/** The standard Google Maps iframe URL; no app credentials are passed to Google. */
export function googleMapEmbedUrl(place: Place | null): string {
  const url = new URL('https://maps.google.com/maps')
  url.searchParams.set('q', place ? `${place.latitude},${place.longitude}` : 'Auckland, New Zealand')
  url.searchParams.set('z', String(place ? PLACE_ZOOM : MAP_ZOOM))
  url.searchParams.set('output', 'embed')
  return url.href
}
