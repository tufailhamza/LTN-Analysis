import { useState, useRef, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON } from 'react-leaflet';
import { Plus, Minus, Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCensusData } from '@/hooks/useCensusData';
import { fetchTractData, transformTractData, getCensusApiKey } from '@/services/censusApi';
import { CENSUS_CONFIG } from '@/config/censusConfig';
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
}

const MapView = ({ variables, selectedTracts, onTractSelect, onTractHover }: MapViewProps) => {
  const mapRef = useRef<L.Map>(null);
  const { geoJsonData, loading, error } = useCensusData();
  const [hoveredTractData, setHoveredTractData] = useState<any>(null);
  const [loadingTract, setLoadingTract] = useState<string | null>(null);

  // Filter tracts based on variable sliders - MUST be defined before useMemo
  // Uses AND logic: tract matches if it satisfies ALL filter criteria simultaneously
  const isTractMatchingFilters = (tractData: any): boolean => {
    if (!tractData) {
      // Don't show tracts without data - strict filtering
      return false;
    }
    
    // If no variables defined, show all
    if (variables.length === 0) {
      return true;
    }
    
    // Check if tract matches ALL variable filters (AND logic)
    // Tract must match ALL active filters to be shown
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
        default:
          return true; // Unknown variable, don't filter
      }
      
      // If value is missing, show it only if this variable's filter is at "show all" range
      if (tractValue === undefined || isNaN(tractValue)) {
        // Don't show tracts with missing data - strict filtering
        return false;
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
          setHoveredTractData(transformed);
          
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
  const getTractStyle = (feature: any) => {
    const isSelected = selectedTracts.some(tract => {
      const tGeoid = tract.properties?.GEOID || tract.GEOID;
      return tGeoid === feature.properties.GEOID;
    });
    
    // Check if tract matches current filters
    const matchesFilters = isTractMatchingFilters(feature.properties);
    
    // Style based on selection and filter match
    if (isSelected) {
      // Selected tracts: Blue fill with blue border (highest priority)
      return {
        fillColor: '#2196f3',
        weight: 3,
        color: '#1976d2',
        fillOpacity: 0.8,
      };
    } else if (matchesFilters) {
      // Matching filters: Yellow outline with light yellow fill
      return {
        fillColor: '#fff9c4', // Light yellow fill
        weight: 2.5,
        color: '#fdd835', // Yellow outline
        fillOpacity: 0.6,
      };
    } else {
      // Not matching filters: Grey outline with light grey fill
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
        ${isLoading ? `
          <div class="text-xs text-gray-500">Loading data...</div>
        ` : `
          <div class="text-xs space-y-1">
            ${data.totalPopulation ? `<div>Population: <span class="font-medium">${parseInt(data.totalPopulation).toLocaleString()}</span></div>` : ''}
            ${data.carfree !== undefined ? `<div>Car-Free Households: <span class="font-medium">${parseFloat(data.carfree).toFixed(1)}%</span></div>` : ''}
            ${data.income ? `<div>Median Income: <span class="font-medium">$${parseInt(data.income).toLocaleString()}</span></div>` : ''}
            ${data.transit !== undefined ? `<div>Transit Access Score: <span class="font-medium">${parseFloat(data.transit).toFixed(1)}%</span></div>` : ''}
            ${data.vulnerable !== undefined ? `<div>Vulnerable Residents: <span class="font-medium">${parseFloat(data.vulnerable).toFixed(1)}%</span></div>` : ''}
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

  const onEachFeature = (feature: any, layer: L.Layer) => {
    const popupContent = formatPopupContent(feature.properties);
    layer.bindPopup(popupContent);
    
    // Store feature reference on layer for style updates
    (layer as any).feature = feature;

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
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
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
