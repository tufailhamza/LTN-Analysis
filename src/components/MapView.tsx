import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { Plus, Minus, Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCensusData } from '@/hooks/useCensusData';
import { fetchTractData, transformTractData, getCensusApiKey } from '@/services/censusApi';
import { CENSUS_CONFIG } from '@/config/censusConfig';
import { CollisionRecord } from '@/services/collisionApi';
import { useOverlayData } from '@/hooks/useOverlayData';
import { CollisionMarkers, MapEvents } from '@/components/CollisionMarkers';
import 'leaflet/dist/leaflet.css';

// Fix for default markers in React-Leaflet
import L from 'leaflet';

// Fix for default markers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface MapViewProps {
  variables: {
    id: string;
    name: string;
    value: [number, number];
  }[];
  selectedTracts: any[];
  onTractSelect: (tract: any) => void;
  onTractHover: (tract: any) => void;
  onTractHighlight?: (tractId: string) => void;
  collisions?: CollisionRecord[];
  collisionsLoading?: boolean;
  overlayTypes?: string[];
  sidebarOpen?: boolean; // Track sidebar state to trigger map resize
}

// Helper component for rendering a single overlay layer
const OverlayLayer = ({ overlayType }: { overlayType: string }) => {
  const { overlayData } = useOverlayData(overlayType);

  if (!overlayData || !overlayData.features || overlayData.features.length === 0) {
    return null;
  }

  const getOverlayStyle = (type: string) => {
    switch (type) {
      case 'bikeLanes':
        return {
          color: '#0066cc',
          weight: 3,
          opacity: 0.8,
          dashArray: '5, 5',
        };
      case 'parkSpace':
        return {
          fillColor: '#228B22',
          color: '#006400',
          weight: 2,
          fillOpacity: 0.3,
          opacity: 0.7,
        };
      case 'greenstreets':
        return {
          fillColor: '#90EE90',
          color: '#32CD32',
          weight: 2,
          fillOpacity: 0.4,
          opacity: 0.8,
        };
      case 'mtaBusLanes':
        return {
          color: '#FF6600',
          weight: 4,
          opacity: 0.9,
          dashArray: '10, 5',
        };
      default:
        return {
          color: '#666',
          weight: 2,
          opacity: 0.5,
        };
    }
  };

  const getPopupContent = (type: string, props: any) => {
    switch (type) {
      case 'bikeLanes':
        return `
          <div class="p-2 min-w-[200px]">
            <h3 class="font-semibold text-sm mb-2">Bike Lane</h3>
            <div class="text-xs space-y-1">
              ${props.street ? `<div><strong>Street:</strong> ${props.street}</div>` : ''}
              ${props.facilitycl ? `<div><strong>Facility Class:</strong> ${props.facilitycl}</div>` : ''}
              ${props.ft_facilit ? `<div><strong>Facility Type:</strong> ${props.ft_facilit}</div>` : ''}
            </div>
          </div>
        `;
      case 'parkSpace':
        return `
          <div class="p-2 min-w-[200px]">
            <h3 class="font-semibold text-sm mb-2">${props.name311 || props.signname || 'DPR Park'}</h3>
            <div class="text-xs space-y-1">
              ${props.typecategory ? `<div><strong>Type:</strong> ${props.typecategory}</div>` : ''}
              ${props.acres ? `<div><strong>Acres:</strong> ${props.acres}</div>` : ''}
              ${props.location ? `<div><strong>Location:</strong> ${props.location}</div>` : ''}
            </div>
          </div>
        `;
      case 'greenstreets':
        return `
          <div class="p-2 min-w-[200px]">
            <h3 class="font-semibold text-sm mb-2">${props.name311 || props.signname || 'Greenstreet'}</h3>
            <div class="text-xs space-y-1">
              ${props.location ? `<div><strong>Location:</strong> ${props.location}</div>` : ''}
              ${props.acres ? `<div><strong>Acres:</strong> ${props.acres}</div>` : ''}
            </div>
          </div>
        `;
      case 'mtaBusLanes':
        return `
          <div class="p-2 min-w-[200px]">
            <h3 class="font-semibold text-sm mb-2">Bus Lane</h3>
            <div class="text-xs space-y-1">
              ${props.street ? `<div><strong>Street:</strong> ${props.street}</div>` : ''}
              <div class="text-orange-600">MTA Bus Lane Route</div>
            </div>
          </div>
        `;
      default:
        return '';
    }
  };

  return (
    <GeoJSON
      key={`overlay-${overlayType}-${overlayData.features.length}`}
      data={overlayData as any}
      style={() => getOverlayStyle(overlayType)}
      onEachFeature={(feature, layer) => {
        const props = feature.properties || {};
        const popupContent = getPopupContent(overlayType, props);
        if (popupContent) {
          layer.bindPopup(popupContent);
        }
      }}
    />
  );
};

