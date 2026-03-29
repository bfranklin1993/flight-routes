# Flight Route Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an interactive web app that visualizes nonstop flight routes from any US airport, filterable by airline, with route detail panels.

**Architecture:** Static Next.js site with pre-processed JSON data files. Python script ingests BTS T-100 CSVs + OurAirports data and outputs per-airport JSON files. Mapbox GL JS renders the interactive map. Deployed on Vercel with a weekly GitHub Action to supplement fresh route data.

**Tech Stack:** Next.js 14 (App Router), React, TypeScript, Mapbox GL JS, Tailwind CSS, Python 3 (data processing), GitHub Actions

---

## File Structure

```
flight-routes/
├── scripts/
│   ├── process_data.py          # Main BTS T-100 + OurAirports → JSON processor
│   ├── refresh_aerodatabox.py   # Weekly AeroDataBox supplement script
│   ├── requirements.txt         # Python dependencies (pandas)
│   └── raw/                     # Downloaded CSVs (gitignored)
├── public/
│   └── data/
│       ├── airports.json        # Master airport index for search
│       └── routes/              # Per-airport route files (ord.json, lax.json, etc.)
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout with fonts, metadata
│   │   ├── page.tsx             # Home page — composes map + search + panel
│   │   └── globals.css          # Global styles + Tailwind
│   ├── components/
│   │   ├── FlightMap.tsx         # Mapbox GL map with route arc rendering
│   │   ├── AirportSearch.tsx     # Airport search/autocomplete input
│   │   ├── AirlineFilters.tsx    # Airline filter pills
│   │   ├── RouteDetailPanel.tsx  # Slide-in panel for selected route
│   │   └── Footer.tsx            # Last updated timestamp
│   ├── lib/
│   │   ├── types.ts             # TypeScript types for airport, route, airline data
│   │   ├── geo.ts               # Great circle arc calculation
│   │   ├── airlines.ts          # Airline code → brand color + name mapping
│   │   └── google-flights.ts    # Google Flights URL builder
│   └── hooks/
│       └── useRouteData.ts      # Fetch and cache per-airport route JSON
├── .github/
│   └── workflows/
│       └── refresh-routes.yml   # Weekly AeroDataBox refresh action
├── .gitignore
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
└── package.json
```

---

### Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `next.config.js`, `tailwind.config.ts`, `tsconfig.json`, `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`, `.gitignore`

- [ ] **Step 1: Scaffold Next.js project**

```bash
cd /Users/brianfranklin/flight-routes
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
```

Select defaults when prompted. This creates the full Next.js scaffold with App Router, TypeScript, and Tailwind.

- [ ] **Step 2: Install Mapbox GL JS**

```bash
cd /Users/brianfranklin/flight-routes
npm install mapbox-gl
npm install -D @types/mapbox-gl
```

- [ ] **Step 3: Set up environment variables**

Create `.env.local`:
```
NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
```

Add to `.gitignore` (should already be there from create-next-app):
```
.env.local
```

Also add to `.gitignore`:
```
scripts/raw/
.superpowers/
```

- [ ] **Step 4: Create placeholder page**

Replace `src/app/page.tsx` with:
```tsx
export default function Home() {
  return (
    <main className="h-screen w-screen relative">
      <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400">
        Flight Route Map — coming soon
      </p>
    </main>
  );
}
```

- [ ] **Step 5: Verify it runs**

```bash
cd /Users/brianfranklin/flight-routes
npm run dev
```

Open http://localhost:3000 — should see the placeholder text.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js project with Mapbox GL"
```

---

### Task 2: TypeScript Types

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Define all data types**

Create `src/lib/types.ts`:
```typescript
export interface Airport {
  iata: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
}

export interface AirlineRoute {
  code: string;
  name: string;
  weekly_flights: number;
  annual_passengers: number;
}

export interface Route {
  destination: Airport;
  airlines: AirlineRoute[];
  distance_miles: number;
  total_annual_passengers: number;
}

export interface AirportRoutes {
  airport: Airport;
  routes: Route[];
  last_updated: string;
}

