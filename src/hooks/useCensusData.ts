import { useState, useEffect, useCallback } from 'react';
import {
  fetchNYCTractsData,
  fetchTractData,
  transformTractData,
  ParsedTractData,
  getCensusApiKey,
} from '@/services/censusApi';
import { CENSUS_CONFIG } from '@/config/censusConfig';
import { generateMockGeoJSON, fetchNYCTractsGeoJSON } from '@/services/geojsonService';
import type { GeoJSONData } from '@/services/geojsonService';

export interface TractDataWithMetrics {
  GEOID: string;
  NAME: string;
  [key: string]: any;
}

interface UseCensusDataReturn {
  tractsData: TractDataWithMetrics[];
  geoJsonData: GeoJSONData | null;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  getTractData: (geoid: string) => Promise<TractDataWithMetrics | null>;
}

export function useCensusData(): UseCensusDataReturn {
  const [tractsData, setTractsData] = useState<TractDataWithMetrics[]>([]);
  const [geoJsonData, setGeoJsonData] = useState<GeoJSONData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const apiKey = getCensusApiKey();
      
      // Fetch census data for all NYC tracts (uses DEFAULT_YEAR from config)
      const rawData = await fetchNYCTractsData(CENSUS_CONFIG.DEFAULT_YEAR, apiKey);
      
      // Transform the data
      const transformed = rawData.map(transformTractData);
      setTractsData(transformed);

      // Try to fetch real GeoJSON boundaries first
      let geoJson = await fetchNYCTractsGeoJSON();
      
      // If real GeoJSON is not available, merge census data with mock GeoJSON
      if (!geoJson || !geoJson.features || geoJson.features.length === 0) {
        console.log('Using mock GeoJSON boundaries');
        geoJson = generateMockGeoJSON(transformed);
      } else {
        // Merge real GeoJSON boundaries with census data
        console.log('Merging real GeoJSON boundaries with census data');
        geoJson.features = geoJson.features.map((feature) => {
          const geoid = feature.properties.GEOID;
          const matchingData = transformed.find(t => t.GEOID === geoid);
          
          if (matchingData) {
            // Merge census data into GeoJSON properties
            feature.properties = {
              ...feature.properties,
              ...matchingData,
            };
          }
          
          return feature;
        });
      }
      
      setGeoJsonData(geoJson);
    } catch (err) {
      console.error('Error loading census data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load census data');
      
      // Fallback to empty state or mock data
      setTractsData([]);
      setGeoJsonData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const getTractData = useCallback(async (geoid: string): Promise<TractDataWithMetrics | null> => {
    try {
      const apiKey = getCensusApiKey();
      const rawData = await fetchTractData(geoid, CENSUS_CONFIG.DEFAULT_YEAR, apiKey);
      
      if (!rawData) {
        return null;
      }

      return transformTractData(rawData);
    } catch (err) {
      console.error(`Error fetching tract ${geoid}:`, err);
      return null;
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return {
    tractsData,
    geoJsonData,
    loading,
    error,
    refreshData: loadData,
    getTractData,
  };
}

