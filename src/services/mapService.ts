import { searchPlaces } from '../connectors/locationConnector'
import type { MapCategory, MapPin, Place } from '../shared/types/map'
import type { SyncRecord } from '../shared/types/sync'
import { markDeleted, parseMapPin } from '../shared/utils/records'
import { createId, saveLocal } from './localDataService'

export const MAP_COLORS = ['#c9352b', '#2f8a55', '#286bc0', '#8f5f00', '#8354b5'] as const
export async function createCategory(name: string, color: string): Promise<SyncRecord[]> {
  if (!name.trim() || name.length > 60 || !MAP_COLORS.some((value) => value === color)) throw new Error('Choose a category name and colour.')
  const now = new Date().toISOString()
  return saveLocal([{ type: 'mapCategory', value: { id: createId(), name: name.trim(), color, createdAt: now, updatedAt: now, deletedAt: null } }])
}
export function savePin(place: Place, categoryId: string, note: string, existing: MapPin | null): Promise<SyncRecord[]> {
  const now = new Date().toISOString()
  const value: MapPin = { id: existing?.id ?? createId(), createdAt: existing?.createdAt ?? now, updatedAt: now, deletedAt: null, latitude: place.latitude, longitude: place.longitude, name: place.name.trim().slice(0, 200), categoryId, note }
  if (!parseMapPin(value)) return Promise.reject(new Error('Choose a valid place and category.'))
  return saveLocal([{ type: 'mapPin', value }])
}
export function deletePin(pin: MapPin): Promise<SyncRecord[]> { return saveLocal([{ type: 'mapPin', value: markDeleted(pin, new Date().toISOString()) }]) }
export function deleteCategory(category: MapCategory, pins: MapPin[]): Promise<SyncRecord[]> {
  const now = new Date().toISOString()
  return saveLocal([{ type: 'mapCategory', value: markDeleted(category, now) }, ...pins.filter((pin) => pin.categoryId === category.id).map((pin): SyncRecord => ({ type: 'mapPin', value: markDeleted(pin, now) }))])
}
export function findPlaces(query: string, signal: AbortSignal) { return searchPlaces(query, signal) }
export async function createMap(element: HTMLElement, onPick: (place: Place) => void, onTileError: () => void) {
  const renderer = await import('../connectors/mapRendererConnector')
  return renderer.mountMap(element, onPick, onTileError)
}
