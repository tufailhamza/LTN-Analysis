import { booleanPointInPolygon, point, Feature, Polygon, MultiPolygon } from '@turf/turf';
import { CollisionRecord } from '@/services/collisionApi';

export interface CollisionStats {
  total: number;
  injuries: number;
  fatalities: number;
}

/**
 * Count collisions within a tract polygon
 */
export function countCollisionsInTract(
  tract: any,
  collisions: CollisionRecord[]
): CollisionStats {
  const stats: CollisionStats = {
    total: 0,
    injuries: 0,
    fatalities: 0,
  };

  if (!collisions.length) {
    return stats;
  }

  // Get tract geometry - handle different possible structures
  // Tract can be: { geometry: {...}, properties: {...} } (GeoJSON feature)
  // Or: { properties: {...}, geometry: {...} } (spread format)
  const tractGeometry = tract.geometry;
  
  if (!tractGeometry) {
    // Geometry not available in this tract object
    return stats;
  }

  // Create tract feature for Turf.js
  let tractFeature: Feature<Polygon | MultiPolygon>;
  try {
    tractFeature = {
      type: 'Feature',
      properties: {},
      geometry: tractGeometry,
    } as Feature<Polygon | MultiPolygon>;
  } catch (error) {
    console.warn('Invalid tract geometry:', error);
    return stats;
  }

  // Check each collision
  for (const collision of collisions) {
    const lat = parseFloat(collision.latitude || '');
    const lon = parseFloat(collision.longitude || '');

    // Skip if coordinates are invalid
    if (isNaN(lat) || isNaN(lon)) {
      continue;
    }

    // Create point for collision
    const collisionPoint = point([lon, lat]); // Turf uses [lon, lat]

    // Check if point is inside polygon
    try {
      if (booleanPointInPolygon(collisionPoint, tractFeature)) {
        stats.total++;

        const injured = parseInt(collision.number_of_persons_injured || '0');
        const killed = parseInt(collision.number_of_persons_killed || '0');

        if (injured > 0) {
          stats.injuries += injured;
        }
        if (killed > 0) {
          stats.fatalities += killed;
        }
      }
    } catch (error) {
      // Skip this collision if there's an error checking point-in-polygon
      continue;
    }
  }

  return stats;
}

