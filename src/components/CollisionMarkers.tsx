import { memo, useMemo } from 'react';
import { CircleMarker, Popup, useMapEvents } from 'react-leaflet';
import { CollisionRecord } from '@/services/collisionApi';
import L from 'leaflet';

interface CollisionMarkersProps {
  collisions: CollisionRecord[];
  mapBounds: L.LatLngBounds | null;
  zoomLevel: number;
}

// Component to track map events
function MapEvents({ onBoundsChange, onZoomChange }: { onBoundsChange: (bounds: L.LatLngBounds) => void; onZoomChange: (zoom: number) => void }) {
  useMapEvents({
    moveend: (e) => {
      const map = e.target;
      onBoundsChange(map.getBounds());
    },
    zoomend: (e) => {
      const map = e.target;
      onZoomChange(map.getZoom());
    },
  });
  return null;
}

const CollisionMarkers = memo(({ collisions, mapBounds, zoomLevel }: CollisionMarkersProps) => {
  // Performance optimizations:
  // 1. Limit markers based on zoom level (only show when zoomed in)
  // 2. Filter by viewport bounds
  // 3. Limit maximum markers rendered
  // 4. Memoize filtered collisions

  const visibleCollisions = useMemo(() => {
    if (!collisions.length) return [];

    // Don't show markers if zoomed out too far (performance)
    if (zoomLevel < 11) {
      return []; // Only show markers when zoomed in
    }

    let filtered = collisions;

    // Filter by viewport bounds if available
    if (mapBounds) {
      filtered = collisions.filter((collision) => {
        const lat = parseFloat(collision.latitude || '');
        const lon = parseFloat(collision.longitude || '');
        
        if (isNaN(lat) || isNaN(lon)) return false;
        
        return mapBounds.contains([lat, lon]);
      });
    }

    // Limit to maximum 2000 markers for performance
    // Prioritize collisions with injuries/fatalities
    if (filtered.length > 2000) {
      const withSeverity = filtered.filter(
        (c) => parseInt(c.number_of_persons_injured || '0') > 0 || 
               parseInt(c.number_of_persons_killed || '0') > 0
      );
      const withoutSeverity = filtered.filter(
        (c) => parseInt(c.number_of_persons_injured || '0') === 0 && 
               parseInt(c.number_of_persons_killed || '0') === 0
      );
      
      // Take all severe collisions + sample of others
      const sampleSize = Math.min(2000 - withSeverity.length, withoutSeverity.length);
      const sampled = withoutSeverity.slice(0, sampleSize);
      
      return [...withSeverity, ...sampled];
    }

    return filtered;
  }, [collisions, mapBounds, zoomLevel]);

  return (
    <>
      {visibleCollisions.map((collision) => {
        const lat = parseFloat(collision.latitude || '');
        const lon = parseFloat(collision.longitude || '');
        
        // Skip if coordinates are invalid
        if (isNaN(lat) || isNaN(lon)) {
          return null;
        }

        const injured = parseInt(collision.number_of_persons_injured || '0');
        const killed = parseInt(collision.number_of_persons_killed || '0');
        const crashDate = collision.crash_date ? new Date(collision.crash_date).toLocaleDateString() : 'Unknown date';

        return (
          <CircleMarker
            key={collision.collision_id}
            center={[lat, lon]}
            radius={killed > 0 ? 7 : injured > 0 ? 6 : 5} // Larger for more severe collisions
            pathOptions={{
              fillColor: killed > 0 ? '#991b1b' : '#dc2626', // Darker red for fatalities
              color: killed > 0 ? '#7f1d1d' : '#991b1b',
              fillOpacity: 0.8,
              weight: killed > 0 ? 2 : 1,
            }}
          >
            <Popup>
              <div className="p-2 min-w-[200px]">
                <h3 className="font-semibold text-sm mb-2">Collision #{collision.collision_id}</h3>
                <div className="text-xs space-y-1">
                  <div>Date: <span className="font-medium">{crashDate}</span></div>
                  {collision.crash_time && (
                    <div>Time: <span className="font-medium">{collision.crash_time}</span></div>
                  )}
                  {injured > 0 && (
                    <div className="text-orange-600">
                      Injured: <span className="font-medium">{injured}</span>
                    </div>
                  )}
                  {killed > 0 && (
                    <div className="text-red-600 font-semibold">
                      Fatalities: <span className="font-medium">{killed}</span>
                    </div>
                  )}
                  {collision.contributing_factor_vehicle_1 && (
                    <div className="mt-2 pt-2 border-t border-gray-200">
                      <div className="text-xs text-gray-600">
                        Contributing Factor: {collision.contributing_factor_vehicle_1}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
});

CollisionMarkers.displayName = 'CollisionMarkers';

export { CollisionMarkers, MapEvents };

