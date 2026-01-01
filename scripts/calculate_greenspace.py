#!/usr/bin/env python3
"""
Pre-calculate greenspace percentages for NYC census tracts.

This script:
1. Loads census tract boundaries from GeoJSON
2. Loads park boundaries from GeoJSON
3. Calculates the percentage of each tract covered by parks
4. Saves results as a JSON file mapping GEOID to greenspace percentage

Usage:
    python scripts/calculate_greenspace.py

Requirements:
    pip install geopandas shapely
"""

import json
import sys
from pathlib import Path
from typing import Dict

try:
    import geopandas as gpd
    from shapely.geometry import shape
except ImportError:
    print("Error: geopandas and shapely are required.")
    print("Install with: pip install geopandas shapely")
    sys.exit(1)


def load_geojson(file_path: Path) -> gpd.GeoDataFrame:
    """Load a GeoJSON file into a GeoDataFrame."""
    print(f"Loading {file_path.name}...")
    try:
        gdf = gpd.read_file(file_path)
        print(f"  ✅ Loaded {len(gdf)} features")
        return gdf
    except Exception as e:
        print(f"  ❌ Error loading {file_path}: {e}")
        sys.exit(1)


def calculate_greenspace_percentages(
    tracts_gdf: gpd.GeoDataFrame,
    parks_gdf: gpd.GeoDataFrame
) -> Dict[str, float]:
    """
    Calculate greenspace percentage for each tract.
    
    Returns a dictionary mapping GEOID to greenspace percentage (0-100).
    """
    print("\n🌳 Calculating greenspace percentages...")
    
    # Ensure both GeoDataFrames use the same CRS (WGS84)
    if tracts_gdf.crs is None:
        tracts_gdf.set_crs('EPSG:4326', inplace=True)
    if parks_gdf.crs is None:
        parks_gdf.set_crs('EPSG:4326', inplace=True)
    
    # Reproject to a projected CRS for accurate area calculations (meters)
    # Using EPSG:3857 (Web Mercator) or better, EPSG:2263 (NY State Plane)
    # For NYC, EPSG:2263 is more accurate, but EPSG:3857 is more universal
    tracts_projected = tracts_gdf.to_crs('EPSG:3857')
    parks_projected = parks_gdf.to_crs('EPSG:3857')
    
    results: Dict[str, float] = {}
    total_tracts = len(tracts_projected)
    
    for idx, tract in tracts_projected.iterrows():
        if (idx + 1) % 100 == 0:
            print(f"  Processed {idx + 1}/{total_tracts} tracts...")
        
        geoid = tract.get('GEOID') or tract.get('geoid')
        if not geoid:
            # Try to construct GEOID from other fields
            if 'ct2020' in tract and 'borocode' in tract:
                state = '36'
                county = str(tract['borocode']).zfill(3)
                tract_code = str(tract['ct2020']).replace('.', '').zfill(6)
                geoid = f"{state}{county}{tract_code}"
            else:
                continue
        
        # Ensure GEOID is string and clean
        geoid = str(geoid).strip()
        
        tract_geometry = tract.geometry
        if tract_geometry is None or tract_geometry.is_empty:
            results[geoid] = 0.0
            continue
        
        # Calculate tract area in square meters
        tract_area = tract_geometry.area
        if tract_area == 0:
            results[geoid] = 0.0
            continue
        
        # Find all parks that intersect with this tract
        intersecting_parks = parks_projected[parks_projected.geometry.intersects(tract_geometry)]
        
        # Calculate total park area within the tract
        total_park_area = 0.0
        for _, park in intersecting_parks.iterrows():
            park_geometry = park.geometry
            if park_geometry is None or park_geometry.is_empty:
                continue
            
            # Calculate intersection
            intersection = tract_geometry.intersection(park_geometry)
            if intersection and not intersection.is_empty:
                intersection_area = intersection.area
                total_park_area += intersection_area
        
        # Calculate percentage
        percentage = (total_park_area / tract_area) * 100
        results[geoid] = round(percentage, 2)
    
    print(f"\n✅ Calculated greenspace for {len(results)} tracts")
    return results


def main():
    """Main execution function."""
    # Get the project root directory (parent of scripts/)
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    public_dir = project_root / 'public'
    
    # File paths
    tracts_file = public_dir / '2020_Census_Tracts_20251102.geojson'
    parks_file = public_dir / 'Parks_Properties_20251123.geojson'
    output_file = public_dir / 'greenspace_percentages.json'
    
    # Check if input files exist
    if not tracts_file.exists():
        print(f"❌ Error: Tracts file not found: {tracts_file}")
        sys.exit(1)
    
    if not parks_file.exists():
        print(f"❌ Error: Parks file not found: {parks_file}")
        sys.exit(1)
    
    print("=" * 60)
    print("NYC Greenspace Calculator")
    print("=" * 60)
    
    # Load GeoJSON files
    tracts_gdf = load_geojson(tracts_file)
    parks_gdf = load_geojson(parks_file)
    
    # Calculate greenspace percentages
    greenspace_data = calculate_greenspace_percentages(tracts_gdf, parks_gdf)
    
    # Calculate statistics
    percentages = list(greenspace_data.values())
    if percentages:
        min_pct = min(percentages)
        max_pct = max(percentages)
        avg_pct = sum(percentages) / len(percentages)
        tracts_with_parks = sum(1 for p in percentages if p > 0)
        
        print("\n📊 Statistics:")
        print(f"  Min: {min_pct:.2f}%")
        print(f"  Max: {max_pct:.2f}%")
        print(f"  Avg: {avg_pct:.2f}%")
        print(f"  Tracts with parks: {tracts_with_parks}/{len(percentages)}")
    
    # Save results
    print(f"\n💾 Saving results to {output_file.name}...")
    with open(output_file, 'w') as f:
        json.dump(greenspace_data, f, indent=2)
    
    print(f"✅ Successfully saved greenspace data for {len(greenspace_data)} tracts")
    print(f"   Output file: {output_file}")
    print("\n" + "=" * 60)


if __name__ == '__main__':
    main()












