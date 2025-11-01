# Polygon Mapping Logic Explanation

## Overview
This document explains how census tract polygons are fetched, processed, and displayed on the map in this application.

## Step-by-Step Process

### 1. **Data Fetching Phase** (`useCensusData` hook)

The application fetches two types of data:

#### A. Census Statistics Data (from US Census Bureau API)
- **Location**: `src/services/censusApi.ts`
- **Endpoint**: `https://api.census.gov/data/{year}/acs/acs5`
- **What it fetches**: Statistical data for each tract (income, car-free %, transit %, vulnerable %, etc.)
- **Format**: CSV-like JSON array
- **Example response**:
```json
[
  ["GEOID", "B19013_001E", "B25044_003E", ...],
  ["36061000100", "85000", "1250", ...],
  ["36061000200", "62000", "890", ...]
]
```

#### B. Geographic Boundaries (GeoJSON)
- **Primary Source**: Census TIGERweb REST API
- **URL**: `https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/tracts/query`
- **What it fetches**: Polygon coordinates defining tract boundaries
- **Format**: GeoJSON FeatureCollection
- **Example structure**:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": { "GEOID": "36061000100", "NAME": "Tract 1" },
      "geometry": {
        "type": "Polygon",
        "coordinates": [[[-74.005, 40.712], [-74.004, 40.712], ...]]
      }
    }
  ]
}
```

### 2. **Data Merging Phase** (`useCensusData.ts`)

After fetching both datasets separately, they are merged together:

```javascript
// 1. Fetch census statistics
const rawData = await fetchNYCTractsData('2022', apiKey);
const transformed = rawData.map(transformTractData);

// 2. Fetch geographic boundaries
let geoJson = await fetchNYCTractsGeoJSON();

// 3. Merge: Match by GEOID (unique tract identifier)
geoJson.features = geoJson.features.map((feature) => {
  const geoid = feature.properties.GEOID;
  const matchingData = transformed.find(t => t.GEOID === geoid);
  
  if (matchingData) {
    // Combine: geometry from GeoJSON + stats from Census API
    feature.properties = {
      ...feature.properties,  // GEOID, NAME, county, etc.
      ...matchingData          // income, carfree, transit, vulnerable, etc.
    };
  }
  return feature;
});
```

**Key Point**: GEOID is the unique identifier that links:
- Geographic polygons (boundaries)
- Census statistics (data)

**GEOID Format**: `SSCCCTTTTTT` (11 digits)
- SS = State (36 = New York)
- CCC = County (005, 047, 061, 081, 085 = NYC boroughs)
- TTTTTT = Tract (6 digits)

### 3. **Coordinate Processing** (`geojsonService.ts`)

#### A. Coordinate Validation
- **Issue**: GeoJSON uses `[longitude, latitude]`, but sometimes data has them swapped
- **Solution**: `validateAndFixGeometry()` function checks and fixes:
  - Detects if coordinates are swapped (lat/lon reversed)
  - Clamps coordinates to NYC bounds (lon: -74.5 to -73.5, lat: 40.4 to 41.0)
  - Validates polygon rings are closed properly

#### B. Water Tract Filtering
- **Issue**: Census includes water-only tracts (oceans, rivers) that aren't useful
- **Detection**:
  - Tract codes ending in `.00`, `.01`, `.98`, `.99` (water tract pattern)
  - Very small polygon areas (< 0.00001 square degrees)
  - Names containing "water", "marine", "ocean"
- **Action**: These tracts are filtered out

### 4. **GEOID Normalization**

Before merging, GEOIDs are normalized:
- Ensure exactly 11 digits
- Pad with zeros if needed
- Format: `36` + `005` + `000100` = `36005000100`

### 5. **Map Rendering** (`MapView.tsx`)

#### A. Display All Polygons
All polygons are displayed (not filtered out), but styled differently:

```javascript
const displayGeoJsonData = useMemo(() => {
  // Show ALL features, don't filter them out
  return geoJsonData;  // All ~2200 NYC tracts
}, [geoJsonData]);
```

#### B. Styling Based on Filters

Each polygon's style is determined by:

1. **Selected Status** (Blue - highest priority)
   - If user clicked this tract → Blue (#1976d2)

2. **Filter Match** (Yellow)
   - If tract matches ALL active filters → Yellow (#fdd835)
   - Checks: carfree, income, transit, vulnerable all in range

3. **Default** (Grey)
   - If tract doesn't match filters → Grey (#9e9e9e)

```javascript
const getTractStyle = (feature) => {
  const isSelected = /* check if in selectedTracts */;
  const matchesFilters = isTractMatchingFilters(feature.properties);
  
  if (isSelected) return { /* blue */ };
  else if (matchesFilters) return { /* yellow */ };
  else return { /* grey */ };
};
```

### 6. **Filter Matching Logic** (AND Logic)

A tract matches filters only if **ALL** conditions are true:

```javascript
const isTractMatchingFilters = (tractData) => {
  return variables.every((variable) => {
    // For EACH variable slider:
    // 1. Get tract's value for this metric
    // 2. Check if it's between slider min and max
    // 3. Return true only if within range
    
    const tractValue = /* get value from tractData */;
    const [min, max] = variable.value;  // Slider range
    
    return tractValue >= min && tractValue <= max;
  });
  // Returns true ONLY if ALL variables pass
};
```

**Example**:
- Car-Free slider: [20, 50]%
- Income slider: [$30,000, $70,000]
- Transit slider: [30, 80]%

Tract matches **only if**:
- Car-Free % is 20-50% **AND**
- Income is $30k-$70k **AND**
- Transit % is 30-80% **AND**
- Vulnerable % matches its slider range

### 7. **Real-Time Updates**

When slider values change:
1. `useEffect` hook triggers
2. All polygon styles are recalculated
3. Leaflet map layers are updated
4. Colors change instantly (grey ↔ yellow)

## Data Flow Diagram

```
┌─────────────────────────────────────┐
│  1. useCensusData Hook             │
│  ─────────────────────────────────  │
│  ├─ Fetch Census Stats (API)       │
│  │  └─> Raw CSV data               │
│  │      └─> Transform              │
│  │          └─> {GEOID, income,    │
│  │               carfree, ...}     │
│  │                                  │
│  └─ Fetch GeoJSON Boundaries        │
│     └─> TIGERweb API                │
│         └─> {GEOID, geometry, ...}  │
└─────────────────────────────────────┘
           │
           │ Merge by GEOID
           ▼
