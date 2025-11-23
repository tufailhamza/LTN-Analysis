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

import { feature, intersect, area, booleanIntersects, bbox } from '@turf/turf';

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
 * 1. Local GeoJSON file (Primary) - /2020_Census_Tracts_20251102.geojson from public folder
 * 2. Census TIGER/Line (fallback)
 * 3. Mock data (final fallback)
 * 
 * Displays ALL tracts from the local file - no filtering by county or water tracts
 */
export async function fetchNYCTractsGeoJSON(): Promise<GeoJSONData | null> {
  try {
    const nycCounties = ['005', '047', '061', '081', '085'];
    
    // Primary source: Local GeoJSON file from public folder
    const localGeoJsonPath = '/2020_Census_Tracts_20251102.geojson';
    
    console.log('Loading tract boundaries from local GeoJSON file...');
    
    try {
      const response = await fetch(localGeoJsonPath);
      
      if (!response.ok) {
        throw new Error(`Local GeoJSON file returned ${response.status}: ${response.statusText}`);
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

        // Display ALL tracts from the file - normalize properties but don't filter out
        // Only remove features with invalid geometry
        data.features = data.features
          .map((feature) => {
            if (feature.properties) {
              // Normalize GEOID - handle both 'GEOID' and 'geoid' field names
              let geoid = String(feature.properties.GEOID || feature.properties.geoid || '').replace(/\s+/g, '');
              
              // Ensure GEOID is exactly 11 characters if available
              if (geoid.length >= 11) {
                feature.properties.GEOID = geoid.substring(0, 11);
              } else if (geoid.length > 0) {
                // Try to pad if incomplete
                feature.properties.GEOID = geoid.padEnd(11, '0');
              } else {
                // Generate a GEOID if missing but we have other properties
                // Use ct2020, borocode, etc. to construct one if possible
                if (feature.properties.ct2020 && feature.properties.borocode) {
                  const state = '36';
                  const county = String(feature.properties.borocode).padStart(3, '0');
                  const tract = String(feature.properties.ct2020).replace(/^0+/, '').padStart(6, '0');
                  feature.properties.GEOID = `${state}${county}${tract}`.substring(0, 11);
                }
              }
              
              // Extract county from GEOID if available
              if (feature.properties.GEOID && feature.properties.GEOID.length >= 11) {
                feature.properties.county = feature.properties.GEOID.substring(2, 5);
              } else if (feature.properties.borocode) {
                // Map borocode to county FIPS
                const borocodeMap: Record<string, string> = {
                  '1': '061', // Manhattan
                  '2': '005', // Bronx
                  '3': '047', // Brooklyn
                  '4': '081', // Queens
                  '5': '085'  // Staten Island
                };
                feature.properties.county = borocodeMap[String(feature.properties.borocode)] || '';
              }
              
              // Ensure NAME field exists - use ctlabel or construct from ntaname
              if (!feature.properties.NAME) {
                feature.properties.NAME = feature.properties.ctlabel || 
                                          feature.properties.ntaname || 
                                          `Tract ${feature.properties.GEOID?.substring(5) || feature.properties.ct2020 || ''}`;
              }
              
              // Store state (NY is 36)
              feature.properties.state = '36';
              
              // Preserve all original fields from the GeoJSON file
              // This ensures we keep all data from the local file
            }
            
            // Validate and fix geometry coordinates if geometry exists
            if (feature.geometry) {
              feature.geometry = validateAndFixGeometry(feature.geometry, nycBounds);
            }
            
            return feature;
          })
          .filter((feature) => {
            // Only filter out features with completely invalid geometry
            // Keep ALL tracts that have valid geometry, regardless of other properties
            return feature.geometry && 
                   feature.geometry.coordinates && 
                   feature.geometry.coordinates.length > 0;
          });
        
        const totalTracts = data.features.length;
        
        console.log(`✅ Successfully loaded ${totalTracts} census tract boundaries from local GeoJSON file`);
        console.log(`📊 Displaying ALL tracts from 2020_Census_Tracts_20251102.geojson`);
        
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
        
        // Enhance with NTA data
        let enhancedData = await enhanceTractsWithNTAs(data);
        
        // Enhance with greenspace data
        enhancedData = await enhanceTractsWithGreenspace(enhancedData);
        
        return enhancedData;
      } else {
        throw new Error('Local GeoJSON file returned no features');
      }
    } catch (fetchError) {
      console.error('❌ Failed to load from local GeoJSON file:', fetchError);
      
      // Fallback: Try Census TIGERweb REST API
      console.log('🔄 Trying fallback: Census TIGERweb API...');
      try {
        const baseUrl = 'https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/tracts/query';
        const countyFilter = nycCounties.map(c => `COUNTY='${c}'`).join('%20OR%20');
        const whereClause = `STATE='36'%20AND%20(${countyFilter})`;
        const tigerWebUrl = `${baseUrl}?where=${whereClause}&outFields=GEOID,NAME,COUNTY,STATE&outSR=4326&f=geojson&resultRecordCount=10000`;
        
        const response = await fetch(tigerWebUrl);
        
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

/**
 * Fetch NYC Neighborhood Tabulation Areas (NTA) GeoJSON data
 */
export async function fetchNYCNTAsGeoJSON(): Promise<GeoJSONData | null> {
  try {
    const ntaGeoJsonPath = '/2020_Neighborhood_Tabulation_Areas_(NTAs)_20251122.geojson';
    
    console.log('Loading NTA boundaries from local GeoJSON file...');
    
    try {
      const response = await fetch(ntaGeoJsonPath);
      
      if (!response.ok) {
        throw new Error(`Local NTA GeoJSON file returned ${response.status}: ${response.statusText}`);
      }
      
      const data: GeoJSONData = await response.json();
      
      if (data.features && data.features.length > 0) {
        console.log(`✅ Successfully loaded ${data.features.length} NTA boundaries`);
        return data;
      } else {
        throw new Error('Local NTA GeoJSON file returned no features');
      }
    } catch (fetchError) {
      console.error('❌ Failed to load NTA GeoJSON file:', fetchError);
      return null;
    }
  } catch (error) {
    console.error('❌ Error fetching NTA GeoJSON:', error);
    return null;
  }
}

/**
 * Find overlapping NTAs for a given tract
 * Returns array of NTA codes (nta2020) that overlap with the tract
 */
export function findOverlappingNTAs(
  tractFeature: GeoJSONFeature,
  ntaData: GeoJSONData
): string[] {
  if (!tractFeature.geometry || !ntaData || !ntaData.features) {
    return [];
  }

  const overlappingNTAs: string[] = [];
  const tractGeometry = tractFeature.geometry;

  try {
    // Convert tract geometry to Turf.js format
    const tractTurf = feature({
      type: tractGeometry.type,
      coordinates: tractGeometry.coordinates,
    });

    // Check each NTA for intersection
    for (const ntaFeature of ntaData.features) {
      if (!ntaFeature.geometry || !ntaFeature.properties) {
        continue;
      }

      try {
        const ntaTurf = feature({
          type: ntaFeature.geometry.type,
          coordinates: ntaFeature.geometry.coordinates,
        });

        // Check if geometries intersect
        const intersection = intersect(tractTurf, ntaTurf);
        
        if (intersection) {
          // Calculate intersection area to ensure meaningful overlap
          const intersectionArea = area(intersection);
          const tractArea = area(tractTurf);
          
          // Include if intersection is at least 1% of tract area
          // This handles edge cases where tiny overlaps occur
          if (intersectionArea > 0 && (intersectionArea / tractArea) > 0.01) {
            const ntaCode = ntaFeature.properties.nta2020 || ntaFeature.properties.NTA2020;
            if (ntaCode && !overlappingNTAs.includes(ntaCode)) {
              overlappingNTAs.push(ntaCode);
            }
          }
        }
      } catch (error) {
        // Skip this NTA if there's an error (invalid geometry, etc.)
        continue;
      }
    }
  } catch (error) {
    console.warn('Error finding overlapping NTAs:', error);
  }

  return overlappingNTAs;
}

/**
 * Enhance tract GeoJSON with overlapping NTA information
 */
export async function enhanceTractsWithNTAs(tractsData: GeoJSONData): Promise<GeoJSONData> {
  const ntaData = await fetchNYCNTAsGeoJSON();
  
  if (!ntaData || !ntaData.features || ntaData.features.length === 0) {
    console.warn('⚠️ No NTA data available, skipping NTA enhancement');
    return tractsData;
  }

  console.log('🔗 Finding overlapping NTAs for each tract...');
  
  let processedCount = 0;
  const enhancedFeatures = tractsData.features.map((tractFeature) => {
    const overlappingNTAs = findOverlappingNTAs(tractFeature, ntaData);
    
    if (overlappingNTAs.length > 0) {
      processedCount++;
    }

    // Add NTA information to tract properties
    return {
      ...tractFeature,
      properties: {
        ...tractFeature.properties,
        overlappingNTAs: overlappingNTAs,
        ntaCodes: overlappingNTAs.join(', '), // For display purposes
      },
    };
  });

  console.log(`✅ Enhanced ${processedCount} tracts with NTA information`);

  return {
    ...tractsData,
    features: enhancedFeatures,
  };
}

/**
 * Fetch NYC Parks GeoJSON data
 */
export async function fetchNYCParksGeoJSON(): Promise<GeoJSONData | null> {
  try {
    const parksGeoJsonPath = '/Parks_Properties_20251123.geojson';
    
    console.log('Loading parks boundaries from local GeoJSON file...');
    
    try {
      const response = await fetch(parksGeoJsonPath);
      
      if (!response.ok) {
        throw new Error(`Local Parks GeoJSON file returned ${response.status}: ${response.statusText}`);
      }
      
      const data: GeoJSONData = await response.json();
      
      if (data.features && data.features.length > 0) {
        // Validate and fix park coordinates - same as tracts
        const nycBounds = {
          minLon: -74.5,
          maxLon: -73.5,
          minLat: 40.4,
          maxLat: 41.0,
        };

        // Validate and fix park geometries
        data.features = data.features
          .map((feature) => {
            // Validate and fix geometry coordinates if geometry exists
            if (feature.geometry) {
              feature.geometry = validateAndFixGeometry(feature.geometry, nycBounds);
            }
            return feature;
          })
          .filter((feature) => {
            // Only keep features with valid geometry
            return feature.geometry && 
                   feature.geometry.coordinates && 
                   feature.geometry.coordinates.length > 0;
          });
        
        console.log(`✅ Successfully loaded ${data.features.length} park boundaries`);
        
        // Sample a park to verify coordinates
        if (data.features.length > 0) {
          const samplePark = data.features[0];
          if (samplePark.geometry && samplePark.geometry.coordinates) {
            const sampleCoords = samplePark.geometry.type === 'Polygon' 
              ? (samplePark.geometry.coordinates as number[][][])[0][0]
              : (samplePark.geometry.coordinates as number[][][][])[0][0][0];
            
            if (sampleCoords && sampleCoords.length >= 2) {
              console.log(`📍 Sample park coordinates [lon, lat]: [${sampleCoords[0]}, ${sampleCoords[1]}]`);
            }
          }
        }
        
        return data;
      } else {
        throw new Error('Local Parks GeoJSON file returned no features');
      }
    } catch (fetchError) {
      console.error('❌ Failed to load Parks GeoJSON file:', fetchError);
      return null;
    }
  } catch (error) {
    console.error('❌ Error fetching Parks GeoJSON:', error);
    return null;
  }
}

/**
 * NOTE: Greenspace calculation is now done via Python script (scripts/calculate_greenspace.py)
 * and loaded from greenspace_percentages.json. No browser-side computation is performed.
 * 
 * The calculateGreenspacePercentage function has been removed to ensure all calculations
 * are pre-computed for better performance.
 */

/**
 * Load pre-computed greenspace percentages from JSON file
 * All greenspace calculations are done in Python - no browser computation needed.
 */
async function loadGreenspaceData(): Promise<Record<string, number>> {
  try {
    const response = await fetch('/greenspace_percentages.json');
    if (!response.ok) {
      throw new Error(`Failed to load greenspace data: ${response.status} ${response.statusText}`);
    }
    const data: Record<string, number> = await response.json();
    console.log(`✅ Loaded pre-computed greenspace data for ${Object.keys(data).length} tracts`);
    return data;
  } catch (error) {
    console.error('❌ Could not load pre-computed greenspace data:', error);
    console.error('💡 Make sure to run: python scripts/calculate_greenspace.py');
    throw error;
  }
}

/**
 * Enhance tract GeoJSON with greenspace percentage information
 * 
 * Uses pre-computed data from greenspace_percentages.json (calculated via Python).
 * No computation is done in the browser - all data is pre-calculated.
 */
export async function enhanceTractsWithGreenspace(tractsData: GeoJSONData): Promise<GeoJSONData> {
  console.log('🌳 Loading pre-computed greenspace data...');
  
  // Load pre-computed greenspace data (calculated via Python script)
  const greenspaceData = await loadGreenspaceData();
  
  console.log('📊 Integrating greenspace percentages into tract data...');
  
  let processedCount = 0;
  let totalGreenspace = 0;
  let maxGreenspace = 0;
  let minGreenspace = Infinity;
  
  const enhancedFeatures = tractsData.features.map((tractFeature) => {
    const geoid = tractFeature.properties?.GEOID || tractFeature.properties?.geoid;
    const greenspacePercent = geoid ? (greenspaceData[geoid] ?? 0) : 0;
    
    // Track tracts with parks (greenspace > 0)
    if (greenspacePercent > 0) {
      processedCount++;
    }
    
    // Track statistics
    totalGreenspace += greenspacePercent;
    if (greenspacePercent > maxGreenspace) {
      maxGreenspace = greenspacePercent;
    }
    if (greenspacePercent < minGreenspace) {
      minGreenspace = greenspacePercent;
    }

    // Add greenspace information to tract properties
    return {
      ...tractFeature,
      properties: {
        ...tractFeature.properties,
        greenspace: greenspacePercent,
        greenspacePercent: greenspacePercent, // Alias for consistency
      },
    };
  });

  const avgGreenspace = totalGreenspace / tractsData.features.length;
  console.log(`✅ Enhanced ${tractsData.features.length} tracts with greenspace data`);
  console.log(`   📊 Greenspace stats: Min=${minGreenspace === Infinity ? 0 : minGreenspace.toFixed(2)}%, Max=${maxGreenspace.toFixed(2)}%, Avg=${avgGreenspace.toFixed(2)}%, Tracts with parks=${processedCount}`);
  
  return {
    ...tractsData,
    features: enhancedFeatures,
  };
}

