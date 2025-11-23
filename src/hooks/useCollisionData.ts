import { useState, useEffect, useMemo } from 'react';
import {
  fetchCollisionData,
  filterValidCoordinates,
  getUniqueCollisions,
  CollisionRecord,
  CollisionQueryParams,
} from '@/services/collisionApi';

interface UseCollisionDataParams {
  startDate?: Date;
  endDate?: Date;
  collisionType?: 'all' | 'injuries' | 'fatalities';
  enabled?: boolean;
}

export function useCollisionData({
  startDate,
  endDate,
  collisionType = 'all',
  enabled = true,
}: UseCollisionDataParams) {
  const [collisions, setCollisions] = useState<CollisionRecord[]>([]);
  const [allCollisions, setAllCollisions] = useState<CollisionRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build base query parameters (without type filter)
  const baseQueryParams = useMemo<CollisionQueryParams>(() => {
    if (!enabled || !startDate || !endDate) {
      return {};
    }

    return {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
    };
  }, [startDate, endDate, enabled]);

  // Fetch all collisions first to get counts
  useEffect(() => {
    if (!enabled || !startDate || !endDate) {
      setAllCollisions([]);
      return;
    }

    const loadAllCollisions = async () => {
      try {
        // Fetch all collisions for the date range (no type filter)
        const all = await fetchCollisionData(baseQueryParams);
        const validCollisions = filterValidCoordinates(all);
        const uniqueCollisions = getUniqueCollisions(validCollisions);
        setAllCollisions(uniqueCollisions);
      } catch (err) {
        console.error('Error loading all collisions:', err);
        setAllCollisions([]);
      }
    };

    loadAllCollisions();
  }, [baseQueryParams, enabled, startDate, endDate]);

  // Filter collisions based on selected type - Memoized for performance
  const filteredCollisions = useMemo(() => {
    if (!enabled || !startDate || !endDate || !allCollisions.length) {
      return [];
    }

    let filtered = [...allCollisions];

    // Apply collision type filters
    if (collisionType === 'injuries') {
      filtered = filtered.filter(
        (c) => parseInt(c.number_of_persons_injured || '0') > 0
      );
    } else if (collisionType === 'fatalities') {
      filtered = filtered.filter(
        (c) => parseInt(c.number_of_persons_killed || '0') > 0
      );
    }

    return filtered;
  }, [allCollisions, collisionType, enabled, startDate, endDate]);

  // Update collisions state only when filtered results change
  useEffect(() => {
    setCollisions(filteredCollisions);
  }, [filteredCollisions]);

  // Calculate counts for each category
  const counts = useMemo(() => {
    const all = getUniqueCollisions(allCollisions);
    const withInjuries = all.filter(
      (c) => parseInt(c.number_of_persons_injured || '0') > 0
    );
    const withFatalities = all.filter(
      (c) => parseInt(c.number_of_persons_killed || '0') > 0
    );

    return {
      all: all.length,
      injuries: withInjuries.length,
      fatalities: withFatalities.length,
    };
  }, [allCollisions]);

  return {
    collisions,
    loading,
    error,
    counts,
  };
}