┌─────────────────────────────────────┐
│  2. Merged GeoJSON                 │
│  ─────────────────────────────────  │
│  Features: [                        │
│    {                                │
│      GEOID: "36061000100",         │
│      geometry: {coordinates: [...]},│
│      properties: {                  │
│        income: 85000,              │
│        carfree: 65.2,              │
│        transit: 85.1,              │
│        vulnerable: 28.5            │
│      }                              │
│    }, ...                           │
│  ]                                  │
└─────────────────────────────────────┘
           │
           │ Pass to MapView
           ▼
┌─────────────────────────────────────┐
│  3. MapView Component               │
│  ─────────────────────────────────  │
│  ├─ Display ALL polygons            │
│  ├─ Style each based on:            │
│  │  ├─ Selected? → Blue            │
│  │  ├─ Matches filters? → Yellow   │
│  │  └─ Otherwise → Grey            │
│  └─ Update on slider change         │
└─────────────────────────────────────┘
           │
           │ Render
           ▼
┌─────────────────────────────────────┐
│  4. Leaflet Map                     │
│  ─────────────────────────────────  │
│  GeoJSON Layer:                     │
│  ├─ Polygon 1 (Yellow) - matches   │
│  ├─ Polygon 2 (Grey) - no match    │
│  ├─ Polygon 3 (Yellow) - matches   │
│  └─ Polygon 4 (Blue) - selected    │
└─────────────────────────────────────┘
```

## Key Concepts

### GEOID (Geographic Identifier)
- **Purpose**: Unique ID linking geography to statistics
- **Format**: 11-digit string
- **Example**: `36061000100` = Manhattan (061), Tract 000100

### Coordinate System
- **GeoJSON Standard**: `[longitude, latitude]`
- **NYC Range**: 
  - Longitude: -74.5 to -73.5 (West to East)
  - Latitude: 40.4 to 41.0 (South to North)
- **Leaflet**: Automatically converts to `[lat, lon]` for rendering

### Filter Matching (AND Logic)
- All filters must be satisfied simultaneously
- No partial matches
- Missing data = excluded (strict filtering)

## Why Two Separate API Calls?

1. **Census Data API**: Returns statistics but NOT geometry
2. **TIGERweb API**: Returns geometry but NOT statistics
3. **Solution**: Fetch both, merge by GEOID

This separation is standard practice because:
- Geographic boundaries change rarely (decennial census)
- Statistics change annually (ACS estimates)
- Allows for flexible data updates

