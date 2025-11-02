import { buildCensusApiUrl, CENSUS_CONFIG, getAllVariableCodes } from '@/config/censusConfig';

/**
 * Census API Response Types
 */
export interface CensusApiResponse {
  [key: string]: string | number;
}

export interface TractData {
  GEOID: string;
  NAME: string;
  state: string;
  county: string;
  tract: string;
  [variableCode: string]: string | number;
}

export interface ParsedTractData {
  GEOID: string;
  NAME: string;
  [key: string]: string | number;
}

/**
 * Cache interface for storing API responses
 */
interface CacheEntry {
  data: ParsedTractData[];
  timestamp: number;
  expiry: number; // Cache expiry time in milliseconds (default: 1 hour)
}

class CensusApiCache {
  private cache: Map<string, CacheEntry> = new Map();
  private defaultExpiry = 60 * 60 * 1000; // 1 hour in milliseconds

  get(key: string): ParsedTractData[] | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.timestamp + entry.expiry) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(key: string, data: ParsedTractData[], expiry?: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      expiry: expiry || this.defaultExpiry,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    return this.cache.has(key) && Date.now() <= (this.cache.get(key)!.timestamp + this.cache.get(key)!.expiry);
  }
}

const apiCache = new CensusApiCache();

/**
 * Parse CSV response from Census API into structured data
 */
function parseCensusResponse(csvData: string[][]): ParsedTractData[] {
  if (!csvData || csvData.length < 2) {
    return [];
  }

  const headers = csvData[0] as string[];
  const rows = csvData.slice(1);

  return rows.map((row) => {
    const tract: any = {};
    headers.forEach((header, index) => {
      const value = row[index];
      // Keep geographic codes as strings, convert numeric data to numbers
      if (header === 'state' || header === 'county' || header === 'tract') {
        tract[header] = String(value || '');
      } else {
        tract[header] = isNaN(Number(value)) || value === '' ? value : Number(value);
      }
    });

    // Create GEOID from state + county + tract (ensure they're strings)
    if (tract.state && tract.county !== undefined && tract.tract !== undefined) {
      const stateStr = String(tract.state);
      const countyStr = String(tract.county || '').padStart(3, '0');
      const tractStr = String(tract.tract || '').padStart(6, '0');
      tract.GEOID = `${stateStr}${countyStr}${tractStr}`;
    }

    // Create NAME if not present
    if (!tract.NAME && tract.GEOID && tract.tract) {
      tract.NAME = `Tract ${String(tract.tract)}`;
    }

    return tract as ParsedTractData;
  });
}

/**
 * Fetch census data for NYC tracts
 */
export async function fetchNYCTractsData(
  year: string = CENSUS_CONFIG.DEFAULT_YEAR,
  apiKey?: string
): Promise<ParsedTractData[]> {
  const cacheKey = `nyc-tracts-${year}`;
  
  // Check cache first
  const cached = apiCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    // Fetch data for all NYC counties
    const allTracts: ParsedTractData[] = [];
    const countyCodes = Object.values(CENSUS_CONFIG.NYC_COUNTIES);

    for (const countyCode of countyCodes) {
      const url = buildCensusApiUrl(year, getAllVariableCodes(), CENSUS_CONFIG.STATE_FIPS, countyCode, undefined, apiKey);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn(`Failed to fetch data for county ${countyCode}:`, response.statusText);
        continue;
      }

      const data: string[][] = await response.json();
      const parsed = parseCensusResponse(data);
      allTracts.push(...parsed);
    }

    // Cache the results
    apiCache.set(cacheKey, allTracts);

    return allTracts;
  } catch (error) {
    console.error('Error fetching NYC tracts data:', error);
    throw error;
  }
}

/**
 * Fetch data for a specific tract
 */
