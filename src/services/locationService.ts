import { currentPosition, locationRegion } from '../connectors/locationConnector'
import { anniversaryRegion, NZ_REGIONS, type NzRegion } from '../shared/utils/nzHolidays'

const REGION_KEY = 'task-set:nz-region'
export function readRegion(): NzRegion | null {
  try { const value = localStorage.getItem(REGION_KEY); return NZ_REGIONS.find((region) => region === value) ?? null } catch { return null }
}
export function saveRegion(region: NzRegion | null) { if (region) localStorage.setItem(REGION_KEY, region); else localStorage.removeItem(REGION_KEY) }
export async function detectRegion(signal: AbortSignal): Promise<NzRegion> {
  const point = await currentPosition()
  signal.throwIfAborted()
  const address = await locationRegion(point.latitude, point.longitude, signal)
  if (address.country.toLowerCase() !== 'nz') throw new Error('This location is outside New Zealand. Choose your anniversary region manually.')
  const region = anniversaryRegion(address.state, address.district)
  if (!region) throw new Error('Could not identify your anniversary region. Choose it manually.')
  return region
}
