/**
 * NYC Motor Vehicle Collisions API Service
 * Fetches collision data from NYC Open Data SODA API
 */

const NYC_DATA_APP_TOKEN = "DHTMWiKERCjFf2Eaz0nwyTmNa";
const COLLISIONS_DATASET_URL = "https://data.cityofnewyork.us/resource/h9gi-nx95.json";

export interface CollisionRecord {
  collision_id: string;
  crash_date: string;
  crash_time?: string;
  latitude?: string;
  longitude?: string;
  number_of_persons_injured?: string;
  number_of_persons_killed?: string;
  number_of_pedestrians_injured?: string;
  number_of_pedestrians_killed?: string;
  number_of_cyclist_injured?: string;
  number_of_cyclist_killed?: string;
  number_of_motorist_injured?: string;
  number_of_motorist_killed?: string;
  contributing_factor_vehicle_1?: string;
  contributing_factor_vehicle_2?: string;
  vehicle_type_code_1?: string;
  vehicle_type_code_2?: string;
  [key: string]: string | undefined;
}

export interface CollisionQueryParams {
  start_date?: string; // Format: 'YYYY-MM-DD'
  end_date?: string; // Format: 'YYYY-MM-DD'
  collision_id?: string;
  has_injuries?: boolean;
  has_fatalities?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Fetch collision data from NYC Open Data API
 */
export async function fetchCollisionData(
  params: CollisionQueryParams = {}
): Promise<CollisionRecord[]> {
  const {
    start_date,
    end_date,
    collision_id,
    has_injuries,
    has_fatalities,
    limit = 50000,
    offset = 0,
  } = params;

  const queryParams: Record<string, string> = {
    $limit: limit.toString(),
    $offset: offset.toString(),
  };

  // Build WHERE clause if filters are provided
  const whereConditions: string[] = [];

  if (start_date) {
    whereConditions.push(`crash_date >= '${start_date}T00:00:00.000'`);
  }

  if (end_date) {
    whereConditions.push(`crash_date <= '${end_date}T23:59:59.999'`);
  }

  if (collision_id) {
    whereConditions.push(`collision_id = '${collision_id}'`);
  }

  if (has_injuries !== undefined) {
    if (has_injuries) {
      whereConditions.push("number_of_persons_injured > 0");
    } else {
      whereConditions.push("number_of_persons_injured = 0");
    }
  }

  if (has_fatalities !== undefined) {
    if (has_fatalities) {
      whereConditions.push("number_of_persons_killed > 0");
    } else {
      whereConditions.push("number_of_persons_killed = 0");
    }
  }

  if (whereConditions.length > 0) {
    queryParams.$where = whereConditions.join(" AND ");
  }

  try {
    const response = await fetch(
      `${COLLISIONS_DATASET_URL}?${new URLSearchParams(queryParams).toString()}`,
      {
        headers: {
          "X-App-Token": NYC_DATA_APP_TOKEN,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }

    const data: CollisionRecord[] = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching collision data:", error);
    throw error;
  }
}

/**
 * Filter collision records to only include those with valid coordinates
 */
export function filterValidCoordinates(
  collisions: CollisionRecord[]
): CollisionRecord[] {
  return collisions.filter((collision) => {
    const lat = parseFloat(collision.latitude || "");
    const lon = parseFloat(collision.longitude || "");
    return (
      !isNaN(lat) &&
      !isNaN(lon) &&
      lat >= 40.4 &&
      lat <= 41.0 &&
      lon >= -74.5 &&
      lon <= -73.5
    );
  });
}

/**
 * Get unique collisions by collision_id
 * Each collision_id represents a distinct collision event
 */
export function getUniqueCollisions(
  collisions: CollisionRecord[]
): CollisionRecord[] {
  const seen = new Set<string>();
  return collisions.filter((collision) => {
    if (seen.has(collision.collision_id)) {
      return false;
    }
    seen.add(collision.collision_id);
    return true;
  });
}

