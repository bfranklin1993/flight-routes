# Flight Route Map — Design Spec

## Overview

An interactive web app that visualizes nonstop commercial flight routes from any US airport. Users select an airport, see all destinations on a map with arcs, filter by airline, and click a destination to see route details. Clean, minimal design — portfolio piece that's also personally useful.

## Core UX Flow

1. User lands on the site → clean map (US-centered) with a search bar top-center
2. Type or select an airport (e.g., "ORD - Chicago O'Hare") via autocomplete
3. Map zooms to that airport, great circle arcs fan out to every nonstop destination
4. Airline filter pills appear below the search bar — one per airline serving that airport, color-coded. Click to toggle airlines on/off
5. Destination dots are small circles that grow slightly on hover
6. Click a destination dot → map dims all other routes to ~20% opacity, highlights the selected arc, and a detail panel slides in from the right
7. Detail panel shows: destination airport name, airlines serving the route (with frequency), distance, annual passengers, and a "Search Flights" link (Google Flights with pre-filled origin/dest)
8. Click X or click elsewhere on the map to dismiss the panel and restore all routes
9. "Last updated" timestamp in the footer

## Visual Design

- **Style:** Clean and minimal, light background
- **Map:** Mapbox GL JS with `light-v11` style
- **Route arcs:** Great circle curves (not straight lines), thin lines with airline color coding
- **Airline colors:** Match real brand colors (United blue, American red, Southwest orange, etc.)
- **Selected state:** Bold/bright selected arc, everything else fades to ~20% opacity
- **Detail panel:** Slides in from the right, white background, doesn't obstruct the map
- **Desktop-first:** Responsive layout but map interactions optimized for desktop

## Data Sources

### Primary: BTS T-100 Segment Data
- Source: Bureau of Transportation Statistics (transtats.bts.gov)
- Contains: Every nonstop segment flown by US carriers — origin, destination, airline, departures, seats, passengers
- Coverage: Domestic + international from US airports
- Freshness: Quarterly release, ~6 month lag
- Cost: Free (public government data)
- Fields used: `ORIGIN`, `DEST`, `UNIQUE_CARRIER`, `CARRIER_NAME`, `DEPARTURES_PERFORMED`, `SEATS`, `PASSENGERS`, `MONTH`, `YEAR`

### Airport Metadata: OurAirports
- Source: ourairports.com/data
- Contains: Airport names, cities, IATA/ICAO codes, latitude/longitude
- Used for: Map plotting coordinates, search/autocomplete display names

### Supplemental: AeroDataBox (via RapidAPI)
- Free tier: 150 requests/month
- Used for: Weekly refresh of top 20-30 busiest airports to catch new routes not yet in T-100
- Endpoint: `GET /airports/{icao}/routes`

## Architecture

### Stack
- **Frontend:** Next.js + React + Mapbox GL JS
- **Data:** Static JSON files served from `/data` directory
- **Hosting:** Vercel (free tier)
- **Data processing:** Python script
- **CI/CD:** GitHub Actions for weekly supplemental refresh

### Data Files
- `data/airports.json` — master index of all US airports that appear in T-100 data (IATA code, name, city, lat, lon) for search/autocomplete
- `data/routes/{iata}.json` — one file per airport containing all nonstop routes with airline, frequency, and passenger data

### Route JSON Schema (per airport)
```json
{
  "airport": {
    "iata": "ORD",
    "name": "Chicago O'Hare International",
    "city": "Chicago",
    "lat": 41.9742,
    "lon": -87.9073
  },
  "routes": [
    {
      "destination": {
        "iata": "LAX",
        "name": "Los Angeles International",
        "city": "Los Angeles",
        "lat": 33.9425,
        "lon": -118.4081
      },
      "airlines": [
        {
          "code": "UA",
          "name": "United",
          "weekly_flights": 84,
          "annual_passengers": 2100000
        }
      ],
      "distance_miles": 1745,
      "total_annual_passengers": 4200000
    }
  ],
  "last_updated": "2026-03-21"
}
```

## Data Pipeline

### Initial Setup (one-time)
1. Download BTS T-100 Domestic + International CSVs for most recent 12 months
2. Download OurAirports CSV
3. Run `process_data.py` to merge and output static JSON files

### Weekly Refresh (GitHub Action)
1. Call AeroDataBox API for top 20-30 airports
2. Merge new routes into existing JSON (additive only — new routes added, nothing removed)
3. Commit updated JSON files
4. Vercel auto-deploys on commit

### Quarterly Refresh (manual)
1. Download new T-100 data from BTS
2. Run full `process_data.py` processing script
3. Commit and push — full dataset rebuilt

## Out of Scope (v1)

- No user accounts or saved airports
- No pricing/fare data
- No historical route trends
- No mobile-optimized map interactions (responsive layout, desktop-first interactions)
- No airport comparison mode (one airport at a time)
- No affiliate integration ("Search Flights" links to Google Flights directly)
