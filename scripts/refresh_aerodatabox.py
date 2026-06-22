"""
Weekly supplement: fetch fresh route data from AeroDataBox API
for the top airports and merge into existing JSON files.

Usage:
    AERODATABOX_KEY=your_key python scripts/refresh_aerodatabox.py

Requires AERODATABOX_KEY environment variable (RapidAPI key).
"""

import json
import os
import sys
from datetime import date
from pathlib import Path

import requests

OUTPUT_DIR = Path(__file__).parent.parent / "public" / "data"
ROUTES_DIR = OUTPUT_DIR / "routes"

API_HOST = "aerodatabox.p.rapidapi.com"
API_KEY = os.environ.get("AERODATABOX_KEY", "")

# Top US airports by passenger volume to refresh
TOP_AIRPORTS = [
    "KATL", "KLAX", "KORD", "KDFW", "KDEN", "KJFK", "KSFO", "KSEA",
    "KLAS", "KMCO", "KEWR", "KPHX", "KIAH", "KMIA", "KBOS", "KMSP",
    "KDTW", "KFLL", "KPHL", "KLGA", "KBWI", "KSLC", "KDCA", "KSAN",
    "KTPA", "KAUS", "KHNL", "KMDW", "KBNA", "KRDU",
]

ICAO_TO_IATA = {
    "KATL": "ATL", "KLAX": "LAX", "KORD": "ORD", "KDFW": "DFW",
    "KDEN": "DEN", "KJFK": "JFK", "KSFO": "SFO", "KSEA": "SEA",
    "KLAS": "LAS", "KMCO": "MCO", "KEWR": "EWR", "KPHX": "PHX",
    "KIAH": "IAH", "KMIA": "MIA", "KBOS": "BOS", "KMSP": "MSP",
    "KDTW": "DTW", "KFLL": "FLL", "KPHL": "PHL", "KLGA": "LGA",
    "KBWI": "BWI", "KSLC": "SLC", "KDCA": "DCA", "KSAN": "SAN",
    "KTPA": "TPA", "KAUS": "AUS", "KHNL": "HNL", "KMDW": "MDW",
    "KBNA": "BNA", "KRDU": "RDU",
}


def fetch_routes(icao: str) -> list[dict] | None:
    """Fetch routes from AeroDataBox for a given ICAO code."""
    url = f"https://{API_HOST}/airports/icao/{icao}/routes"
    headers = {
        "X-RapidAPI-Key": API_KEY,
        "X-RapidAPI-Host": API_HOST,
    }

    try:
        resp = requests.get(url, headers=headers, timeout=30)
        if resp.status_code == 200:
            return resp.json().get("routes", [])
        print(f"  API returned {resp.status_code} for {icao}")
        return None
    except Exception as e:
        print(f"  Error fetching {icao}: {e}")
        return None


def merge_routes(icao: str, api_routes: list[dict]) -> None:
    """Merge AeroDataBox routes into existing JSON file."""
    iata = ICAO_TO_IATA.get(icao, "")
    if not iata:
        return

    route_file = ROUTES_DIR / f"{iata.lower()}.json"
    if not route_file.exists():
        print(f"  No existing file for {iata}, skipping merge")
        return

    existing = json.loads(route_file.read_text())
    existing_dests = {r["destination"]["iata"] for r in existing["routes"]}

    new_count = 0
    for api_route in api_routes:
        dest_iata = api_route.get("destination", {}).get("iata", "")
        if not dest_iata or dest_iata in existing_dests:
            continue

        dest_info = api_route.get("destination", {})
        airline_info = api_route.get("airline", {})

        existing["routes"].append({
            "destination": {
                "iata": dest_iata,
                "name": dest_info.get("name", dest_iata),
                "city": dest_info.get("municipalityName", dest_iata),
                "lat": dest_info.get("location", {}).get("lat", 0),
                "lon": dest_info.get("location", {}).get("lon", 0),
            },
            "airlines": [{
                "code": airline_info.get("iata", "??"),
                "name": airline_info.get("name", "Unknown"),
                "weekly_flights": 0,
                "annual_passengers": 0,
            }],
            "distance_miles": 0,
            "total_annual_passengers": 0,
        })
        new_count += 1

    if new_count > 0:
        existing["last_updated"] = date.today().isoformat()
        route_file.write_text(json.dumps(existing, separators=(",", ":")))
        print(f"  Added {new_count} new routes to {iata}")
    else:
        print(f"  No new routes for {iata}")


def main():
    if not API_KEY:
        print("ERROR: Set AERODATABOX_KEY environment variable", file=sys.stderr)
        sys.exit(1)

    print(f"Refreshing routes for {len(TOP_AIRPORTS)} airports...")

    success_count = 0
    fail_count = 0
    for icao in TOP_AIRPORTS:
        iata = ICAO_TO_IATA.get(icao, icao)
        print(f"Fetching {iata} ({icao})...")
        routes = fetch_routes(icao)
        if routes is None:
            fail_count += 1
            continue
        success_count += 1
        if routes:
            merge_routes(icao, routes)

    if success_count == 0:
        print(
            f"ERROR: All {fail_count} airport fetches failed "
            "(auth error, network, or API outage). Check AERODATABOX_KEY.",
            file=sys.stderr,
        )
        sys.exit(1)

    print("Done!")


if __name__ == "__main__":
    main()
