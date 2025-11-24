# Pre-compute Greenspace Data

This directory contains scripts to pre-calculate greenspace percentages for NYC census tracts using Python, which is much faster than calculating in the browser.

## Setup

1. Install Python dependencies:
```bash
pip install -r scripts/requirements.txt
```

Or install directly:
```bash
pip install geopandas shapely
```

## Usage

Run the greenspace calculation script:

```bash
python scripts/calculate_greenspace.py
```

This will:
1. Load the census tracts GeoJSON from `public/2020_Census_Tracts_20251102.geojson`
2. Load the parks GeoJSON from `public/Parks_Properties_20251123.geojson`
3. Calculate greenspace percentages for each tract
4. Save the results to `public/greenspace_percentages.json`

The output JSON file maps GEOID to greenspace percentage:
```json
{
  "36061000100": 12.45,
  "36061001401": 0.00,
  "36061001402": 5.23,
  ...
}
```

## Performance

- **Python (geopandas)**: ~30-60 seconds for 2325 tracts × 2055 parks
- **JavaScript (Turf.js in browser)**: ~5-10 minutes (blocking the UI)

The pre-computed data is loaded instantly in the browser, making the app much more responsive.

## Regenerating Data

If you update the tracts or parks GeoJSON files, regenerate the greenspace data:

```bash
python scripts/calculate_greenspace.py
```

The JavaScript code will automatically use the pre-computed data if available, or fall back to on-the-fly calculation if the file is missing.