const MapView = ({ variables, selectedTracts, onTractSelect, onTractHover, onTractHighlight, collisions = [], collisionsLoading = false, overlayTypes = [], sidebarOpen = true }: MapViewProps) => {
  const mapRef = useRef<L.Map>(null);
  const { geoJsonData, loading, error } = useCensusData();
  const [hoveredTractData, setHoveredTractData] = useState<any>(null);
  const [loadingTract, setLoadingTract] = useState<string | null>(null);
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(10);
  const layerRef = useRef<Map<string, L.Layer>>(new Map()); // Store layer references by GEOID

  // Resize map when sidebar state changes
  useEffect(() => {
    if (mapRef.current) {
      // Small delay to ensure DOM has updated
      const timer = setTimeout(() => {
        mapRef.current?.invalidateSize();
      }, 300); // Match the sidebar transition duration
      return () => clearTimeout(timer);
    }
  }, [sidebarOpen]);

  // Also handle window resize events
  useEffect(() => {
    const handleResize = () => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Filter tracts based on variable sliders - MUST be defined before useMemo
  // Uses AND logic: tract matches if it satisfies ALL filter criteria simultaneously
  // Initially (no filters), all polygons are shown and styled in yellow
  const isTractMatchingFilters = (tractData: any): boolean => {
    // If no variables/filters defined, consider all tracts as matching (show in yellow)
    if (variables.length === 0) {
      return true;
    }
    
    // If tract has no data but filters are active, don't match (show in grey)
    if (!tractData) {
      return false;
    }
    
    // Check if tract matches ALL variable filters (AND logic)
    // Tract must match ALL active filters to be shown in yellow
    const allMatch = variables.every((variable) => {
      const value = variable.value;
      const [min, max] = value;
      
      // Map variable IDs to tract data properties
      let tractValue: number | undefined;
      switch (variable.id) {
        case 'carfree':
          // Check both carfree and carFreePercent (derived metric)
          // Percent Car-Free Households from ACS B25044
          tractValue = tractData.carfree !== undefined 
            ? Number(tractData.carfree) 
            : (tractData.carFreePercent !== undefined ? Number(tractData.carFreePercent) : undefined);
          break;
        case 'income':
          // Median Household Income from ACS B19013
          tractValue = tractData.income !== undefined 
            ? Number(tractData.income) 
            : (tractData.medianHouseholdIncome !== undefined ? Number(tractData.medianHouseholdIncome) : undefined);
          break;
        case 'transit':
          // Transit Access Score: Percent using public transit to commute from ACS B08301
          tractValue = tractData.transit !== undefined 
            ? Number(tractData.transit) 
            : (tractData.transitScore !== undefined ? Number(tractData.transitScore) : undefined);
          break;
        case 'vulnerable':
          // Percent Vulnerable Residents: Combined metric from ACS B01001 (age) and B18101 (disability)
          // Includes: children (under 18), seniors (65+), and individuals with disabilities
          tractValue = tractData.vulnerable !== undefined 
            ? Number(tractData.vulnerable) 
            : (tractData.vulnerablePercent !== undefined ? Number(tractData.vulnerablePercent) : undefined);
          break;
        case 'greenspace':
          // Percent Greenspace: Percentage of land area dedicated to parks and green spaces
          // Calculated from spatial intersection of parks GeoJSON with tract boundaries
          tractValue = tractData.greenspace !== undefined 
            ? Number(tractData.greenspace) 
            : (tractData.greenspacePercent !== undefined ? Number(tractData.greenspacePercent) : undefined);
          // Greenspace can legitimately be 0, so we need to handle it differently
          // If value is 0, it's a valid value (tract has no parks), not missing data
          // Debug: Log first few tracts to verify greenspace values exist
          if (tractValue === undefined && Math.random() < 0.01) {
            console.log('🔍 Debug: Tract missing greenspace:', {
              geoid: tractData.GEOID,
              hasGreenspace: tractData.greenspace !== undefined,
              hasGreenspacePercent: tractData.greenspacePercent !== undefined,
              properties: Object.keys(tractData),
            });
          }
          break;
        default:
          return true; // Unknown variable, don't filter
      }
      
      // Special handling for greenspace: 0 is a valid value (tract has no parks)
      if (variable.id === 'greenspace') {
        // For greenspace, 0 is valid (means no parks in tract)
        // Only treat as missing if it's undefined or NaN
        if (tractValue === undefined || isNaN(tractValue)) {
          // If filter is at its initial/inclusive state (min = 0), allow missing data to match
          if (min === 0) {
            return true; // Allow missing data when filter is at minimum
          }
          return false; // Exclude missing data when filter has been adjusted above minimum
        }
        // If value is 0, it's valid - check if it's in range
        // Continue to range check below
      } else {
        // For other variables, check for missing or sentinel values
        // Sentinel values: -666666666, -999999999 indicate missing/suppressed data
        if (tractValue === undefined || isNaN(tractValue) || 
            (typeof tractValue === 'number' && tractValue < 0 && (tractValue <= -666666666 || tractValue <= -999999999))) {
          // If filter is at its initial/inclusive state (min = 0), allow missing data to match
          // This means when filters are at default (min = 0), tracts with N/A data still show as yellow
          // Once filters are adjusted above minimum, missing data will be excluded (grey)
          // For income: if min is 0, include N/A tracts; if min > 0, exclude them
          // For percentages: if min is 0, include N/A tracts; if min > 0, exclude them
          if (min === 0) {
            return true; // Allow missing data when filter is at minimum (0 = inclusive/default state)
          }
          return false; // Exclude missing data when filter has been adjusted above minimum
        }
      }
      
      // Check if value is within slider range
      // For AND logic, this must return true for ALL variables
      const isInRange = tractValue >= min && tractValue <= max;
      
      // Return true only if this specific filter is satisfied
      // The .every() will ensure ALL filters must return true
      return isInRange;
    });
    
    // Return true only if ALL filters passed (AND logic)
    return allMatch;
  };
  
  // Show all polygons - no filtering, just styling based on match
  // All polygons are displayed, but colored differently based on filter match
  const displayGeoJsonData = useMemo(() => {
    if (!geoJsonData || !geoJsonData.features) {
      console.log('⚠️ No GeoJSON data available');
      return null;
    }
    
    // Show ALL features, don't filter them out
    console.log(`📊 Displaying all ${geoJsonData.features.length} features (colored by filter match)`);
    
    return geoJsonData;
  }, [geoJsonData]);

  const handleTractClick = (tract: any) => {
    onTractSelect(tract);
  };

  const handleTractHover = async (feature: any) => {
    const geoid = feature.properties.GEOID;
    if (!geoid) return;

    // Notify parent component
    onTractHover(feature);

    // Fetch detailed data if not already available
    if (!feature.properties.totalPopulation) {
      setLoadingTract(geoid);
      try {
        const apiKey = getCensusApiKey();
        const rawData = await fetchTractData(geoid, CENSUS_CONFIG.DEFAULT_YEAR, apiKey);
        if (rawData) {
          const transformed = transformTractData(rawData);
          // Merge with original properties to preserve GeoJSON fields like cdtaname, nta2020, etc.
          const mergedData = {
            ...feature.properties,
            ...transformed,
          };
          setHoveredTractData(mergedData);
          
          // Update feature properties with fetched data
          Object.assign(feature.properties, transformed);
        }
      } catch (error) {
        console.error(`Error fetching tract ${geoid}:`, error);
      } finally {
        setLoadingTract(null);
      }
    } else {
      setHoveredTractData(feature.properties);
    }
  };

  const handleZoomIn = () => {
    if (mapRef.current) {
      mapRef.current.zoomIn();
    }
  };

  const handleZoomOut = () => {
    if (mapRef.current) {
      mapRef.current.zoomOut();
    }
  };

  const handleScreenshot = () => {
    // Leaflet screenshot functionality
    if (mapRef.current) {
      // This would require additional libraries like html2canvas
      alert('Screenshot functionality - click to capture current view');
    }
  };

  // Filter function is defined above (line 38), now use it for styling
  // All polygons are displayed initially, with matching ones styled in yellow
  const getTractStyle = (feature: any) => {
    const isSelected = selectedTracts.some(tract => {
      const tGeoid = tract.properties?.GEOID || tract.GEOID;
      return tGeoid === feature.properties.GEOID;
    });
    
    // Check if tract matches current filters (or no filters = all match initially)
    const matchesFilters = isTractMatchingFilters(feature.properties);
    
    // Style based on selection and filter match
    // Priority: Selected (blue) > Matching filters (yellow) > Non-matching (grey)
    if (isSelected) {
      // Selected tracts: Blue fill with blue border (highest priority)
      return {
        fillColor: '#2196f3',
        weight: 3,
        color: '#1976d2',
        fillOpacity: 0.8,
      };
    } else if (matchesFilters) {
      // Matching filters or no filters: Yellow outline with light yellow fill
      // Initially (no filters), all polygons will be styled in yellow
      return {
        fillColor: '#fff9c4', // Light yellow fill
        weight: 2.5,
        color: '#fdd835', // Yellow outline
        fillOpacity: 0.6,
      };
    } else {
      // Not matching filters: Grey outline with light grey fill
      // Only shown when filters are active and tract doesn't match
      return {
        fillColor: '#f5f5f5', // Light grey fill
        weight: 1,
        color: '#9e9e9e', // Grey outline
        fillOpacity: 0.3,
      };
    }
  };

  const formatPopupContent = (props: any) => {
    const isLoading = loadingTract === props.GEOID;
    const data = hoveredTractData && hoveredTractData.GEOID === props.GEOID 
      ? hoveredTractData 
      : props;

    return `
      <div class="p-2 min-w-[200px]">
        <h3 class="font-semibold text-sm mb-2">${data.NAME || 'Census Tract'}</h3>
        ${data.ntaname ? `<div class="text-xs text-gray-600 mb-2 pb-2 border-b border-gray-200">${data.ntaname}</div>` : ''}
        ${isLoading ? `
          <div class="text-xs text-gray-500">Loading data...</div>
        ` : `
          <div class="text-xs space-y-1">
            ${data.totalPopulation ? `<div>Population: <span class="font-medium">${parseInt(data.totalPopulation).toLocaleString()}</span></div>` : ''}
            ${data.carfree !== undefined ? `<div>Car-Free Households: <span class="font-medium">${parseFloat(data.carfree).toFixed(1)}%</span></div>` : ''}
            ${data.income ? `<div>Median Income: <span class="font-medium">$${parseInt(data.income).toLocaleString()}</span></div>` : ''}
            ${data.transit !== undefined ? `<div>Transit Access Score: <span class="font-medium">${parseFloat(data.transit).toFixed(1)}%</span></div>` : ''}
            ${data.vulnerable !== undefined ? `<div>Vulnerable Residents: <span class="font-medium">${parseFloat(data.vulnerable).toFixed(1)}%</span></div>` : ''}
            ${data.greenspace !== undefined ? `<div>Greenspace: <span class="font-medium">${parseFloat(data.greenspace).toFixed(1)}%</span></div>` : ''}
            ${data.totalHousingUnits ? `<div>Housing Units: <span class="font-medium">${parseInt(data.totalHousingUnits).toLocaleString()}</span></div>` : ''}
          </div>
          <p class="text-xs text-gray-500 mt-2">Click to select this tract</p>
        `}
      </div>
    `;
  };

  // Force style updates when variables or selectedTracts change
  // This ensures all polygons update their colors when filters change
  useEffect(() => {
    if (mapRef.current && displayGeoJsonData) {
      // Small delay to ensure map is ready
      const timer = setTimeout(() => {
        let updatedCount = 0;
        let yellowCount = 0;
        let greyCount = 0;
        let blueCount = 0;
        
        mapRef.current?.eachLayer((layer: any) => {
          // Check if this is a GeoJSON layer (has feature property)
          if (layer.feature) {
            const style = getTractStyle(layer.feature);
            layer.setStyle(style);
            updatedCount++;
            
            // Count by color for debugging
            if (style.color === '#fdd835') yellowCount++;
            else if (style.color === '#9e9e9e') greyCount++;
            else if (style.color === '#1976d2') blueCount++;
          }
        });
        
        console.log(`🎨 Updated ${updatedCount} polygons: ${yellowCount} yellow (match), ${greyCount} grey (no match), ${blueCount} blue (selected)`);
      }, 100);
      
      return () => clearTimeout(timer);
    }
  }, [variables, selectedTracts, displayGeoJsonData]);

  // Handle tract highlighting from external triggers (e.g., ResultsPanel)
  const handleHighlight = useCallback((tractId: string, retryCount = 0) => {
    if (!tractId) {
      console.warn('Invalid tractId');
      return;
    }

    // Wait a bit for map to be ready if it's not yet (max 10 retries)
    if (!mapRef.current && retryCount < 10) {
      setTimeout(() => handleHighlight(tractId, retryCount + 1), 100);
      return;
    }

    if (!mapRef.current) {
      console.warn('Map not initialized after retries');
      return;
    }

    // Try to find the layer - check both exact match and string conversion
    let layer = layerRef.current.get(tractId);
    
    // If not found, try to find by string conversion
    if (!layer) {
      for (const [key, value] of layerRef.current.entries()) {
        if (String(key) === String(tractId)) {
          layer = value;
          break;
        }
      }
    }

    if (!layer) {
      console.warn(`Tract ${tractId} not found on map. Available tracts:`, Array.from(layerRef.current.keys()));
      return;
    }

    // Get the bounds of the feature
    const bounds = (layer as any).getBounds?.();
    if (bounds && mapRef.current) {
      // Zoom to the tract with some padding
      mapRef.current.fitBounds(bounds, { padding: [50, 50] });
    }

    // Flash highlight effect
    const originalStyle = {
      fillColor: (layer as any).options.fillColor || '#fff9c4',
      weight: (layer as any).options.weight || 2.5,
      color: (layer as any).options.color || '#fdd835',
      fillOpacity: (layer as any).options.fillOpacity || 0.6,
    };

    // Highlight with bright orange/red
    (layer as L.Path).setStyle({
      fillColor: '#ff6b6b',
      weight: 4,
      color: '#ff3333',
      fillOpacity: 0.9,
    });

    // Restore original style after 2 seconds
    setTimeout(() => {
      (layer as L.Path).setStyle(originalStyle);
    }, 2000);
  }, []);

  // Set up the window function immediately - don't wait for map to be ready
  useEffect(() => {
    // Store the handler so it can be called from parent
    (window as any).__highlightTract = handleHighlight;
    
    return () => {
      delete (window as any).__highlightTract;
    };
  }, [handleHighlight]);

  const onEachFeature = (feature: any, layer: L.Layer) => {
    const popupContent = formatPopupContent(feature.properties);
    layer.bindPopup(popupContent);
    
    // Store feature reference on layer for style updates
    (layer as any).feature = feature;
    
    // Store layer reference by GEOID for highlighting
    const geoid = feature.properties.GEOID;
    if (geoid) {
      layerRef.current.set(geoid, layer);
    }

    layer.on({
      mouseover: async (e) => {
        await handleTractHover(feature);
        e.target.setStyle({
          weight: 3,
          color: '#ff6b6b',
          fillOpacity: 0.8
        });
        
        // Update popup content with fresh data
        const updatedContent = formatPopupContent(feature.properties);
        layer.setPopupContent(updatedContent);
      },
      mouseout: (e) => {
        const isSelected = selectedTracts.some(tract => {
          const tGeoid = tract.properties?.GEOID || tract.GEOID;
          return tGeoid === feature.properties.GEOID;
        });
        const matchesFilters = isTractMatchingFilters(feature.properties);
        
        // Reset to appropriate style based on state
        if (isSelected) {
          e.target.setStyle({
            fillColor: '#2196f3',
            weight: 3,
            color: '#1976d2',
            fillOpacity: 0.8
          });
        } else if (matchesFilters) {
          e.target.setStyle({
            fillColor: '#fff9c4',
            weight: 2.5,
            color: '#fdd835',
            fillOpacity: 0.6
          });
        } else {
          e.target.setStyle({
            fillColor: '#f5f5f5',
            weight: 1,
            color: '#9e9e9e',
            fillOpacity: 0.3
          });
        }
      },
      click: (e) => {
        // Ensure we're passing the full feature with all properties
        const clickedFeature = {
          ...feature,
          properties: {
            ...feature.properties,
            // Ensure all census data is available
          }
        };
        handleTractClick(clickedFeature);
        
        // Visual feedback on click
        e.target.setStyle({
          weight: 4,
          color: '#2196f3',
          fillOpacity: 0.9
        });
        
        // Reset style after a moment
        setTimeout(() => {
          const isSelected = selectedTracts.some(tract => {
            const tGeoid = tract.properties?.GEOID || tract.GEOID;
            return tGeoid === feature.properties.GEOID;
          });
          const matchesFilters = isTractMatchingFilters(feature.properties);
          
          if (isSelected) {
            // Keep selected style (blue)
            e.target.setStyle({
              fillColor: '#2196f3',
              weight: 3,
              color: '#1976d2',
              fillOpacity: 0.8,
            });
          } else if (matchesFilters) {
            // Yellow outline for matching filters
            e.target.setStyle({
              fillColor: '#fff9c4',
              weight: 2.5,
              color: '#fdd835',
              fillOpacity: 0.6,
            });
          } else {
            // Grey for non-matching
            e.target.setStyle({
              fillColor: '#f5f5f5',
              weight: 1,
              color: '#9e9e9e',
              fillOpacity: 0.3,
            });
          }
        }, 300);
      }
    });
  };

  if (loading) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-muted/10">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading census tract data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="relative w-full h-full flex items-center justify-center bg-muted/10">
        <div className="flex flex-col items-center gap-3 max-w-md text-center p-6">
          <p className="text-sm font-semibold text-destructive">Error loading data</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          <p className="text-xs text-muted-foreground mt-2">
            Note: Census API may require an API key. Check console for details.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full overflow-visible">
      <MapContainer
        center={[40.7128, -74.0060]} // NYC coordinates [lat, lon]
        zoom={10}
        className="h-full w-full"
        ref={mapRef}
        maxBounds={[
          [40.4, -74.3], // Southwest bounds (south, west)
          [41.0, -73.7]  // Northeast bounds (north, east)
        ]}
        maxBoundsViscosity={0.5} // How strictly bounds are enforced (0-1, higher = stricter)
        worldCopyJump={false} // Prevent wrapping around the world
        whenReady={() => {
          if (mapRef.current) {
            setMapBounds(mapRef.current.getBounds());
            setZoomLevel(mapRef.current.getZoom());
          }
        }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          keepBuffer={5} // Preload tiles: number of rows/columns outside viewport to keep loaded (default is 2)
          updateWhenZooming={true} // Update tiles when zooming
          updateWhenIdle={true} // Update tiles when panning stops
          maxZoom={19} // Maximum zoom level
          minZoom={9} // Minimum zoom level
        />
        
        {/* Track map events for viewport-based filtering */}
        <MapEvents 
          onBoundsChange={(bounds) => setMapBounds(bounds)}
          onZoomChange={(zoom) => setZoomLevel(zoom)}
        />
        
        {displayGeoJsonData && displayGeoJsonData.features && displayGeoJsonData.features.length > 0 ? (
          <GeoJSON
            key={`${displayGeoJsonData.features.length}-${JSON.stringify(variables.map(v => v.value))}`} // Re-render when filters change
            data={displayGeoJsonData as any}
            style={(feature) => {
              // Style based on filter match: yellow if matches, grey if not
              return getTractStyle(feature);
            }}
            onEachFeature={onEachFeature}
          />
        ) : (
          // No data at all
          <div className="absolute inset-0 flex items-center justify-center bg-muted/10 z-[500]">
            <div className="text-center p-4">
              <p className="text-sm text-muted-foreground">No census tract data available</p>
              <p className="text-xs text-muted-foreground mt-2">Check console for loading status</p>
            </div>
          </div>
        )}

        {/* Render collision markers as red dots - Optimized */}
        <CollisionMarkers 
          collisions={collisions} 
          mapBounds={mapBounds}
          zoomLevel={zoomLevel}
        />

        {/* Render overlay layers */}
        {overlayTypes.map((overlayType) => (
          <OverlayLayer key={overlayType} overlayType={overlayType} />
        ))}
      </MapContainer>
      
      {/* Custom Map Controls - Right Side */}
      <div className="absolute top-4 right-4 flex flex-col gap-2 z-[1000]">
        <Button
          onClick={handleZoomIn}
          size="icon"
          variant="secondary"
          className="h-10 w-10 bg-card hover:bg-accent/10 border border-border shadow-lg"
        >
          <Plus className="h-5 w-5" />
        </Button>
        <Button
          onClick={handleZoomOut}
          size="icon"
          variant="secondary"
          className="h-10 w-10 bg-card hover:bg-accent/10 border border-border shadow-lg"
        >
          <Minus className="h-5 w-5" />
        </Button>
        <Button
          onClick={handleScreenshot}
          size="icon"
          variant="secondary"
          className="h-10 w-10 bg-card hover:bg-accent/10 border border-border shadow-lg"
        >
          <Camera className="h-5 w-5" />
        </Button>
      </div>
      
      {/* Map Info */}
      <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm p-3 rounded-lg text-xs text-foreground max-w-xs border border-border z-[500]">
        <p className="font-semibold mb-1">🗺️ Interactive Census Map</p>
        <p>Hover over tracts to see data • Click to select</p>
        {collisions.length > 0 && zoomLevel < 11 && (
          <p className="text-blue-600 dark:text-blue-400 mt-1 text-[10px]">
            💡 Zoom in (level 11+) to see collision markers
          </p>
        )}
        {collisions.length > 0 && zoomLevel >= 11 && (
          <p className="text-green-600 dark:text-green-400 mt-1 text-[10px]">
            ✓ Showing collision markers (optimized)
          </p>
        )}
        {!getCensusApiKey() && (
          <p className="text-yellow-600 dark:text-yellow-400 mt-1 text-[10px]">
            ⚠️ API key not set - using mock data
          </p>
        )}
      </div>
    </div>
  );
};

export default MapView;
