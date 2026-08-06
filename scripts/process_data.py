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

# Regional carriers with a single parent — safe to merge
REGIONAL_TO_PARENT = {
    "MQ": ("AA", "American"),   # Envoy Air → always American Eagle
    "OH": ("AA", "American"),   # PSA Airlines → always American Eagle
    "PT": ("AA", "American"),   # Piedmont → always American Eagle
    "ZW": ("AA", "American"),   # Air Wisconsin → always American Eagle
    "9E": ("DL", "Delta"),      # Endeavor Air → always Delta Connection
    "G7": ("UA", "United"),     # GoJet → always United Express
    "C5": ("UA", "United"),     # CommuteAir → always United Express
    "QX": ("AS", "Alaska"),     # Horizon Air → always Alaska
    "TA": ("AV", "Avianca"),     # TACA → now Avianca
    "LR": ("AV", "Avianca"),     # LACSA → now Avianca
    "QK": ("AC", "Air Canada"),  # Jazz Aviation → always Air Canada
    "5D": ("AM", "Aeromexico"),  # Aerolitoral → always Aeromexico Connect
}

# Regional carriers that fly for MULTIPLE mainline airlines —
# can't attribute to a specific mainline, so relabel as "Regional"
# to preserve the routes while being honest about carrier attribution
AMBIGUOUS_REGIONALS = {
    "OO": "Regional (SkyWest)",
    "YX": "Regional (Republic)",
    "YV": "Regional (Mesa)",
    "AX": "Regional",
    "CP": "Regional",
}