export async function fetchTractData(
  geoid: string,
  year: string = CENSUS_CONFIG.DEFAULT_YEAR,
  apiKey?: string
): Promise<ParsedTractData | null> {
  const cacheKey = `tract-${geoid}-${year}`;
  
  // Check cache
  const cached = apiCache.get(cacheKey);
  if (cached && cached.length > 0) {
    return cached[0];
  }

  try {
    // Parse GEOID: SSCCCCTTTTTT (SS=state, CCC=county, TTTTTT=tract)
    const state = geoid.substring(0, 2);
    const county = geoid.substring(2, 5);
    // Remove leading zeros from tract for API call
    const tract = String(parseInt(geoid.substring(5, 11), 10));

    const url = buildCensusApiUrl(year, getAllVariableCodes(), state, county, tract, apiKey);
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.warn(`Failed to fetch data for tract ${geoid}:`, response.statusText);
      return null;
    }

    const data: string[][] = await response.json();
    const parsed = parseCensusResponse(data);

    if (parsed.length > 0) {
      // Cache the result
      apiCache.set(cacheKey, parsed, 30 * 60 * 1000); // 30 minutes for individual tracts
      return parsed[0];
    }

    return null;
  } catch (error) {
    console.error(`Error fetching tract ${geoid} data:`, error);
    return null;
  }
}

/**
 * Transform raw census data into display-friendly format
 */
export function transformTractData(rawData: ParsedTractData): any {
  const transformed: any = {
    GEOID: rawData.GEOID,
    NAME: rawData.NAME || `Tract ${rawData.tract}`,
    state: rawData.state,
    county: rawData.county,
    tract: rawData.tract,
  };

  // Helper function to check if a value is a Census Bureau sentinel value
  // Census API uses -666666666 and -999999999 to indicate missing/suppressed data
  const isValidCensusValue = (value: any): boolean => {
    if (value === null || value === undefined || value === '') return false;
    const numValue = typeof value === 'string' ? parseFloat(value) : Number(value);
    if (isNaN(numValue)) return false;
    // Check for Census Bureau sentinel values (negative values with many 6s or 9s)
    if (numValue < 0 && (numValue <= -666666666 || numValue <= -999999999)) return false;
    return true;
  };

  // Add raw variables (filter out Census Bureau sentinel values)
  Object.keys(CENSUS_CONFIG.VARIABLES).forEach((key) => {
    const varCode = CENSUS_CONFIG.VARIABLES[key as keyof typeof CENSUS_CONFIG.VARIABLES];
    if (rawData[varCode] !== undefined && isValidCensusValue(rawData[varCode])) {
      transformed[key] = rawData[varCode];
    } else {
      // Set to undefined for missing/invalid values
      transformed[key] = undefined;
    }
  });

  // Calculate derived metrics
  Object.keys(CENSUS_CONFIG.DERIVED_METRICS).forEach((key) => {
    const metric = CENSUS_CONFIG.DERIVED_METRICS[key as keyof typeof CENSUS_CONFIG.DERIVED_METRICS];
    try {
      transformed[key] = metric.formula(transformed);
    } catch (error) {
      console.warn(`Error calculating ${key}:`, error);
      transformed[key] = '0';
    }
  });

  // Format specific values for display
  // Filter out Census Bureau sentinel values (-666666666, -999999999, etc.)
  if (transformed.medianHouseholdIncome && isValidCensusValue(transformed.medianHouseholdIncome)) {
    transformed.income = parseInt(String(transformed.medianHouseholdIncome));
  } else {
    transformed.income = undefined; // Set to undefined so it displays as "N/A"
  }

  if (transformed.carFreePercent && isValidCensusValue(transformed.carFreePercent)) {
    transformed.carfree = parseFloat(String(transformed.carFreePercent));
  } else {
    transformed.carfree = undefined;
  }

  if (transformed.transitScore && isValidCensusValue(transformed.transitScore)) {
    transformed.transit = parseInt(String(transformed.transitScore));
  } else {
    transformed.transit = undefined;
  }

  if (transformed.vulnerablePercent && isValidCensusValue(transformed.vulnerablePercent)) {
    transformed.vulnerable = parseFloat(String(transformed.vulnerablePercent));
  } else {
    transformed.vulnerable = undefined;
  }

  // Note: Crashes data would need to come from a separate external API
  // For now, we'll use a placeholder or mock value
  transformed.crashes = 0; // This would be populated from a crash data API

  return transformed;
}

/**
 * Get API key from environment or user input
 */
export function getCensusApiKey(): string | undefined {
  // Check environment variable first (Vite uses import.meta.env)
  const envKey = import.meta.env.VITE_CENSUS_API_KEY;
  if (envKey) {
    return String(envKey);
  }

  // Could also check localStorage or user settings
  const storedKey = localStorage.getItem('census_api_key');
  if (storedKey) {
    return storedKey;
  }

  return undefined;
}

