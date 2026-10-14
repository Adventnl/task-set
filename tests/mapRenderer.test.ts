import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MapCategory, MapPin } from '../src/shared/types/map'
import { googleMapEmbedUrl } from '../src/shared/utils/map'

const api = vi.hoisted(() => ({ load: vi.fn(), options: vi.fn(), details: vi.fn(), search: vi.fn(), listeners: new Map<string, (event: unknown) => void>(), markers: [] as { map: unknown; options: Record<string, unknown>; glyph?: unknown; activate?: () => void }[] }))
vi.mock('@googlemaps/js-api-loader', () => ({ importLibrary: api.load, setOptions: api.options }))

const category: MapCategory = { id: 'restaurants', name: 'Restaurants', color: '#c9352b', createdAt: '', updatedAt: '', deletedAt: null }
const pin: MapPin = { id: 'cafe', name: '<Cafe>', latitude: -36.85, longitude: 174.76, categoryId: category.id, note: '', createdAt: '', updatedAt: '', deletedAt: null }
const point = { lat: () => -36.85, lng: () => 174.76 }

beforeEach(() => {
  vi.resetModules()
  vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'test-restricted-key')
  api.listeners.clear(); api.markers.length = 0
  api.details.mockReset(); api.search.mockReset()
  vi.stubGlobal('google', { maps: { event: { clearInstanceListeners: vi.fn() } } })
  api.load.mockImplementation(async (library: string) => {
    if (library === 'maps') return { Map: class {
      addListener(name: string, callback: (event: unknown) => void) { api.listeners.set(name, callback); return { remove: () => api.listeners.delete(name) } }
      panTo() {} getZoom() { return 12 } setZoom() {}
    } }
    if (library === 'marker') return { AdvancedMarkerElement: class {
      map: unknown
      glyph?: unknown
      activate?: () => void
      constructor(public options: Record<string, unknown>) { this.map = options.map; api.markers.push(this) }
      append(glyph: unknown) { this.glyph = glyph }
      addEventListener(_name: string, callback: () => void) { this.activate = callback }
    }, PinElement: class { constructor(public options: unknown) {} } }
    return { Place: class {
      displayName = 'Google cafe'
      location = point
      fetchFields = api.details
      static searchByText = api.search
    } }
  })
})
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.clearAllMocks() })

describe('Google Maps integration', () => {
  it('embeds real Google Maps without loading the paid JavaScript API when there is no key', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', '')
    const frame = { src: '', title: '', addEventListener: vi.fn(), remove: vi.fn() }
    vi.stubGlobal('document', { createElement: () => frame })
    const element = { replaceChildren: vi.fn() }
    const { mountMap } = await import('../src/connectors/mapRendererConnector')
    const map = await mountMap(element as unknown as HTMLElement, vi.fn(), vi.fn())
    expect(map.mode).toBe('embed')
    expect(frame.src).toBe(googleMapEmbedUrl(null))
    map.focus(pin)
    expect(new URL(frame.src).searchParams.get('q')).toBe('-36.85,174.76')
    map.focus(null)
    expect(frame.src).toBe(googleMapEmbedUrl(pin))
    expect(api.load).not.toHaveBeenCalled()
    map.dispose()
    expect(frame.remove).toHaveBeenCalledOnce()
  })

  it('renders category colours, returns the original saved pin, and removes replaced markers', async () => {
    const { mountMap } = await import('../src/connectors/mapRendererConnector')
    const pick = vi.fn()
    const map = await mountMap({ replaceChildren() {} } as unknown as HTMLElement, pick, vi.fn())
    map.update([pin], [category])
    const marker = api.markers[0]
    expect(marker.options).toMatchObject({ title: '<Cafe>', gmpClickable: true })
    expect(marker.glyph).toMatchObject({ options: { background: category.color } })
    marker.activate?.()
    expect(pick).toHaveBeenCalledWith(pin)
    map.update([], [category])
    expect(marker.map).toBeNull()
    map.dispose()
    expect(api.listeners.has('click')).toBe(false)
  })

  it('resolves Google places but discards details superseded by another pick or disposal', async () => {
    let complete!: () => void
    api.details.mockImplementation(() => new Promise<void>((resolve) => { complete = resolve }))
    const { mountMap } = await import('../src/connectors/mapRendererConnector')
    const pick = vi.fn()
    const map = await mountMap({ replaceChildren() {} } as unknown as HTMLElement, pick, vi.fn())
    api.listeners.get('click')?.({ latLng: point, placeId: 'cafe', stop: vi.fn() })
    await vi.waitFor(() => expect(api.details).toHaveBeenCalledOnce())
    api.listeners.get('click')?.({ latLng: point })
    complete()
    await Promise.resolve(); await Promise.resolve()
    expect(pick).toHaveBeenCalledOnce()
    expect(pick).toHaveBeenCalledWith({ name: 'Pinned place', latitude: -36.85, longitude: 174.76 })
    api.listeners.get('click')?.({ latLng: point, placeId: 'cafe', stop: vi.fn() })
    await vi.waitFor(() => expect(api.details).toHaveBeenCalledTimes(2))
    map.dispose(); complete()
    await Promise.resolve(); await Promise.resolve()
    expect(pick).toHaveBeenCalledOnce()
  })

  it('uses the Google place name and coordinates when a place is picked', async () => {
    api.details.mockResolvedValue({})
    const { mountMap } = await import('../src/connectors/mapRendererConnector')
    const pick = vi.fn(), stop = vi.fn()
    const map = await mountMap({ replaceChildren() {} } as unknown as HTMLElement, pick, vi.fn())
    api.listeners.get('click')?.({ latLng: point, placeId: 'cafe', stop })
    await vi.waitFor(() => expect(pick).toHaveBeenCalledWith({ name: 'Google cafe', latitude: -36.85, longitude: 174.76 }))
    expect(stop).toHaveBeenCalledOnce()
    map.dispose()
  })

  it('propagates JavaScript API loading failures for the retry UI', async () => {
    api.load.mockRejectedValueOnce(new Error('Network unavailable'))
    const { mountMap } = await import('../src/connectors/mapRendererConnector')
    await expect(mountMap({} as HTMLElement, vi.fn(), vi.fn())).rejects.toThrow('Network unavailable')
  })

  it('allows naming a map point when Google place details fail', async () => {
    api.details.mockRejectedValue(new Error('Unavailable'))
    const { mountMap } = await import('../src/connectors/mapRendererConnector')
    const pick = vi.fn(), error = vi.fn()
    const map = await mountMap({ replaceChildren() {} } as unknown as HTMLElement, pick, error)
    api.listeners.get('click')?.({ latLng: point, placeId: 'cafe', stop: vi.fn() })
    await vi.waitFor(() => expect(pick).toHaveBeenCalledOnce())
    expect(error).toHaveBeenCalledOnce()
    expect(pick.mock.calls[0][0].name).toBe('Pinned place')
    map.dispose()
  })

  it('maps Google search results and rejects an aborted search response', async () => {
    api.search.mockResolvedValue({ places: [{ displayName: 'Cafe', location: point }, { displayName: 'No location' }] })
    const { searchGooglePlaces } = await import('../src/connectors/mapRendererConnector')
    expect(await searchGooglePlaces('Cafe', new AbortController().signal)).toEqual([{ name: 'Cafe', latitude: -36.85, longitude: 174.76 }])
    const controller = new AbortController()
    api.search.mockImplementation(async () => { controller.abort(); return { places: [] } })
    await expect(searchGooglePlaces('Cafe', controller.signal)).rejects.toMatchObject({ name: 'AbortError' })
  })
})
