import { useState, useRef } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, Popup, useMapEvents } from 'react-leaflet';
import { Plus, Minus, Camera } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
    name: string;
    value: [number, number];
  }[];
  selectedTracts: any[];
  onTractSelect: (tract: any) => void;
  onTractHover: (tract: any) => void;
}

// Mock census tract data for NYC
const mockCensusTracts = [
  {
    type: "Feature",
    properties: {
      GEOID: "36061000100",
      NAME: "Manhattan - Tract 1",
      crashes: 45,
      carfree: 65,
      vulnerable: 28,
      income: 85000,
      transit: 95
    },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [-74.0059, 40.7128],
        [-74.0059, 40.7228],
        [-73.9959, 40.7228],
        [-73.9959, 40.7128],
        [-74.0059, 40.7128]
      ]]
    }
  },
  {
    type: "Feature",
    properties: {
      GEOID: "36061000200",
      NAME: "Brooklyn - Tract 2",
      crashes: 78,
      carfree: 42,
      vulnerable: 35,
      income: 62000,
      transit: 78
    },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [-73.9859, 40.6928],
        [-73.9859, 40.7028],
        [-73.9759, 40.7028],
        [-73.9759, 40.6928],
        [-73.9859, 40.6928]
      ]]
    }
  },
  {
    type: "Feature",
    properties: {
      GEOID: "36061000300",
      NAME: "Queens - Tract 3",
      crashes: 52,
      carfree: 38,
      vulnerable: 31,
      income: 58000,
      transit: 65
    },
    geometry: {
      type: "Polygon",
      coordinates: [[
        [-73.9659, 40.6728],
        [-73.9659, 40.6828],
        [-73.9559, 40.6828],
        [-73.9559, 40.6728],
        [-73.9659, 40.6728]
      ]]
    }
  }
];

const MapView = ({ variables, selectedTracts, onTractSelect, onTractHover }: MapViewProps) => {
  const mapRef = useRef<L.Map>(null);

  const handleTractClick = (tract: any) => {
    onTractSelect(tract);
  };

  const handleTractHover = (tract: any) => {
    onTractHover(tract);
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

  const getTractStyle = (feature: any) => {
    const isSelected = selectedTracts.some(tract => tract.properties.GEOID === feature.properties.GEOID);
    return {
      fillColor: isSelected ? '#2196f3' : '#e3e3e3',
      weight: 2,
      color: isSelected ? '#1976d2' : '#111',
      fillOpacity: isSelected ? 0.7 : 0.4,
    };
  };

  const onEachFeature = (feature: any, layer: L.Layer) => {
    layer.on({
      mouseover: (e) => {
        handleTractHover(feature);
        e.target.setStyle({
          weight: 3,
          color: '#ff6b6b',
          fillOpacity: 0.8
        });
      },
      mouseout: (e) => {
        const isSelected = selectedTracts.some(tract => tract.properties.GEOID === feature.properties.GEOID);
        e.target.setStyle({
          weight: isSelected ? 2 : 1,
          color: isSelected ? '#1976d2' : '#111',
          fillOpacity: isSelected ? 0.7 : 0.4
        });
      },
      click: () => {
        handleTractClick(feature);
      }
    });

    // Add popup on hover
    layer.bindPopup(`
      <div class="p-2">
        <h3 class="font-semibold text-sm">${feature.properties.NAME}</h3>
        <div class="text-xs space-y-1 mt-2">
          <div>Annual Crashes: <span class="font-medium">${feature.properties.crashes}</span></div>
          <div>Car-Free: <span class="font-medium">${feature.properties.carfree}%</span></div>
          <div>Vulnerable: <span class="font-medium">${feature.properties.vulnerable}%</span></div>
          <div>Income: <span class="font-medium">$${feature.properties.income.toLocaleString()}</span></div>
          <div>Transit Score: <span class="font-medium">${feature.properties.transit}</span></div>
        </div>
        <p class="text-xs text-gray-500 mt-2">Click to select this tract</p>
      </div>
    `);
  };

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={[40.7128, -74.0060]} // NYC coordinates
        zoom={10}
        className="h-full w-full"
        ref={mapRef}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        <GeoJSON
          data={mockCensusTracts as any}
          style={getTractStyle}
          onEachFeature={onEachFeature}
        />
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
      <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur-sm p-3 rounded-lg text-xs text-foreground max-w-xs border border-border">
        <p className="font-semibold mb-1">🗺️ Interactive Census Map</p>
        <p>Hover over tracts to see data • Click to select • No API key required!</p>
      </div>
    </div>
  );
};

export default MapView;
