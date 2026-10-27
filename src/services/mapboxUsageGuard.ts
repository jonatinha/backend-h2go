/**
 * Cotas internas para APIs Mapbox cobradas por requisição (geocoding).
 * Free tier oficial: 100k/mês Temporary Geocoding — usamos teto bem menor como margem.
 */

const MONTHLY_REVERSE_GEOCODE_CAP = 8_000
const HOURLY_REVERSE_PER_IP = 40

type MonthBucket = { monthKey: string; reverseGeocode: number }
type IpBucket = { hourKey: string; count: number }

let monthBucket: MonthBucket = { monthKey: currentMonthKey(), reverseGeocode: 0 }
const ipBuckets = new Map<string, IpBucket>()

function currentMonthKey() {
  const d = new Date()
  return `${d.getUTCFullYear()}-${d.getUTCMonth() + 1}`
}

function currentHourKey() {
  const d = new Date()
  return `${d.toISOString().slice(0, 13)}`
}

function ensureMonth() {
  const key = currentMonthKey()
  if (monthBucket.monthKey !== key) {
    monthBucket = { monthKey: key, reverseGeocode: 0 }
  }
}

export function assertReverseGeocodeAllowed(clientIp: string): void {
  ensureMonth()
  if (monthBucket.reverseGeocode >= MONTHLY_REVERSE_GEOCODE_CAP) {
    throw new Error(
      'Cota mensal interna de geocodificação atingida. Tente novamente mais tarde ou use apenas o pin no mapa.'
    )
  }

  const hourKey = currentHourKey()
  const ip = clientIp || 'unknown'
  const existing = ipBuckets.get(ip)
  if (!existing || existing.hourKey !== hourKey) {
    ipBuckets.set(ip, { hourKey, count: 0 })
  }
  const bucket = ipBuckets.get(ip)!
  if (bucket.count >= HOURLY_REVERSE_PER_IP) {
    throw new Error('Muitas consultas de endereço nesta hora. Aguarde antes de tentar de novo.')
  }
}

export function recordReverseGeocodeUsage(clientIp: string) {
  ensureMonth()
  monthBucket.reverseGeocode += 1
  const hourKey = currentHourKey()
  const ip = clientIp || 'unknown'
  const existing = ipBuckets.get(ip)
  if (!existing || existing.hourKey !== hourKey) {
    ipBuckets.set(ip, { hourKey, count: 1 })
  } else {
    existing.count += 1
  }
}

export function getMapboxUsageSnapshot() {
  ensureMonth()
  return {
    month: monthBucket.monthKey,
    reverseGeocodeUsed: monthBucket.reverseGeocode,
    reverseGeocodeCap: MONTHLY_REVERSE_GEOCODE_CAP,
  }
}
