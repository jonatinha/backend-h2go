import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { point, polygon as turfPolygon } from '@turf/helpers';
import distance from '@turf/distance';
import type { DeliveryRegion } from '../types/index.js';

export function resolveOrderCoordinates(order: {
  latitude?: number | null;
  longitude?: number | null;
  address?: { latitude?: number | null; longitude?: number | null; neighborhood?: string };
}): { lat: number; lng: number } | null {
  const lat =
    order.latitude ??
    order.address?.latitude ??
    null;
  const lng =
    order.longitude ??
    order.address?.longitude ??
    null;

  if (lat == null || lng == null || Number.isNaN(Number(lat)) || Number.isNaN(Number(lng))) {
    return null;
  }
  return { lat: Number(lat), lng: Number(lng) };
}

export function regionContainsPoint(
  region: DeliveryRegion,
  lat: number,
  lng: number
): boolean {
  if (region.boundary_type === 'radius') {
    if (region.center_lat == null || region.center_lng == null || region.radius_km == null) {
      return false;
    }
    const km = distance(
      point([region.center_lng, region.center_lat]),
      point([lng, lat]),
      { units: 'kilometers' }
    );
    return km <= Number(region.radius_km);
  }

  const geom = region.geometry as { type?: string; coordinates?: number[][][] };
  if (geom?.type === 'Polygon' && Array.isArray(geom.coordinates?.[0])) {
    const ring = geom.coordinates[0];
    if (ring.length < 4) return false;
    return booleanPointInPolygon(point([lng, lat]), turfPolygon(geom.coordinates));
  }

  return false;
}

export function findMatchingRegion(
  regions: DeliveryRegion[],
  lat: number,
  lng: number,
  allowedRegionIds?: string[]
): DeliveryRegion | null {
  for (const region of regions) {
    if (!region.is_active) continue;
    if (allowedRegionIds?.length && !allowedRegionIds.includes(region.id)) continue;
    if (regionContainsPoint(region, lat, lng)) return region;
  }
  return null;
}

export function haversineKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number }
): number {
  return distance(point([from.lng, from.lat]), point([to.lng, to.lat]), {
    units: 'kilometers',
  });
}
