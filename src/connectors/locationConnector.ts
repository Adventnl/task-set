import type { Place } from '../shared/types/map'

const GEOCODER = import.meta.env.VITE_GEOCODER_URL || 'https://photon.komoot.io'

function object(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {} }
export function currentPosition(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Location is unavailable. Choose your region manually.')); return }
    navigator.geolocation.getCurrentPosition(({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }), () => reject(new Error('Could not get your location. Allow location access or choose your region manually.')), { timeout: 15_000, maximumAge: 300_000 })
  })
}

async function features(path: string, signal: AbortSignal): Promise<unknown[]> {
  const response = await fetch(`${GEOCODER}${path}`, { signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]), credentials: 'omit' })
  if (!response.ok) throw new Error('Place search is unavailable. Try again later or pick a point on the map.')
  const body = object(await response.json() as unknown)
  if (!Array.isArray(body.features)) throw new Error('The place service returned an unreadable result.')
  return body.features
}
export async function searchPlaces(query: string, signal: AbortSignal): Promise<Place[]> {
  const rows = await features(`/api/?q=${encodeURIComponent(query)}&limit=6&lat=-36.8485&lon=174.7633&lang=en`, signal)
  return rows.flatMap((row) => {
    const feature = object(row), properties = object(feature.properties), geometry = object(feature.geometry)
    const coordinates = geometry.coordinates
    if (!Array.isArray(coordinates) || typeof coordinates[0] !== 'number' || typeof coordinates[1] !== 'number' || !Number.isFinite(coordinates[0]) || !Number.isFinite(coordinates[1]) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90) return []
    const name = [properties.name, properties.street, properties.city, properties.country].filter((value): value is string => typeof value === 'string').filter((value, index, all) => all.indexOf(value) === index).join(', ')
    return name ? [{ name: name.slice(0, 200), latitude: coordinates[1], longitude: coordinates[0] }] : []
  })
}
export async function locationRegion(latitude: number, longitude: number, signal: AbortSignal): Promise<{ state: string; district: string; country: string }> {
  const rows = await features(`/reverse?lat=${latitude}&lon=${longitude}&lang=en`, signal)
  const data = object(object(rows[0]).properties)
  return { state: String(data.state ?? ''), district: String(data.county ?? data.city ?? ''), country: String(data.countrycode ?? '') }
}
