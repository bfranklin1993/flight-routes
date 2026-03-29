"use client";

import { useRef, useEffect } from "react";
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
  // Keep a ref to routeData so click handlers always see the latest value
  const routeDataRef = useRef<AirportRoutes | null>(routeData);

  // Keep routeDataRef in sync with routeData prop
  useEffect(() => {
    routeDataRef.current = routeData;
  }, [routeData]);

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

    // Click on destination dot — use routeDataRef to always get latest data
    map.on("click", LAYER_DOTS, (e) => {
      if (!e.features?.length || !routeDataRef.current) return;
      const destIata = e.features[0].properties?.destIata;
      const route = routeDataRef.current.routes.find(
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
