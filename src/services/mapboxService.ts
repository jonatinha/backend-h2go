import { env } from '../config/env.js';
import { assertReverseGeocodeAllowed, recordReverseGeocodeUsage } from './mapboxUsageGuard.js';

const GEOCODE_BASE = 'https://api.mapbox.com/geocoding/v5/mapbox.places';

export function isMapboxServerConfigured(): boolean {
  return Boolean(env.MAPBOX_ACCESS_TOKEN?.trim());
}

export async function reverseGeocode(
  lat: number,
  lng: number,
  clientIp: string
): Promise<{ place_name: string; center: [number, number] }> {
  const token = env.MAPBOX_ACCESS_TOKEN?.trim();
  if (!token) {
    throw new Error('Mapbox não configurado no servidor (MAPBOX_ACCESS_TOKEN).');
  }

  assertReverseGeocodeAllowed(clientIp);

  const url = `${GEOCODE_BASE}/${lng},${lat}.json?limit=1&language=pt&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Mapbox geocoding falhou (${res.status}): ${text.slice(0, 200)}`);
  }

  const body = (await res.json()) as {
    features?: Array<{ place_name?: string; center?: [number, number] }>;
  };

  const feature = body.features?.[0];
  if (!feature?.place_name || !feature.center) {
    throw new Error('Nenhum endereço encontrado para estas coordenadas.');
  }

  recordReverseGeocodeUsage(clientIp);
  return { place_name: feature.place_name, center: feature.center };
}
