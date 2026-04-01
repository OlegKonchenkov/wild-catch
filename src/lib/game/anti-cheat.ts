const MAX_SPEED_KMH = 60
const EARTH_RADIUS_M = 6371000

interface LatLng { lat: number; lng: number }

/**
 * Parse a value returned by PostgREST for a PostgreSQL POINT column.
 * PostgREST serialises POINT as the string "(x,y)" where x=lng, y=lat
 * (matching the INSERT format `(${lng},${lat})`).
 * Handles both the string form and the {x,y} object form defensively.
 */
export function parsePoint(raw: unknown): LatLng | null {
  if (!raw) return null
  if (typeof raw === 'string') {
    const m = raw.match(/^\(([^,]+),([^)]+)\)$/)
    if (!m) return null
    const lng = parseFloat(m[1])
    const lat = parseFloat(m[2])
    if (isNaN(lng) || isNaN(lat)) return null
    return { lat, lng }
  }
  if (typeof raw === 'object') {
    const obj = raw as Record<string, unknown>
    if (typeof obj.x === 'number' && typeof obj.y === 'number') {
      return { lat: obj.y, lng: obj.x }
    }
  }
  return null
}

export function haversineDistance(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * Math.PI / 180
  const dLng = (b.lng - a.lng) * Math.PI / 180
  const lat1 = a.lat * Math.PI / 180
  const lat2 = b.lat * Math.PI / 180
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}

export function isValidGPSSpeed(
  previous: LatLng | null,
  current: LatLng,
  elapsedMs: number
): boolean {
  if (!previous || elapsedMs === 0) return true
  const distanceM = haversineDistance(previous, current)
  const speedKmh = (distanceM / (elapsedMs / 1000)) * 3.6
  return speedKmh <= MAX_SPEED_KMH
}

export function isWithinBounds(
  pos: LatLng,
  bounds: { north: number; south: number; east: number; west: number }
): boolean {
  return pos.lat <= bounds.north && pos.lat >= bounds.south &&
         pos.lng <= bounds.east && pos.lng >= bounds.west
}
