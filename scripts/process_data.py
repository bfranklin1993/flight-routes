"""
Process BTS T-100 segment data + OurAirports into static JSON files
for the flight route map.

Usage:
    python scripts/process_data.py

Downloads data to scripts/raw/, outputs JSON to public/data/.
"""

import json
import math
import os
from pathlib import Path

import pandas as pd
import requests

SCRIPT_DIR = Path(__file__).parent
RAW_DIR = SCRIPT_DIR / "raw"
OUTPUT_DIR = SCRIPT_DIR.parent / "public" / "data"
ROUTES_DIR = OUTPUT_DIR / "routes"

# OurAirports data
OURAIRPORTS_URL = "https://davidmegginson.github.io/ourairports-data/airports.csv"

# Columns we need from T-100
T100_COLS = [
    "ORIGIN", "DEST", "UNIQUE_CARRIER", "CARRIER_NAME",
    "DEPARTURES_PERFORMED", "SEATS", "PASSENGERS", "MONTH", "YEAR",
]


def download_ourairports() -> pd.DataFrame:
    """Download and parse OurAirports data for IATA-coded airports."""
    print("Downloading OurAirports data...")
    path = RAW_DIR / "airports.csv"

    if not path.exists():
        resp = requests.get(OURAIRPORTS_URL, timeout=60)
        resp.raise_for_status()
        path.write_bytes(resp.content)

    df = pd.read_csv(path)
    # Keep only airports with IATA codes, medium/large size
    df = df[df["iata_code"].notna() & (df["iata_code"] != "")]
    df = df[df["type"].isin(["medium_airport", "large_airport"])]
    df = df.rename(columns={
        "iata_code": "iata",
        "name": "name",
        "municipality": "city",
        "latitude_deg": "lat",
        "longitude_deg": "lon",
    })
    return df[["iata", "name", "city", "lat", "lon"]].copy()


def load_t100_data() -> pd.DataFrame:
    """
    Load T-100 data from CSV files in raw/ directory.

    The BTS download interface requires manual interaction, so this expects
    the user to have downloaded the CSVs manually and placed them in scripts/raw/
    as 't100_domestic.csv' and/or 't100_international.csv'.
    """
    frames = []

    domestic_path = RAW_DIR / "t100_domestic.csv"
    if domestic_path.exists():
        print(f"Loading domestic T-100 data from {domestic_path}...")
        df = pd.read_csv(domestic_path, usecols=lambda c: c in T100_COLS)
        frames.append(df)
    else:
        print(f"WARNING: {domestic_path} not found. Download from transtats.bts.gov")

    intl_path = RAW_DIR / "t100_international.csv"
    if intl_path.exists():
        print(f"Loading international T-100 data from {intl_path}...")
        df = pd.read_csv(intl_path, usecols=lambda c: c in T100_COLS)
        frames.append(df)
    else:
        print(f"WARNING: {intl_path} not found. Download from transtats.bts.gov")

    if not frames:
        raise FileNotFoundError(
            "No T-100 CSV files found in scripts/raw/. "
            "Download from https://transtats.bts.gov and save as "
            "t100_domestic.csv and/or t100_international.csv"
        )

    return pd.concat(frames, ignore_index=True)


def haversine_miles(lat1: float, lon1: float, lat2: float, lon2: float) -> int:
    """Calculate great circle distance in miles between two points."""
    R = 3959  # Earth radius in miles
    lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return round(R * 2 * math.asin(math.sqrt(a)))


def process_routes(t100: pd.DataFrame, airports: pd.DataFrame) -> None:
    """Aggregate T-100 data and output per-airport JSON files."""
    # Filter to routes that actually operated
    t100 = t100[t100["DEPARTURES_PERFORMED"] > 0].copy()

    # Aggregate by origin-dest-carrier across all months
    agg = (
        t100.groupby(["ORIGIN", "DEST", "UNIQUE_CARRIER", "CARRIER_NAME"])
        .agg(
            total_departures=("DEPARTURES_PERFORMED", "sum"),
            total_passengers=("PASSENGERS", "sum"),
        )
        .reset_index()
    )

    # Calculate weekly flights (total departures / 52 weeks, rounded)
    agg["weekly_flights"] = (agg["total_departures"] / 52).round().astype(int)

    # Build airport lookup
    airport_lookup = airports.set_index("iata").to_dict("index")

    # Get all unique origin airports
    origins = agg["ORIGIN"].unique()
    print(f"Processing {len(origins)} origin airports...")

    # Track airports that appear in route data for the index
    active_airports = set()

    ROUTES_DIR.mkdir(parents=True, exist_ok=True)

    for origin in origins:
        if origin not in airport_lookup:
            continue

        origin_info = airport_lookup[origin]
        origin_routes = agg[agg["ORIGIN"] == origin]

        routes = []
        for dest, dest_group in origin_routes.groupby("DEST"):
            if dest not in airport_lookup:
                continue

            dest_info = airport_lookup[dest]
            airlines = []
            for _, row in dest_group.iterrows():
                airlines.append({
                    "code": row["UNIQUE_CARRIER"],
                    "name": row["CARRIER_NAME"],
                    "weekly_flights": int(row["weekly_flights"]),
                    "annual_passengers": int(row["total_passengers"]),
                })

            # Sort airlines by passenger volume descending
            airlines.sort(key=lambda a: a["annual_passengers"], reverse=True)

            routes.append({
                "destination": {
                    "iata": dest,
                    "name": dest_info["name"],
                    "city": str(dest_info["city"]) if pd.notna(dest_info["city"]) else dest,
                    "lat": round(dest_info["lat"], 4),
                    "lon": round(dest_info["lon"], 4),
                },
                "airlines": airlines,
                "distance_miles": haversine_miles(
                    origin_info["lat"], origin_info["lon"],
                    dest_info["lat"], dest_info["lon"],
                ),
                "total_annual_passengers": int(dest_group["total_passengers"].sum()),
            })

            active_airports.add(dest)

        if not routes:
            continue

        # Sort routes by total passengers descending
        routes.sort(key=lambda r: r["total_annual_passengers"], reverse=True)

        active_airports.add(origin)

        airport_data = {
            "airport": {
                "iata": origin,
                "name": origin_info["name"],
                "city": str(origin_info["city"]) if pd.notna(origin_info["city"]) else origin,
                "lat": round(origin_info["lat"], 4),
                "lon": round(origin_info["lon"], 4),
            },
            "routes": routes,
            "last_updated": pd.Timestamp.now().strftime("%Y-%m-%d"),
        }

        out_path = ROUTES_DIR / f"{origin.lower()}.json"
        out_path.write_text(json.dumps(airport_data, separators=(",", ":")))

    # Write airport index (only airports that appear in route data)
    index = []
    for iata in sorted(active_airports):
        if iata in airport_lookup:
            info = airport_lookup[iata]
            index.append({
                "iata": iata,
                "name": info["name"],
                "city": str(info["city"]) if pd.notna(info["city"]) else iata,
                "lat": round(info["lat"], 4),
                "lon": round(info["lon"], 4),
            })

    index_path = OUTPUT_DIR / "airports.json"
    index_path.write_text(json.dumps(index, separators=(",", ":")))
    print(f"Wrote {len(index)} airports to {index_path}")
    print(f"Wrote route files for {len(origins)} origin airports to {ROUTES_DIR}")


def main():
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    airports = download_ourairports()
    print(f"Loaded {len(airports)} airports from OurAirports")

    t100 = load_t100_data()
    print(f"Loaded {len(t100)} T-100 segment records")

    process_routes(t100, airports)
    print("Done!")


if __name__ == "__main__":
    main()