# Clean up verbose BTS carrier names to human-friendly names
CARRIER_NAME_CLEANUP = {
    "United Air Lines Inc.": "United",
    "American Airlines Inc.": "American",
    "Delta Air Lines Inc.": "Delta",
    "Southwest Airlines Co.": "Southwest",
    "Alaska Airlines Inc.": "Alaska",
    "JetBlue Airways": "JetBlue",
    "Spirit Air Lines": "Spirit",
    "Frontier Airlines Inc.": "Frontier",
    "Sun Country Airlines d/b/a MN Airlines": "Sun Country",
    "TEM Enterprises dba  Avelo Airlines": "Avelo",
    "Compagnie Natl Air France": "Air France",
    "Klm Royal Dutch Airlines": "KLM",
    "Lufthansa German Airlines": "Lufthansa",
    "British Airways Plc": "British Airways",
    "Scandinavian Airlines Sys.": "SAS",
    "Korean Air Lines Co. Ltd.": "Korean Air",
    "Japan Air Lines Co. Ltd.": "Japan Airlines",
    "All Nippon Airways Co.": "ANA",
    "Cathay Pacific Airways Ltd.": "Cathay Pacific",
    "Eva Airways Corporation": "EVA Air",
    "Turk Hava Yollari A.O.": "Turkish Airlines",
    "Qatar Airways (Q.C.S.C)": "Qatar Airways",
    "Compania Panamena (Copa)": "Copa Airlines",
    "Alia-(The) Royal Jordanian": "Royal Jordanian",
    "Swiss International Airlines": "Swiss",
    "Aer Lingus Plc": "Aer Lingus",
    "Italia Transporto Aereo S.P.A DBA ITA S.P.A": "ITA Airways",
    "Polskie Linie Lotnicze": "LOT Polish",
    "Concesionaria Vuela Compania De Aviacion SA de CV (Volaris)": "Volaris",
    "Aeroenlaces Nacionales, S.A. de C.V. d/b/a VivaAerobus": "VivaAerobus",
    "Aerovias Nacl De Colombia": "Avianca",
    "Taca International Airlines": "TACA",
    "National Aviation Company of India Limited d/b/a Air India": "Air India",
    "Finnair Oy": "Finnair",
    "TAP-TAP Air Portugal": "TAP Air Portugal",
    "CFM Inc d/b/a Contour Airlines d/b/a One Jet Shuttle": "Contour Airlines",
    "Southern Airways Express, dba Mokulele Airlines": "Southern Airways",
    "Key Lime Air Corp dba Denver Air Connection": "Denver Air",
    "Air Canada rouge LP": "Air Canada Rouge",
    "Jazz Aviation LP": "Jazz Aviation",
    "Ethiopian Airlines": "Ethiopian",
    "Etihad Airways": "Etihad",
    "Iberia Air Lines Of Spain": "Iberia",
    "Icelandair": "Icelandair",
    "Arajet S.A.": "Arajet",
    "Lacsa": "LACSA",
    "Asiana Airlines Inc.": "Asiana",
    "Brussels Airlines N.V.": "Brussels Airlines",
    "Caribbean Airlines Limited": "Caribbean Airlines",
    "Cayman Airways Limited": "Cayman Airways",
    "China Airlines Ltd.": "China Airlines",
    "China Eastern Airlines": "China Eastern",
    "China Southern Airlines": "China Southern",
    "Eastern Airlines f/k/a Dynamic Airways, LLC": "Eastern Airlines",
    "El Al Israel Airlines Ltd.": "El Al",
    "Flair Airlines Ltd.": "Flair",
    "Global Crossing Airlines, Inc.": "GlobalX",
    "Gulf Air B.S.C. (C)": "Gulf Air",
    "Hawaiian Airlines Inc.": "Hawaiian",
    "Hyannis Air Service, Inc. dba Cape Air": "Cape Air",
    "Kenya Airways PLC": "Kenya Airways",
    "Kuwait Airways Corp.": "Kuwait Airways",
    "LATAM Airlines Group SA dba Lan Airlines": "LATAM",
    "TAM Linhas Aereas SA dba Latam Airlines Brasil": "LATAM Brasil",
    "Lan-Chile Airlines": "LATAM Chile",
    "Lan Ecuador": "LATAM Ecuador",
    "Lan Peru Airlines": "LATAM Peru",
    "Neos S.P.A": "Neos",
    "Norse Atlantic Airways,AS": "Norse Atlantic",
    "Norse Atlantic UK Ltd": "Norse Atlantic",
    "Philippine Airlines Inc.": "Philippine Airlines",
    "Qantas Airways Ltd.": "Qantas",
    "Saudi Arabian Airlines Corp": "Saudia",
    "Singapore Airlines Ltd.": "Singapore Airlines",
    "Virgin Atlantic Airways": "Virgin Atlantic",
    "Vuela EL Salvador S.A. de C.V.": "Volaris El Salvador",
    "Xiamen Airlines Co., Ltd.": "Xiamen Airlines",
    "Condor Flugdienst": "Condor",
    "Sata Internacional": "Azores Airlines",
    "Royal Air Maroc": "Royal Air Maroc",
    "Uzbekistan Airways": "Uzbekistan Airways",
    "Breeze Aviation Group DBA  Breeze": "Breeze",
    "Allegiant Air": "Allegiant",
    "Air Pacific Ltd.": "Fiji Airways",
    "Aerogal": "LATAM Ecuador",
    "Aerovias de Mexico": "Aeromexico",
    "Aerovias Nacl De Colombia": "Avianca",
    "Air Canada": "Air Canada",
    "Eastern Airlines f/k/a Dynamic Airways LLC": "Eastern",
    "Global Crossing Airlines Inc.": "GlobalX",
}

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
        "iso_country": "country",
        "iso_region": "region",
    })

    # Build a human-readable region label: state for US, country name for international
    country_names = {
        "CA": "Canada", "MX": "Mexico", "GB": "United Kingdom", "FR": "France",
        "DE": "Germany", "JP": "Japan", "KR": "South Korea", "CN": "China",
        "AU": "Australia", "NZ": "New Zealand", "BR": "Brazil", "CO": "Colombia",
        "CL": "Chile", "PE": "Peru", "AR": "Argentina", "EC": "Ecuador",
        "PA": "Panama", "CR": "Costa Rica", "SV": "El Salvador", "GT": "Guatemala",
        "HN": "Honduras", "BZ": "Belize", "NI": "Nicaragua", "DO": "Dominican Republic",
        "JM": "Jamaica", "BS": "Bahamas", "KY": "Cayman Islands", "TT": "Trinidad & Tobago",
        "BB": "Barbados", "AG": "Antigua", "LC": "Saint Lucia", "GD": "Grenada",
        "VC": "St. Vincent", "TC": "Turks & Caicos", "BM": "Bermuda", "AW": "Aruba",
        "CW": "Curaçao", "SX": "Sint Maarten", "PR": "Puerto Rico", "VI": "US Virgin Islands",
        "IS": "Iceland", "IE": "Ireland", "NL": "Netherlands", "BE": "Belgium",
        "CH": "Switzerland", "AT": "Austria", "IT": "Italy", "ES": "Spain",
        "PT": "Portugal", "GR": "Greece", "TR": "Turkey", "IL": "Israel",
        "AE": "UAE", "QA": "Qatar", "SA": "Saudi Arabia", "JO": "Jordan",
        "EG": "Egypt", "MA": "Morocco", "ET": "Ethiopia", "KE": "Kenya",
        "NG": "Nigeria", "GH": "Ghana", "SN": "Senegal", "ZA": "South Africa",
        "IN": "India", "TH": "Thailand", "SG": "Singapore", "PH": "Philippines",
        "TW": "Taiwan", "HK": "Hong Kong", "FJ": "Fiji", "PF": "French Polynesia",
        "SE": "Sweden", "NO": "Norway", "DK": "Denmark", "FI": "Finland",
        "PL": "Poland", "CZ": "Czech Republic", "HU": "Hungary", "RO": "Romania",
        "HR": "Croatia", "RS": "Serbia", "BG": "Bulgaria", "LT": "Lithuania",
        "LV": "Latvia", "EE": "Estonia", "UZ": "Uzbekistan", "GE": "Georgia",
        "AM": "Armenia", "KW": "Kuwait", "BH": "Bahrain", "OM": "Oman",
        "CU": "Cuba", "HT": "Haiti", "GU": "Guam", "AS": "American Samoa",
        "MH": "Marshall Islands", "PW": "Palau", "FM": "Micronesia",
    }

    def make_region_label(row):
        if row["country"] == "US":
            # Extract state from iso_region (e.g., "US-IL" -> "IL")
            return row["region"].split("-")[-1] if pd.notna(row["region"]) else ""
        return country_names.get(row["country"], row["country"])

    df["region_label"] = df.apply(make_region_label, axis=1)

    return df[["iata", "name", "city", "region_label", "lat", "lon"]].copy()


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
        domestic_pairs = set(zip(df["ORIGIN"], df["DEST"]))
        frames.append(df)
    else:
        print(f"WARNING: {domestic_path} not found. Download from transtats.bts.gov")
        domestic_pairs = set()

    intl_path = RAW_DIR / "t100_international.csv"
    if intl_path.exists():
        print(f"Loading international T-100 data from {intl_path}...")
        df = pd.read_csv(intl_path, usecols=lambda c: c in T100_COLS)
        if domestic_pairs:
            # The international file duplicates all domestic routes — filter them out
            before = len(df)
            df = df[~df.apply(lambda r: (r["ORIGIN"], r["DEST"]) in domestic_pairs, axis=1)]
            print(f"  Removed {before - len(df)} domestic duplicates from international file")
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
    # Filter to routes that actually operated AND carried passengers (exclude cargo-only)
    t100 = t100[(t100["DEPARTURES_PERFORMED"] > 0) & (t100["PASSENGERS"] > 0)].copy()

    # Merge single-parent regionals into their mainline carrier
    for regional_code, (parent_code, parent_name) in REGIONAL_TO_PARENT.items():
        mask = t100["UNIQUE_CARRIER"] == regional_code
        t100.loc[mask, "UNIQUE_CARRIER"] = parent_code
        t100.loc[mask, "CARRIER_NAME"] = parent_name

    # Relabel ambiguous regionals — keep routes but use generic names
    for code, label in AMBIGUOUS_REGIONALS.items():
        mask = t100["UNIQUE_CARRIER"] == code
        t100.loc[mask, "CARRIER_NAME"] = label

    # Clean up verbose BTS carrier names
    t100["CARRIER_NAME"] = t100["CARRIER_NAME"].map(
        lambda x: CARRIER_NAME_CLEANUP.get(x, x)
    )

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

    # Filter out charter/private operators: require at least 1,000 passengers
    # on a route over the year (roughly 20/week = real scheduled service)
    agg = agg[agg["total_passengers"] >= 1000]

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
                    "region": str(dest_info["region_label"]) if pd.notna(dest_info.get("region_label")) else "",
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
                "region": str(origin_info["region_label"]) if pd.notna(origin_info.get("region_label")) else "",
                "lat": round(origin_info["lat"], 4),
                "lon": round(origin_info["lon"], 4),
            },
            "routes": routes,
            "last_updated": pd.Timestamp.now().strftime("%Y-%m-%d"),
        }

        out_path = ROUTES_DIR / f"{origin.lower()}.json"
        out_path.write_text(json.dumps(airport_data, separators=(",", ":")))

    # Write airport index (only airports that appear in route data).
    # "passengers" is total annual departing passengers across all routes, used
    # to rank search results so a query matching several airports surfaces the
    # one the user almost certainly meant.
    index = []
    for iata in sorted(active_airports):
        if iata in airport_lookup:
            info = airport_lookup[iata]
            route_file = ROUTES_DIR / f"{iata.lower()}.json"
            passengers = 0
            if route_file.exists():
                data = json.loads(route_file.read_text())
                passengers = sum(
                    r["total_annual_passengers"] for r in data["routes"]
                )
            index.append({
                "iata": iata,
                "name": info["name"],
                "city": str(info["city"]) if pd.notna(info["city"]) else iata,
                "region": str(info["region_label"]) if pd.notna(info.get("region_label")) else "",
                "lat": round(info["lat"], 4),
                "lon": round(info["lon"], 4),
                "passengers": passengers,
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
