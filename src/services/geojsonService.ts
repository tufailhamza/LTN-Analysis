/**
 * GeoJSON Service for NYC Census Tracts
 * 
 * In production, you would fetch this from:
 * - US Census Bureau TIGER/Line Shapefiles
 * - A pre-processed GeoJSON endpoint
 * - A CDN or static hosting
 * 
 * For now, we'll provide a service structure that can be extended
 */

export interface GeoJSONFeature {
  type: 'Feature';
  properties: {
    GEOID: string;
    NAME: string;
    [key: string]: any;
  };
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: number[][][] | number[][][][];
  };
}

export interface GeoJSONData {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

/**
 * Validate and fix geometry coordinates
 * Ensures coordinates are in correct format [lon, lat] and within NYC bounds
 */
function validateAndFixGeometry(
  geometry: GeoJSONFeature['geometry'],
  bounds: { minLon: number; maxLon: number; minLat: number; maxLat: number }
): GeoJSONFeature['geometry'] {
  if (!geometry || !geometry.coordinates) {
    return geometry;
  }

  const fixCoordinates = (coords: any[]): any[] => {
    if (typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      // Single coordinate [lon, lat]
      const [lon, lat] = coords;
      
      // Check if coordinates are swapped (common issue)
      // NYC is around lat 40.7, lon -74.0
      // If we see values like -40.x or 74.x, they're likely swapped
      if ((lon > -10 && lon < 10 && lat < -70) || (Math.abs(lon) > 180 || Math.abs(lat) > 90)) {
        // Coordinates are likely swapped, swap them back
        return [lat, lon];
      }
      
      // Clamp to NYC bounds if way outside
      const clampedLon = Math.max(bounds.minLon, Math.min(bounds.maxLon, lon));
      const clampedLat = Math.max(bounds.minLat, Math.min(bounds.maxLat, lat));
      
      return [clampedLon, clampedLat];
    } else if (Array.isArray(coords[0])) {
      // Array of coordinates - recurse
      return coords.map(coord => fixCoordinates(coord));
    }
    return coords;
  };

  if (geometry.type === 'Polygon') {
    return {
      ...geometry,
      coordinates: (geometry.coordinates as number[][][]).map(ring => 
        ring.map(coord => fixCoordinates(coord))
      ),
    };
  } else if (geometry.type === 'MultiPolygon') {
    return {
      ...geometry,
      coordinates: (geometry.coordinates as number[][][][]).map(polygon =>
        polygon.map(ring => ring.map(coord => fixCoordinates(coord)))
      ),
    };
  }

  return geometry;
}

/**
 * Fetch NYC census tract GeoJSON data
 * 
 * Sources:
 * 1. NYC Open Data Portal
 * 2. Census TIGER/Line (processed)
 * 3. Public GitHub repos with pre-processed GeoJSON
 */
export async function fetchNYCTractsGeoJSON(): Promise<GeoJSONData | null> {
  try {
    // Official Census TIGERweb REST API - Most reliable source for tract boundaries
    // NYC Counties: 005 (Bronx), 047 (Brooklyn), 061 (Manhattan), 081 (Queens), 085 (Staten Island)
    
    const baseUrl = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/tracts/query';
    const nycCounties = ['005', '047', '061', '081', '085'];
    
    // Build query for all NYC counties
    const countyFilter = nycCounties.map(c => `COUNTY='${c}'`).join('%20OR%20');
    const whereClause = `STATE='36'%20AND%20(${countyFilter})`;
    
    const tigerWebUrl = `${baseUrl}?where=${whereClause}&outFields=GEOID,NAME,COUNTY,STATE&outSR=4326&f=geojson&resultRecordCount=10000`;
    
    console.log('Fetching tract boundaries from Census TIGERweb API...');
    
    try {
      const response = await fetch(tigerWebUrl);
      
      if (!response.ok) {
        throw new Error(`TIGERweb API returned ${response.status}: ${response.statusText}`);
      }
      
      const data: GeoJSONData = await response.json();
      
      if (data.features && data.features.length > 0) {
        // Validate and fix coordinates - NYC bounds
        const nycBounds = {
          minLon: -74.5,
          maxLon: -73.5,
          minLat: 40.4,
          maxLat: 41.0,
        };
        
        /**
         * Calculate approximate area of a polygon (in square degrees)
         * Used to filter out very small water-only tracts
         */
        const calculatePolygonArea = (coords: number[][]): number => {
          if (!coords || coords.length < 3) return 0;
          let area = 0;
          for (let i = 0; i < coords.length - 1; i++) {
            area += coords[i][0] * coords[i + 1][1];
            area -= coords[i + 1][0] * coords[i][1];
          }
          return Math.abs(area) / 2;
        };

        /**
         * Check if tract is likely a water-only tract
         * Census water tracts typically have:
         * - Very small area
         * - Tract codes like .00, .01, .98, .99 (water tracts)
         * - Names containing "water" or special identifiers
         */
        const isWaterTract = (feature: GeoJSONFeature): boolean => {
          const geoid = feature.properties?.GEOID || '';
          const name = String(feature.properties?.NAME || '').toLowerCase();
          
          // Check tract code - water tracts often end in .00, .01, .98, .99
          const tractCode = geoid.substring(5); // Last 6 digits
          const tractDecimal = parseFloat(`0.${tractCode.substring(3)}`);
          if (tractDecimal === 0 || tractDecimal === 0.01 || tractDecimal === 0.98 || tractDecimal === 0.99) {
            // Could be water, check area
            if (feature.geometry) {
              let area = 0;
              if (feature.geometry.type === 'Polygon') {
                const coords = (feature.geometry.coordinates as number[][][])[0];
                area = calculatePolygonArea(coords);
              } else if (feature.geometry.type === 'MultiPolygon') {
                const polygons = feature.geometry.coordinates as number[][][][];
                polygons.forEach(poly => {
                  area += calculatePolygonArea(poly[0]);
                });
              }
              
              // Very small areas are likely water-only tracts
              if (area < 0.00001) { // Very small threshold for water tracts
                return true;
              }
            }
          }
          
          // Check name for water indicators
          if (name.includes('water') || name.includes('marine') || name.includes('ocean')) {
            return true;
          }
          
          return false;
        };

        // Normalize and validate features
        data.features = data.features
          .filter((feature) => {
            // Ensure it's a valid NYC county
            const county = String(feature.properties?.COUNTY || '').padStart(3, '0');
            if (!nycCounties.includes(county) || !feature.properties?.GEOID) {
              return false;
            }
            
            // Validate geometry exists
            if (!feature.geometry || !feature.geometry.coordinates) {
              console.warn('Feature missing geometry:', feature.properties?.GEOID);
              return false;
            }
            
            // Filter out water-only tracts
            if (isWaterTract(feature)) {
              return false;
            }
            
            return true;
          })
          .map((feature) => {
            if (feature.properties) {
              // Normalize GEOID - should be 11 digits (State + County + Tract)
              let geoid = String(feature.properties.GEOID || '').replace(/\s+/g, '');
              
              // If GEOID is missing or incomplete, construct it
              if (!geoid || geoid.length < 11) {
                const state = feature.properties.STATE || '36';
                const county = String(feature.properties.COUNTY || '').padStart(3, '0');
                const tract = feature.properties.TRACT || feature.properties.TRACTCE || '';
                geoid = `${state}${county}${String(tract).padStart(6, '0')}`;
              }
              
              // Ensure GEOID is exactly 11 characters
              feature.properties.GEOID = geoid.substring(0, 11);
              
              // Ensure NAME field exists
              if (!feature.properties.NAME) {
                feature.properties.NAME = feature.properties.NAMELSAD || 
                                          `Tract ${feature.properties.TRACT || ''}`;
              }
              
              // Store normalized county
              feature.properties.county = String(feature.properties.COUNTY || '').padStart(3, '0');
              feature.properties.state = String(feature.properties.STATE || '36');
            }
            
            // Validate and fix geometry coordinates
            if (feature.geometry) {
              feature.geometry = validateAndFixGeometry(feature.geometry, nycBounds);
            }
            
            return feature;
          })
          .filter((feature) => {
            // Final filter: ensure geometry is still valid after processing
            return feature.geometry && feature.geometry.coordinates && 
                   feature.geometry.coordinates.length > 0;
          });
        
        const afterWaterFilter = data.features.length;
        
        console.log(`✅ Successfully loaded ${afterWaterFilter} census tract boundaries from Census TIGERweb API`);
        console.log(`🏞️ Filtered out water-only tracts - showing only land-based tracts`);
        
        // Sample a few features to check coordinate ranges
        if (data.features.length > 0) {
          const sampleFeature = data.features[0];
          if (sampleFeature.geometry && sampleFeature.geometry.coordinates) {
            const sampleCoords = sampleFeature.geometry.type === 'Polygon' 
              ? (sampleFeature.geometry.coordinates as number[][][])[0][0]
              : (sampleFeature.geometry.coordinates as number[][][][])[0][0][0];
            
            if (sampleCoords && sampleCoords.length >= 2) {
              console.log(`📍 Sample coordinates [lon, lat]: [${sampleCoords[0]}, ${sampleCoords[1]}]`);
              console.log(`   Expected NYC range: lon [-74.5, -73.5], lat [40.4, 41.0]`);
            }
          }
        }
        
        // Log distribution by county
        const countyCounts: Record<string, number> = {};
        const countyNames: Record<string, string> = {
          '005': 'Bronx',
          '047': 'Brooklyn',
          '061': 'Manhattan',
          '081': 'Queens',
          '085': 'Staten Island'
        };
        
        data.features.forEach(f => {
          const county = f.properties?.county || 'unknown';
          countyCounts[county] = (countyCounts[county] || 0) + 1;
        });
        
        console.log('📊 Tract coverage by borough:');
        Object.entries(countyCounts).forEach(([code, count]) => {
          console.log(`   ${countyNames[code] || code}: ${count} tracts`);
        });
        
        return data;
      } else {
        throw new Error('TIGERweb API returned no features');
      }
    } catch (fetchError) {
      console.error('❌ Failed to fetch from Census TIGERweb API:', fetchError);
      
      // Fallback: Try NYC Open Data Portal
      console.log('🔄 Trying fallback: NYC Open Data Portal...');
      try {
        const nycOpenDataUrl = 'https://services5.arcgis.com/GWWN6oDUlXqXy9Ur/arcgis/rest/services/2020_Census_Tracts/FeatureServer/0/query?where=COUNTY_FIPS%20IN%20(%27005%27%2C%27047%27%2C%27061%27%2C%27081%27%2C%27085%27)&outFields=*&outSR=4326&f=geojson&resultRecordCount=10000';
        const response = await fetch(nycOpenDataUrl);
        
        if (response.ok) {
          const data: GeoJSONData = await response.json();
          if (data.features && data.features.length > 0) {
            // Apply water filtering for fallback source
            const calculateAreaFallback = (coords: number[][]): number => {
              if (!coords || coords.length < 3) return 0;
              let area = 0;
              for (let i = 0; i < coords.length - 1; i++) {
                area += coords[i][0] * coords[i + 1][1];
                area -= coords[i + 1][0] * coords[i][1];
              }
              return Math.abs(area) / 2;
            };

            const isWaterFallback = (feature: GeoJSONFeature): boolean => {
              const geoid = String(feature.properties?.GEOID || feature.properties?.GEOID20 || '');
              const name = String(feature.properties?.NAME || feature.properties?.NAME20 || '').toLowerCase();
              
              if (geoid.length >= 11) {
                const tractCode = geoid.substring(5);
                const tractDecimal = parseFloat(`0.${tractCode.substring(3)}`);
                if (tractDecimal === 0 || tractDecimal === 0.01 || tractDecimal === 0.98 || tractDecimal === 0.99) {
                  if (feature.geometry) {
                    let area = 0;
                    if (feature.geometry.type === 'Polygon') {
                      area = calculateAreaFallback((feature.geometry.coordinates as number[][][])[0]);
                    } else if (feature.geometry.type === 'MultiPolygon') {
                      (feature.geometry.coordinates as number[][][][]).forEach(poly => {
                        area += calculateAreaFallback(poly[0]);
                      });
                    }
                    if (area < 0.00001) return true;
                  }
                }
              }
              return name.includes('water') || name.includes('marine') || name.includes('ocean');
            };

            // Normalize features (similar to above)
            data.features = data.features
              .filter((feature) => {
                const county = String(feature.properties?.COUNTY_FIPS || feature.properties?.COUNTY || '').padStart(3, '0');
                if (!nycCounties.includes(county)) return false;
                if (isWaterFallback(feature)) return false;
                return true;
              })
              .map((feature) => {
                if (feature.properties) {
                  let geoid = String(feature.properties.GEOID || 
                    feature.properties.GEOID20 || 
                    `${feature.properties.STATE || '36'}${String(feature.properties.COUNTY_FIPS || feature.properties.COUNTY || '').padStart(3, '0')}${String(feature.properties.TRACT || feature.properties.TRACTCE || '').padStart(6, '0')}`
                  ).replace(/\s+/g, '').substring(0, 11);
                  
                  feature.properties.GEOID = geoid;
                  feature.properties.NAME = feature.properties.NAME || feature.properties.NAME20 || `Tract ${feature.properties.TRACT || ''}`;
                  feature.properties.county = String(feature.properties.COUNTY_FIPS || feature.properties.COUNTY || '').padStart(3, '0');
                }
                return feature;
              });
            
            console.log(`✅ Fallback: Loaded ${data.features.length} tracts from NYC Open Data`);
            return data;
          }
        }
      } catch (fallbackError) {
        console.warn('Fallback also failed:', fallbackError);
      }
    }
    
    // If all sources fail, return null to use mock data
    console.warn('⚠️ Could not fetch real GeoJSON, falling back to mock data');
    return null;
  } catch (error) {
    console.error('❌ Error fetching GeoJSON:', error);
    return null;
  }
}

/**
 * Generate mock GeoJSON for development/testing
 * This creates comprehensive coverage for ALL NYC boroughs
 * Note: In production, use real TIGER/Line boundaries
 */
export function generateMockGeoJSON(tractData: any[]): GeoJSONData {
  const features: GeoJSONFeature[] = tractData.map((tract, index) => {
    // Better distribution: Use county codes to group tracts geographically
    const countyCode = String(tract.county || '061').padStart(3, '0'); // Default to Manhattan
    const tractIndex = parseInt(tract.tract || String(index), 10);
    
    // NYC comprehensive bounds for all boroughs
    const nycBounds = {
      minLon: -74.26,
      maxLon: -73.70,
      minLat: 40.47,
      maxLat: 40.92,
    };
    
    // More comprehensive distribution based on county with better coverage
    let baseLon: number, baseLat: number;
    const totalTractsInCounty = tractData.filter(t => String(t.county || '').padStart(3, '0') === countyCode).length;
    const countyIndex = tractData.filter((t, i) => {
      const tc = String(t.county || '').padStart(3, '0');
      return tc === countyCode && i < index;
    }).length;
    
    switch (countyCode) {
      case '061': // Manhattan
        baseLon = -73.98 + (countyIndex % 25) * 0.006;
        baseLat = 40.76 - Math.floor(countyIndex / 25) * 0.006;
        break;
      case '047': // Brooklyn - Much larger area
        baseLon = -74.05 + (countyIndex % 35) * 0.005;
        baseLat = 40.56 - Math.floor(countyIndex / 35) * 0.005;
        break;
      case '081': // Queens - Largest borough
        baseLon = -73.95 + (countyIndex % 40) * 0.004;
        baseLat = 40.63 - Math.floor(countyIndex / 40) * 0.004;
        break;
      case '005': // Bronx - North of Manhattan
        baseLon = -73.92 + (countyIndex % 30) * 0.005;
        baseLat = 40.80 - Math.floor(countyIndex / 30) * 0.005;
        break;
      case '085': // Staten Island - Southwest
        baseLon = -74.25 + (countyIndex % 20) * 0.006;
        baseLat = 40.50 - Math.floor(countyIndex / 20) * 0.006;
        break;
      default:
        baseLon = -74.0060 + (index % 50) * 0.008;
        baseLat = 40.7128 - Math.floor(index / 50) * 0.008;
    }
    
    // Ensure within NYC bounds
    baseLon = Math.max(nycBounds.minLon, Math.min(nycBounds.maxLon, baseLon));
    baseLat = Math.max(nycBounds.minLat, Math.min(nycBounds.maxLat, baseLat));
    
    // Create varied polygon shapes with more realistic coverage
    const size = 0.003 + (tractIndex % 4) * 0.0015; // Smaller, more varied sizes
    const angle = (tractIndex % 8) * (Math.PI / 4); // More rotation options
    
    // Create a more realistic polygon (8-sided for better coverage)
    const polygon: number[][] = [[baseLon, baseLat]];
    for (let i = 1; i <= 8; i++) {
      const a = angle + (i * Math.PI / 4);
      polygon.push([
        baseLon + size * Math.cos(a),
        baseLat + size * Math.sin(a)
      ]);
    }
    polygon.push([baseLon, baseLat]); // Close polygon
    
    return {
      type: 'Feature',
      properties: {
        GEOID: tract.GEOID || tract.geoid,
        NAME: tract.NAME || tract.name || `Tract ${index + 1}`,
        county: countyCode,
        ...tract,
      },
      geometry: {
        type: 'Polygon',
        coordinates: [polygon],
      },
    };
  });

  return {
    type: 'FeatureCollection',
    features,
  };
}