export interface AirportIndex {
  iata: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add TypeScript types for route data"
```

---

### Task 3: Python Data Processing Script

**Files:**
- Create: `scripts/process_data.py`, `scripts/requirements.txt`

This is the critical data pipeline. It downloads BTS T-100 data + OurAirports, merges them, and outputs static JSON files.

- [ ] **Step 1: Create requirements.txt**

Create `scripts/requirements.txt`:
```
pandas>=2.0
requests>=2.28
```

- [ ] **Step 2: Install dependencies**

```bash
cd /Users/brianfranklin/flight-routes
pip install -r scripts/requirements.txt
```

- [ ] **Step 3: Write the data processing script**

Create `scripts/process_data.py`:
```python
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

# BTS T-100 download URLs (domestic + international)
# These are pre-zipped CSVs from transtats.bts.gov
BTS_DOMESTIC_URL = "https://transtats.bts.gov/DownLoad_Table.asp?Table_ID=311&Has_Group=3&Is_Zipped=0"
BTS_INTERNATIONAL_URL = "https://transtats.bts.gov/DownLoad_Table.asp?Table_ID=261&Has_Group=3&Is_Zipped=0"

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
```

- [ ] **Step 4: Create the raw data directory**

```bash
mkdir -p /Users/brianfranklin/flight-routes/scripts/raw
```

The user needs to manually download the T-100 CSVs from https://transtats.bts.gov and place them as:
- `scripts/raw/t100_domestic.csv`
- `scripts/raw/t100_international.csv`

Instructions for download:
1. Go to https://transtats.bts.gov/DL_SelectFields.aspx?gnoession_VQ=FMF (T-100 Domestic)
2. Select all months for the most recent year available
3. Select fields: ORIGIN, DEST, UNIQUE_CARRIER, CARRIER_NAME, DEPARTURES_PERFORMED, SEATS, PASSENGERS, MONTH, YEAR
4. Download as CSV, save to `scripts/raw/t100_domestic.csv`
5. Repeat for international: https://transtats.bts.gov/DL_SelectFields.aspx?gnoession_VQ=FIL

- [ ] **Step 5: Test the script runs** (will fail without CSVs — just verify no import errors)

```bash
cd /Users/brianfranklin/flight-routes
python scripts/process_data.py
```

Expected: Error about missing CSV files (this is correct — we'll download them during execution).

- [ ] **Step 6: Commit**

```bash
git add scripts/process_data.py scripts/requirements.txt
git commit -m "feat: add BTS T-100 data processing script"
```

---

### Task 4: Utility Libraries

**Files:**
- Create: `src/lib/geo.ts`, `src/lib/airlines.ts`, `src/lib/google-flights.ts`

- [ ] **Step 1: Create great circle arc utility**

Create `src/lib/geo.ts`:
```typescript
/**
 * Generate points along a great circle arc between two coordinates.
 * Returns an array of [lng, lat] pairs for use with Mapbox GeoJSON.
 */
export function greatCircleArc(
  start: [number, number],
  end: [number, number],
  numPoints: number = 50
): [number, number][] {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const toDeg = (rad: number) => (rad * 180) / Math.PI;

  const lat1 = toRad(start[1]);
  const lon1 = toRad(start[0]);
  const lat2 = toRad(end[1]);
  const lon2 = toRad(end[0]);

  const d = 2 * Math.asin(
    Math.sqrt(
      Math.sin((lat2 - lat1) / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2
    )
  );

  if (d === 0) return [start, end];

  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const f = i / numPoints;
    const A = Math.sin((1 - f) * d) / Math.sin(d);
    const B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    const lat = toDeg(Math.atan2(z, Math.sqrt(x ** 2 + y ** 2)));
    const lon = toDeg(Math.atan2(y, x));
    points.push([lon, lat]);
  }

  return points;
}
```

- [ ] **Step 2: Create airline color mapping**

Create `src/lib/airlines.ts`:
```typescript
/**
 * Airline brand colors keyed by IATA carrier code.
 * Fallback to a neutral gray for unknown airlines.
 */
const AIRLINE_COLORS: Record<string, string> = {
  UA: "#0051C3", // United
  AA: "#B31942", // American
  DL: "#003366", // Delta
  WN: "#F9A01B", // Southwest
  B6: "#003876", // JetBlue
  AS: "#00467F", // Alaska
  NK: "#FFE600", // Spirit (use dark text)
  F9: "#01A651", // Frontier
  G4: "#702F8A", // Allegiant
  HA: "#7B2D8E", // Hawaiian
  SY: "#E31837", // Sun Country
};

const DEFAULT_COLOR = "#6B7280"; // gray-500

export function getAirlineColor(code: string): string {
  return AIRLINE_COLORS[code] || DEFAULT_COLOR;
}

/**
 * Returns true if the airline's brand color is too light for white text.
 * Used to decide text color on filter pills.
 */
export function needsDarkText(code: string): boolean {
  return ["NK", "WN"].includes(code);
}
```

- [ ] **Step 3: Create Google Flights URL builder**

Create `src/lib/google-flights.ts`:
```typescript
/**
 * Build a Google Flights search URL for a given origin/destination pair.
 */
export function googleFlightsUrl(origin: string, destination: string): string {
  return `https://www.google.com/travel/flights?q=flights+from+${origin}+to+${destination}`;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/geo.ts src/lib/airlines.ts src/lib/google-flights.ts
git commit -m "feat: add geo, airline color, and Google Flights utilities"
```

---

### Task 5: Route Data Hook

**Files:**
- Create: `src/hooks/useRouteData.ts`

- [ ] **Step 1: Create the data fetching hook**

Create `src/hooks/useRouteData.ts`:
```typescript
import { useState, useEffect, useRef } from "react";
import type { AirportRoutes } from "@/lib/types";

const cache = new Map<string, AirportRoutes>();

export function useRouteData(iata: string | null) {
  const [data, setData] = useState<AirportRoutes | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!iata) {
      setData(null);
      return;
    }

    const code = iata.toLowerCase();

    if (cache.has(code)) {
      setData(cache.get(code)!);
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);

    fetch(`/data/routes/${code}.json`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`No route data for ${iata}`);
        return res.json();
      })
      .then((json: AirportRoutes) => {
        cache.set(code, json);
        setData(json);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [iata]);

  return { data, loading, error };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useRouteData.ts
git commit -m "feat: add useRouteData hook with client-side caching"
```

---

### Task 6: Airport Search Component

**Files:**
- Create: `src/components/AirportSearch.tsx`

- [ ] **Step 1: Build the search/autocomplete component**

Create `src/components/AirportSearch.tsx`:
```tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { AirportIndex } from "@/lib/types";

interface AirportSearchProps {
  onSelect: (airport: AirportIndex) => void;
  selected: AirportIndex | null;
}

export default function AirportSearch({ onSelect, selected }: AirportSearchProps) {
  const [query, setQuery] = useState("");
  const [airports, setAirports] = useState<AirportIndex[]>([]);
  const [results, setResults] = useState<AirportIndex[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Load airport index once
  useEffect(() => {
    fetch("/data/airports.json")
      .then((res) => res.json())
      .then((data: AirportIndex[]) => setAirports(data))
      .catch(() => {});
  }, []);

  // Filter results as user types
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase();
    const filtered = airports
      .filter(
        (a) =>
          a.iata.toLowerCase().includes(q) ||
          a.name.toLowerCase().includes(q) ||
          a.city.toLowerCase().includes(q)
      )
      .slice(0, 8);

    setResults(filtered);
    setHighlightIndex(-1);
  }, [query, airports]);

  const handleSelect = useCallback(
    (airport: AirportIndex) => {
      onSelect(airport);
      setQuery("");
      setIsOpen(false);
      inputRef.current?.blur();
    },
    [onSelect]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(results[highlightIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative w-full max-w-md">
      {selected && !isOpen ? (
        <button
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="w-full bg-white rounded-lg px-5 py-3 shadow-md text-left
                     text-gray-800 font-medium hover:shadow-lg transition-shadow"
        >
          <span className="text-gray-400 mr-1">✈</span>
          <span className="font-bold">{selected.iata}</span>
          <span className="text-gray-500 ml-2">— {selected.name}</span>
        </button>
      ) : (
        <div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            onKeyDown={handleKeyDown}
            placeholder="Search airports (e.g., ORD, Chicago, O'Hare)"
            className="w-full bg-white rounded-lg px-5 py-3 shadow-md
                       text-gray-800 placeholder-gray-400 outline-none
                       focus:shadow-lg transition-shadow"
          />
          {isOpen && results.length > 0 && (
            <ul
              ref={listRef}
              className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-lg
                         border border-gray-100 overflow-hidden z-50"
            >
              {results.map((airport, i) => (
                <li
                  key={airport.iata}
                  onMouseDown={() => handleSelect(airport)}
                  className={`px-5 py-3 cursor-pointer transition-colors
                    ${i === highlightIndex ? "bg-gray-100" : "hover:bg-gray-50"}`}
                >
                  <span className="font-bold text-gray-800">{airport.iata}</span>
                  <span className="text-gray-500 ml-2">
                    {airport.name} — {airport.city}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AirportSearch.tsx
git commit -m "feat: add airport search with autocomplete"
```

---

### Task 7: Airline Filter Pills

**Files:**
- Create: `src/components/AirlineFilters.tsx`

- [ ] **Step 1: Build the filter pills component**

Create `src/components/AirlineFilters.tsx`:
```tsx
"use client";

import { getAirlineColor, needsDarkText } from "@/lib/airlines";

interface AirlineFiltersProps {
  airlines: { code: string; name: string }[];
  activeFilters: Set<string>;
  onToggle: (code: string) => void;
}

export default function AirlineFilters({
  airlines,
  activeFilters,
  onToggle,
}: AirlineFiltersProps) {
  if (airlines.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 justify-center mt-2">
      {airlines.map((airline) => {
        const isActive = activeFilters.has(airline.code);
        const color = getAirlineColor(airline.code);
        const darkText = needsDarkText(airline.code);

        return (
          <button
            key={airline.code}
            onClick={() => onToggle(airline.code)}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
            style={{
              backgroundColor: isActive ? color : "#e5e7eb",
              color: isActive ? (darkText ? "#1f2937" : "#ffffff") : "#6b7280",
              opacity: isActive ? 1 : 0.6,
            }}
          >
            {airline.name}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AirlineFilters.tsx
git commit -m "feat: add airline filter pills component"
```

---

### Task 8: Route Detail Panel

**Files:**
- Create: `src/components/RouteDetailPanel.tsx`

- [ ] **Step 1: Build the detail panel**

Create `src/components/RouteDetailPanel.tsx`:
```tsx
"use client";

import type { Route, Airport } from "@/lib/types";
import { getAirlineColor, needsDarkText } from "@/lib/airlines";
import { googleFlightsUrl } from "@/lib/google-flights";

interface RouteDetailPanelProps {
  route: Route;
  origin: Airport;
  onClose: () => void;
}

export default function RouteDetailPanel({
  route,
  origin,
  onClose,
}: RouteDetailPanelProps) {
  const dest = route.destination;

  return (
    <div className="absolute top-0 right-0 h-full w-72 bg-white shadow-xl border-l
                    border-gray-100 z-40 overflow-y-auto animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div>
          <div className="text-lg font-bold text-gray-800">
            {origin.iata} → {dest.iata}
          </div>
          <div className="text-sm text-gray-500">{dest.name}</div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center
                     text-gray-500 hover:bg-gray-200 transition-colors text-sm"
        >
          ✕
        </button>
      </div>

      {/* Airlines */}
      <div className="p-5">
        <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-3">
          Airlines
        </div>
        <div className="space-y-2">
          {route.airlines.map((airline) => (
            <div
              key={airline.code}
              className="bg-gray-50 rounded-lg p-3 flex items-center justify-between"
            >
              <div>
                <div
                  className="font-semibold text-sm"
                  style={{ color: getAirlineColor(airline.code) }}
                >
                  {airline.name}
                </div>
                <div className="text-xs text-gray-400">
                  ~{airline.weekly_flights} flights/week
                </div>
              </div>
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getAirlineColor(airline.code) }}
              />
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-3 mt-5">
          Stats
        </div>
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Distance</span>
            <span className="font-semibold text-gray-800">
              {route.distance_miles.toLocaleString()} mi
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">~Passengers/yr</span>
            <span className="font-semibold text-gray-800">
              {route.total_annual_passengers >= 1_000_000
                ? `${(route.total_annual_passengers / 1_000_000).toFixed(1)}M`
                : `${(route.total_annual_passengers / 1_000).toFixed(0)}K`}
            </span>
          </div>
        </div>

        {/* Search Flights link */}
        <a
          href={googleFlightsUrl(origin.iata, dest.iata)}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-5 text-center bg-gray-800 text-white py-2.5 rounded-lg
                     font-semibold text-sm hover:bg-gray-700 transition-colors"
        >
          Search Flights →
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add the slide-in animation to globals.css**

Add to `src/app/globals.css` (after the existing Tailwind directives):
```css
@keyframes slide-in {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

.animate-slide-in {
  animation: slide-in 0.2s ease-out;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/RouteDetailPanel.tsx src/app/globals.css
git commit -m "feat: add route detail panel with slide-in animation"
```

---

### Task 9: Flight Map Component

**Files:**
- Create: `src/components/FlightMap.tsx`

This is the largest component — renders the Mapbox map, route arcs, destination dots, handles selection and filtering.

- [ ] **Step 1: Build the map component**

Create `src/components/FlightMap.tsx`:
```tsx
"use client";

import { useRef, useEffect, useCallback } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { AirportRoutes, Route } from "@/lib/types";
import { greatCircleArc } from "@/lib/geo";
import { getAirlineColor } from "@/lib/airlines";

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";

interface FlightMapProps {
  routeData: AirportRoutes | null;
  activeFilters: Set<string>;
  selectedRoute: Route | null;
  onSelectRoute: (route: Route | null) => void;
}

const SOURCE_ARCS = "route-arcs";
const SOURCE_DOTS = "route-dots";
const LAYER_ARCS = "route-arc-lines";
const LAYER_ARCS_HIGHLIGHT = "route-arc-highlight";
const LAYER_DOTS = "route-dot-circles";
const LAYER_DOTS_HIGHLIGHT = "route-dot-highlight";

function buildArcFeatures(routeData: AirportRoutes, activeFilters: Set<string>) {
  const origin = routeData.airport;

  return routeData.routes
    .filter((route) => route.airlines.some((a) => activeFilters.has(a.code)))
    .map((route) => {
      // Use the most prominent active airline's color
      const primaryAirline = route.airlines.find((a) => activeFilters.has(a.code))!;
      const coords = greatCircleArc(
        [origin.lon, origin.lat],
        [route.destination.lon, route.destination.lat]
      );

      return {
        type: "Feature" as const,
        properties: {
          destIata: route.destination.iata,
          color: getAirlineColor(primaryAirline.code),
        },
        geometry: {
          type: "LineString" as const,
          coordinates: coords,
        },
      };
    });
}

function buildDotFeatures(routeData: AirportRoutes, activeFilters: Set<string>) {
  return routeData.routes
    .filter((route) => route.airlines.some((a) => activeFilters.has(a.code)))
    .map((route) => {
      const primaryAirline = route.airlines.find((a) => activeFilters.has(a.code))!;
      return {
        type: "Feature" as const,
        properties: {
          destIata: route.destination.iata,
          color: getAirlineColor(primaryAirline.code),
          name: route.destination.city,
        },
        geometry: {
          type: "Point" as const,
          coordinates: [route.destination.lon, route.destination.lat],
        },
      };
    });
}

export default function FlightMap({
  routeData,
  activeFilters,
  selectedRoute,
  onSelectRoute,
}: FlightMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const readyRef = useRef(false);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: [-98.5, 39.8], // Center of US
      zoom: 3.5,
    });

    map.addControl(new mapboxgl.NavigationControl(), "bottom-right");

    map.on("load", () => {
      // Add empty sources
      map.addSource(SOURCE_ARCS, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource(SOURCE_DOTS, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Arc lines (dimmed when route selected)
      map.addLayer({
        id: LAYER_ARCS,
        type: "line",
        source: SOURCE_ARCS,
        paint: {
          "line-color": ["get", "color"],
          "line-width": 1.5,
          "line-opacity": 0.6,
        },
      });

      // Highlighted arc
      map.addLayer({
        id: LAYER_ARCS_HIGHLIGHT,
        type: "line",
        source: SOURCE_ARCS,
        paint: {
          "line-color": ["get", "color"],
          "line-width": 3,
          "line-opacity": 1,
        },
        filter: ["==", ["get", "destIata"], ""],
      });

      // Destination dots
      map.addLayer({
        id: LAYER_DOTS,
        type: "circle",
        source: SOURCE_DOTS,
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            3, 3,
            6, 5,
            10, 7,
          ],
          "circle-opacity": 0.7,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#ffffff",
        },
      });

      // Highlighted dot
      map.addLayer({
        id: LAYER_DOTS_HIGHLIGHT,
        type: "circle",
        source: SOURCE_DOTS,
        paint: {
          "circle-color": ["get", "color"],
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            3, 5,
            6, 7,
            10, 9,
          ],
          "circle-opacity": 1,
          "circle-stroke-width": 2,
          "circle-stroke-color": "#ffffff",
        },
        filter: ["==", ["get", "destIata"], ""],
      });

      readyRef.current = true;
    });

    // Click on destination dot
    map.on("click", LAYER_DOTS, (e) => {
      if (!e.features?.length || !routeData) return;
      const destIata = e.features[0].properties?.destIata;
      const route = routeData.routes.find(
        (r) => r.destination.iata === destIata
      );
      if (route) onSelectRoute(route);
    });

    // Click on map (not on a dot) — deselect
    map.on("click", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [LAYER_DOTS],
      });
      if (!features.length) onSelectRoute(null);
    });

    // Cursor change on hover
    map.on("mouseenter", LAYER_DOTS, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", LAYER_DOTS, () => {
      map.getCanvas().style.cursor = "";
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Update route data on the map
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    if (!routeData) {
      (map.getSource(SOURCE_ARCS) as mapboxgl.GeoJSONSource)?.setData({
        type: "FeatureCollection",
        features: [],
      });
      (map.getSource(SOURCE_DOTS) as mapboxgl.GeoJSONSource)?.setData({
        type: "FeatureCollection",
        features: [],
      });
      return;
    }

    const arcFeatures = buildArcFeatures(routeData, activeFilters);
    const dotFeatures = buildDotFeatures(routeData, activeFilters);

    (map.getSource(SOURCE_ARCS) as mapboxgl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: arcFeatures,
    });
    (map.getSource(SOURCE_DOTS) as mapboxgl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: dotFeatures,
    });

    // Fly to the selected airport
    map.flyTo({
      center: [routeData.airport.lon, routeData.airport.lat],
      zoom: 4.5,
      duration: 1000,
    });
  }, [routeData, activeFilters]);

  // Handle route selection highlighting
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    if (selectedRoute) {
      const destIata = selectedRoute.destination.iata;

      // Dim all arcs/dots, highlight selected
      map.setPaintProperty(LAYER_ARCS, "line-opacity", 0.15);
      map.setPaintProperty(LAYER_DOTS, "circle-opacity", 0.15);
      map.setFilter(LAYER_ARCS_HIGHLIGHT, ["==", ["get", "destIata"], destIata]);
      map.setFilter(LAYER_DOTS_HIGHLIGHT, ["==", ["get", "destIata"], destIata]);
    } else {
      // Restore all
      map.setPaintProperty(LAYER_ARCS, "line-opacity", 0.6);
      map.setPaintProperty(LAYER_DOTS, "circle-opacity", 0.7);
      map.setFilter(LAYER_ARCS_HIGHLIGHT, ["==", ["get", "destIata"], ""]);
      map.setFilter(LAYER_DOTS_HIGHLIGHT, ["==", ["get", "destIata"], ""]);
    }
  }, [selectedRoute]);

  return <div ref={containerRef} className="w-full h-full" />;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/FlightMap.tsx
git commit -m "feat: add FlightMap component with arc rendering and selection"
```

---

### Task 10: Footer Component

**Files:**
- Create: `src/components/Footer.tsx`

- [ ] **Step 1: Build the footer**

Create `src/components/Footer.tsx`:
```tsx
interface FooterProps {
  lastUpdated: string | null;
}

export default function Footer({ lastUpdated }: FooterProps) {
  return (
    <div className="absolute bottom-2 left-3 text-xs text-gray-400 z-10">
      {lastUpdated && <>Last updated: {lastUpdated}</>}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Footer.tsx
git commit -m "feat: add footer with last updated timestamp"
```

---

### Task 11: Assemble the Home Page

**Files:**
- Modify: `src/app/page.tsx`

This wires everything together — search, map, filters, panel, footer.

- [ ] **Step 1: Build the home page**

Replace `src/app/page.tsx` with:
```tsx
"use client";

import { useState, useMemo, useCallback } from "react";
import type { AirportIndex, Route } from "@/lib/types";
import { useRouteData } from "@/hooks/useRouteData";
import FlightMap from "@/components/FlightMap";
import AirportSearch from "@/components/AirportSearch";
import AirlineFilters from "@/components/AirlineFilters";
import RouteDetailPanel from "@/components/RouteDetailPanel";
import Footer from "@/components/Footer";

export default function Home() {
  const [selectedAirport, setSelectedAirport] = useState<AirportIndex | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());

  const { data: routeData, loading } = useRouteData(selectedAirport?.iata ?? null);

  // Extract unique airlines from route data, sorted by number of routes served
  const airlines = useMemo(() => {
    if (!routeData) return [];

    const airlineMap = new Map<string, { code: string; name: string; count: number }>();
    for (const route of routeData.routes) {
      for (const airline of route.airlines) {
        const existing = airlineMap.get(airline.code);
        if (existing) {
          existing.count++;
        } else {
          airlineMap.set(airline.code, {
            code: airline.code,
            name: airline.name,
            count: 1,
          });
        }
      }
    }

    return Array.from(airlineMap.values()).sort((a, b) => b.count - a.count);
  }, [routeData]);

  // When route data loads, activate all airline filters
  const handleAirportSelect = useCallback((airport: AirportIndex) => {
    setSelectedAirport(airport);
    setSelectedRoute(null);
    setActiveFilters(new Set()); // Will be populated when routeData loads
  }, []);

  // Set all filters active when data first loads
  useMemo(() => {
    if (airlines.length > 0 && activeFilters.size === 0) {
      setActiveFilters(new Set(airlines.map((a) => a.code)));
    }
  }, [airlines]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleFilterToggle = useCallback((code: string) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(code)) {
        next.delete(code);
      } else {
        next.add(code);
      }
      return next;
    });
  }, []);

  return (
    <main className="h-screen w-screen relative overflow-hidden">
      {/* Map */}
      <FlightMap
        routeData={routeData}
        activeFilters={activeFilters}
        selectedRoute={selectedRoute}
        onSelectRoute={setSelectedRoute}
      />

      {/* Search + Filters overlay */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
        <AirportSearch onSelect={handleAirportSelect} selected={selectedAirport} />
        {routeData && (
          <AirlineFilters
            airlines={airlines}
            activeFilters={activeFilters}
            onToggle={handleFilterToggle}
          />
        )}
      </div>

      {/* Loading indicator */}
      {loading && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-20
                        bg-white rounded-lg px-4 py-2 shadow-md text-sm text-gray-500">
          Loading routes...
        </div>
      )}

      {/* Detail panel */}
      {selectedRoute && routeData && (
        <RouteDetailPanel
          route={selectedRoute}
          origin={routeData.airport}
          onClose={() => setSelectedRoute(null)}
        />
      )}

      {/* Footer */}
      <Footer lastUpdated={routeData?.last_updated ?? null} />
    </main>
  );
}
```

- [ ] **Step 2: Update layout.tsx metadata**

Replace `src/app/layout.tsx` with:
```tsx
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Flight Routes — Nonstop Destinations from Any Airport",
  description:
    "Interactive map of nonstop flight routes from US airports. See where you can fly, filter by airline, explore destinations.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 3: Verify it builds**

```bash
cd /Users/brianfranklin/flight-routes
npm run build
```

Expected: Builds successfully (may warn about missing data files — that's fine).

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx src/app/layout.tsx
git commit -m "feat: assemble home page with all components"
```

---

### Task 12: Download Data and Generate JSON

**Files:**
- Modify: `scripts/raw/` (downloaded CSVs)
- Create: `public/data/airports.json`, `public/data/routes/*.json`

- [ ] **Step 1: Download BTS T-100 Domestic data**

Go to https://transtats.bts.gov/DL_SelectFields.aspx?gnoession_VQ=FMF

1. Under "Filter Geography": leave as "All"
2. Under "Filter Year": select most recent year available (e.g., 2025)
3. Under "Filter Period": select all months available
4. Check these fields: ORIGIN, DEST, UNIQUE_CARRIER, CARRIER_NAME, DEPARTURES_PERFORMED, SEATS, PASSENGERS, MONTH, YEAR
5. Click "Download" → save as `scripts/raw/t100_domestic.csv`

- [ ] **Step 2: Download BTS T-100 International data**

Go to https://transtats.bts.gov/DL_SelectFields.aspx?gnoession_VQ=FIL

Same field selections as above. Save as `scripts/raw/t100_international.csv`.

- [ ] **Step 3: Run the processing script**

```bash
cd /Users/brianfranklin/flight-routes
python scripts/process_data.py
```

Expected output:
```
Downloading OurAirports data...
Loaded ~4000 airports from OurAirports
Loaded N T-100 segment records
Processing N origin airports...
Wrote N airports to public/data/airports.json
Wrote route files for N origin airports to public/data/routes
Done!
```

- [ ] **Step 4: Verify generated data**

```bash
# Check airports index
cat public/data/airports.json | python -m json.tool | head -20

# Check a specific airport
cat public/data/routes/ord.json | python -m json.tool | head -40

# Count files
ls public/data/routes/ | wc -l
```

Expected: airports.json has entries, ord.json has routes with airlines, 200-400 route files.

- [ ] **Step 5: Commit data files**

```bash
git add public/data/
git commit -m "feat: add processed route data from BTS T-100"
```

---

### Task 13: End-to-End Test in Browser

- [ ] **Step 1: Start dev server and test**

```bash
cd /Users/brianfranklin/flight-routes
npm run dev
```

Open http://localhost:3000 and verify:
1. Map loads with light style, centered on US
2. Search bar appears, type "ORD" — autocomplete shows Chicago O'Hare
3. Select ORD — map flies to Chicago, arcs fan out to all destinations
4. Airline filter pills appear — toggle one off, routes disappear/reappear
5. Click a destination dot — other routes dim, detail panel slides in
6. Panel shows correct airline info, distance, passengers, "Search Flights" link works
7. Click X — panel closes, routes restore
8. Search a different airport — everything resets

- [ ] **Step 2: Fix any issues found during testing**

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: address issues found in e2e testing"
```

---

### Task 14: GitHub Action for Weekly Refresh

**Files:**
- Create: `scripts/refresh_aerodatabox.py`, `.github/workflows/refresh-routes.yml`

- [ ] **Step 1: Write the AeroDataBox refresh script**

Create `scripts/refresh_aerodatabox.py`:
```python
"""
Weekly supplement: fetch fresh route data from AeroDataBox API
for the top airports and merge into existing JSON files.

Usage:
    AERODATABOX_KEY=your_key python scripts/refresh_aerodatabox.py

Requires AERODATABOX_KEY environment variable (RapidAPI key).
"""

import json
import os
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

# ICAO to IATA mapping for these airports
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
        print("ERROR: Set AERODATABOX_KEY environment variable")
        return

    print(f"Refreshing routes for {len(TOP_AIRPORTS)} airports...")

    for icao in TOP_AIRPORTS:
        iata = ICAO_TO_IATA.get(icao, icao)
        print(f"Fetching {iata} ({icao})...")
        routes = fetch_routes(icao)
        if routes:
            merge_routes(icao, routes)

    print("Done!")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Create the GitHub Action workflow**

Create `.github/workflows/refresh-routes.yml`:
```yaml
name: Weekly Route Refresh

on:
  schedule:
    - cron: "0 6 * * 1"  # Every Monday at 6am UTC
  workflow_dispatch: # Allow manual trigger

jobs:
  refresh:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"

      - name: Install dependencies
        run: pip install requests

      - name: Run AeroDataBox refresh
        env:
          AERODATABOX_KEY: ${{ secrets.AERODATABOX_KEY }}
        run: python scripts/refresh_aerodatabox.py

      - name: Commit and push if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git add public/data/
          git diff --staged --quiet || git commit -m "chore: weekly route data refresh"
          git push
```

- [ ] **Step 3: Commit**

```bash
git add scripts/refresh_aerodatabox.py .github/workflows/refresh-routes.yml
git commit -m "feat: add weekly AeroDataBox refresh script and GitHub Action"
```

---

### Task 15: Deploy to Vercel

- [ ] **Step 1: Create GitHub repo**

```bash
cd /Users/brianfranklin/flight-routes
gh repo create flight-routes --public --source=. --push
```

- [ ] **Step 2: Connect to Vercel**

```bash
cd /Users/brianfranklin/flight-routes
npx vercel link
```

Follow the prompts to connect to your Vercel account.

- [ ] **Step 3: Set environment variable on Vercel**

```bash
npx vercel env add NEXT_PUBLIC_MAPBOX_TOKEN
```

Enter your Mapbox token when prompted.

- [ ] **Step 4: Deploy**

```bash
npx vercel --prod
```

- [ ] **Step 5: Verify deployment**

Open the Vercel URL and run through the same checks from Task 13.

- [ ] **Step 6: Add AERODATABOX_KEY secret to GitHub repo**

```bash
gh secret set AERODATABOX_KEY
```

Enter your RapidAPI key when prompted. This enables the weekly GitHub Action.
