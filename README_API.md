# US Census Bureau API Integration Guide

## Overview
This application integrates with the US Census Bureau Data API to fetch ACS 5-Year estimates for New York City census tracts.

## API Setup

### Getting an API Key
1. Visit https://api.census.gov/data/key_signup.html
2. Sign up for a free API key
3. Add your API key to one of the following:

**Option 1: Environment Variable (Recommended for Production)**
Create a `.env` file in the project root:
```
VITE_CENSUS_API_KEY=your_api_key_here
```

**Option 2: LocalStorage (For Development)**
The application will also check `localStorage.getItem('census_api_key')` if the environment variable is not set.

### API Endpoints Used

The application uses the following Census API endpoint structure:
```
https://api.census.gov/data/{year}/acs/acs5?get={variables}&for=tract:*&in=state:36&key={API_KEY}
```

Where:
- `{year}`: Default is 2022 (most recent ACS 5-year estimates)
- `{variables}`: Comma-separated list of variable codes
- `state:36`: New York State FIPS code
- `{API_KEY}`: Your Census API key (optional but recommended)

### Variable Codes

All variable codes are configured in `src/config/censusConfig.ts`. Key variables include:

- **Population**: `B01001_001E` (Total Population)
- **Car Ownership**: 
  - `B25044_003E` (No-car households, owner-occupied)
  - `B25044_010E` (No-car households, renter-occupied)
- **Income**: `B19013_001E` (Median Household Income)
- **Transportation**: `B08301_010E` (Public Transit Commuters)
- **Vulnerable Populations**: Various age and disability variables

### Caching

The application implements a caching system to minimize API calls:
- **Tract-level data**: Cached for 30 minutes
- **Bulk NYC data**: Cached for 1 hour
- Cache is stored in memory and cleared on page refresh

## Data Flow

1. **Initial Load**: 
   - `useCensusData` hook fetches all NYC tract data on mount
   - Data is transformed and cached
   - GeoJSON is generated (or loaded from external source)

2. **Hover Interaction**:
   - When user hovers over a tract, detailed data is fetched if not already cached
   - Popup displays key metrics

3. **Click/Select**:
   - Selected tract data is added to the results panel
   - Full metrics are displayed in the comparison table

## GeoJSON Data

The application currently generates mock GeoJSON for development. In production:

1. **Option 1**: Fetch from Census TIGER/Line Shapefiles API
2. **Option 2**: Use pre-processed GeoJSON from a CDN or static hosting
3. **Option 3**: Load from a local GeoJSON file

Update `src/services/geojsonService.ts` to use your preferred method.

## Rate Limits

The Census API has rate limits:
- **Anonymous requests**: 500 requests per day
- **With API key**: Higher limits (check Census Bureau documentation)

The caching system helps stay within these limits.

## Troubleshooting

### No Data Loading
- Check browser console for API errors
- Verify API key is set correctly
- Ensure CORS is not blocking requests (Census API supports CORS)

### Incomplete Data
- Some tracts may not have data for all variables
- The application handles missing data gracefully with "N/A" values

### GeoJSON Issues
- If tracts don't appear on map, check GeoJSON service
- Verify coordinate system matches Leaflet's expectations (WGS84)

## Future Enhancements

- [ ] Add support for other geographies (counties, states)
- [ ] Implement year selector for historical data
- [ ] Add data export functionality
- [ ] Integrate crash data from external APIs
- [ ] Add filtering by variable ranges

