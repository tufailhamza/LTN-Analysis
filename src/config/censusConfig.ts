/**
 * US Census Bureau API Configuration
 * ACS 5-Year Estimates Variable Codes
 * 
 * Documentation: https://www.census.gov/data/developers/data-sets/acs-5year.html
 */

export const CENSUS_CONFIG = {
  // Base API URL
  BASE_URL: 'https://api.census.gov/data',
  
  // Default year for ACS 5-year estimates
  // ACS 5-year estimates aggregate data from the past 5 years
  // 2023 ACS 5-year = data from 2019-2023 (last 5 years)
  DEFAULT_YEAR: '2023', // Most recent available - covers last 5 years (2019-2023)
  
  // New York State FIPS code
  STATE_FIPS: '36',
  
  // NYC County FIPS codes (5 boroughs)
  NYC_COUNTIES: {
    'New York County (Manhattan)': '061',
    'Kings County (Brooklyn)': '047',
    'Queens County': '081',
    'Bronx County': '005',
    'Richmond County (Staten Island)': '085',
  },
  
  // Variable codes mapping
  VARIABLES: {
    // Population
    totalPopulation: 'B01001_001E',
    
    // Housing - Car Ownership
    // B25044_001E = Total (all households in tenure-by-vehicles table)
    // B25044_003E = Owner-occupied: No vehicle available
    // B25044_010E = Renter-occupied: No vehicle available
    totalHousingUnits: 'B25044_001E',
    noCarHouseholds: 'B25044_003E', // Owner-occupied: No vehicle available
    noCarHouseholdsRenter: 'B25044_010E', // Renter-occupied: No vehicle available
    
    // Income
    // B19013_001E = Median household income in the past 12 months
    medianHouseholdIncome: 'B19013_001E',
    
    // Commuting - Public Transportation
    publicTransitCommuters: 'B08301_010E',
    totalCommuters: 'B08301_001E',
    
    // Vulnerable Populations
    populationUnder18: 'B01001_003E', // Male under 18
    populationUnder18Female: 'B01001_027E', // Female under 18
    population65Plus: 'B01001_020E', // Male 65+
    population65PlusFemale: 'B01001_044E', // Female 65+
    disabledPopulation: 'B18101_004E', // With a disability
    
    // Vehicle Crashes (Note: This data is not directly available from Census)
    // Would need to be combined with external crash data
    
    // Education
    highSchoolGraduate: 'B15003_017E',
    bachelorsDegree: 'B15003_022E',
    
    // Housing Characteristics
    ownerOccupied: 'B25003_002E',
    renterOccupied: 'B25003_003E',
  },
  
  // Friendly names for display
  VARIABLE_NAMES: {
    totalPopulation: 'Total Population',
    totalHousingUnits: 'Total Housing Units',
    noCarHouseholds: 'Car-Free Households (Owner)',
    noCarHouseholdsRenter: 'Car-Free Households (Renter)',
    medianHouseholdIncome: 'Median Household Income',
    publicTransitCommuters: 'Public Transit Commuters',
    totalCommuters: 'Total Commuters',
    populationUnder18: 'Population Under 18',
    population65Plus: 'Population 65+',
    disabledPopulation: 'Population with Disabilities',
    ownerOccupied: 'Owner-Occupied Units',
    renterOccupied: 'Renter-Occupied Units',
  },
  
  // Derived metrics (calculated from raw variables)
  DERIVED_METRICS: {
    carFreePercent: {
      formula: (data: any) => {
        const noCar = (parseInt(data.noCarHouseholds || '0') + parseInt(data.noCarHouseholdsRenter || '0'));
        const total = parseInt(data.totalHousingUnits || '1');
        return total > 0 ? ((noCar / total) * 100).toFixed(1) : '0';
      },
      name: 'Car-Free Households (%)',
    },
    transitScore: {
      formula: (data: any) => {
        const transit = parseInt(data.publicTransitCommuters || '0');
        const total = parseInt(data.totalCommuters || '1');
        return total > 0 ? ((transit / total) * 100).toFixed(0) : '0';
      },
      name: 'Transit Access Score',
    },
    vulnerablePercent: {
      formula: (data: any) => {
        const under18 = parseInt(data.populationUnder18 || '0') + parseInt(data.populationUnder18Female || '0');
        const over65 = parseInt(data.population65Plus || '0') + parseInt(data.population65PlusFemale || '0');
        const disabled = parseInt(data.disabledPopulation || '0');
        const total = parseInt(data.totalPopulation || '1');
        return total > 0 ? (((under18 + over65 + disabled) / total) * 100).toFixed(1) : '0';
      },
      name: 'Vulnerable Residents (%)',
    },
  },
};

/**
 * Get all variable codes as a comma-separated string for API requests
 */
export const getAllVariableCodes = (): string => {
  return Object.values(CENSUS_CONFIG.VARIABLES).join(',');
};

/**
 * Get variable code by friendly name
 */
export const getVariableCode = (variableName: keyof typeof CENSUS_CONFIG.VARIABLES): string => {
  return CENSUS_CONFIG.VARIABLES[variableName];
};

/**
 * Build API URL for tract-level data
 */
export const buildCensusApiUrl = (
  year: string = CENSUS_CONFIG.DEFAULT_YEAR,
  variables: string = getAllVariableCodes(),
  stateFips: string = CENSUS_CONFIG.STATE_FIPS,
  countyFips?: string,
  tractFips?: string,
  apiKey?: string
): string => {
  let geography = `for=tract:*&in=state:${stateFips}`;
  
  if (countyFips) {
    geography += `&in=county:${countyFips}`;
  }
  
  if (tractFips) {
    geography = `for=tract:${tractFips}&in=state:${stateFips}${countyFips ? `&in=county:${countyFips}` : ''}`;
  }
  
  const url = `${CENSUS_CONFIG.BASE_URL}/${year}/acs/acs5?get=${variables}&${geography}`;
  
  if (apiKey) {
    return `${url}&key=${apiKey}`;
  }
  
  return url;
};

