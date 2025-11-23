import { useState, useEffect } from 'react';

export interface OverlayGeoJSON {
  type: 'FeatureCollection';
  features: any[];
}

export function useOverlayData(overlayType: string) {
  const [overlayData, setOverlayData] = useState<OverlayGeoJSON | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!overlayType || overlayType === 'none') {
      setOverlayData(null);
      setError(null);
      return;
    }

    const loadOverlay = async () => {
      setLoading(true);
      setError(null);

      try {
        let url: string;
        let filterFn: ((feature: any) => boolean) | null = null;

        switch (overlayType) {
          case 'bikeLanes':
            url = '/New_York_City_Bike_Routes_20251123.geojson';
            // Filter for current bike lanes only
            filterFn = (feature: any) => {
              return feature.properties?.status === 'Current';
            };
            break;
          case 'parkSpace':
            url = '/Parks_Properties_20251123.geojson';
            // Filter for DPR Parks
            filterFn = (feature: any) => {
              return (
                feature.properties?.jurisdiction === 'DPR' &&
                feature.properties?.class === 'PARK'
              );
            };
            break;
          case 'greenstreets':
            url = '/Parks_Properties_20251123.geojson';
            // Filter for DPR Greenstreets (gardens, greenstreets, etc.)
            filterFn = (feature: any) => {
              const props = feature.properties;
              return (
                props?.jurisdiction === 'DPR' &&
                (props?.typecategory === 'Garden' ||
                  props?.subcategory?.toLowerCase().includes('greenstreet') ||
                  props?.name311?.toLowerCase().includes('greenstreet'))
              );
            };
            break;
          case 'mtaBusLanes':
            // Note: Using bike routes file as specified, but may need separate bus lanes file
            url = '/New_York_City_Bike_Routes_20251123.geojson';
            // Since bus lanes aren't in bike routes, we'll show all current routes
            // In production, this should use a separate bus lanes GeoJSON file
            filterFn = (feature: any) => {
              return feature.properties?.status === 'Current';
            };
            break;
          default:
            setOverlayData(null);
            setLoading(false);
            return;
        }

        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to load overlay: ${response.statusText}`);
        }

        const data: OverlayGeoJSON = await response.json();

        // Apply filter if provided
        if (filterFn && data.features) {
          data.features = data.features.filter(filterFn);
        }

        setOverlayData(data);
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to load overlay data';
        setError(errorMessage);
        console.error('Error loading overlay:', err);
        setOverlayData(null);
      } finally {
        setLoading(false);
      }
    };

    loadOverlay();
  }, [overlayType]);

  return {
    overlayData,
    loading,
    error,
  };
}

