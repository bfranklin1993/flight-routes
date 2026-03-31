"use client";

import { useRef, useEffect } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AirportRoutes, Route } from "@/lib/types";
import { greatCircleArc } from "@/lib/geo";
import { getAirlineColor } from "@/lib/airlines";

interface FlightMapProps {
  routeData: AirportRoutes | null;
  selectedAirline: string | null;
  selectedRoute: Route | null;
  onSelectRoute: (route: Route | null) => void;
}

const SOURCE_ARCS = "route-arcs";
const SOURCE_DOTS = "route-dots";
const SOURCE_ORIGIN = "origin-marker";
const LAYER_ARCS = "route-arc-lines";
const LAYER_ARCS_HIGHLIGHT = "route-arc-highlight";
const LAYER_DOTS = "route-dot-circles";
const LAYER_DOTS_HIGHLIGHT = "route-dot-highlight";
const LAYER_ORIGIN = "origin-marker-circle";

function buildArcFeatures(routeData: AirportRoutes, selectedAirline: string | null) {
  const origin = routeData.airport;

  return routeData.routes
    .filter((route) =>
      !selectedAirline || route.airlines.some((a) => a.code === selectedAirline)
    )
    .map((route) => {
      // Use selected airline's color, or the top airline's color
      const airline = selectedAirline
        ? route.airlines.find((a) => a.code === selectedAirline)!
        : route.airlines[0];
      const coords = greatCircleArc(
        [origin.lon, origin.lat],
        [route.destination.lon, route.destination.lat]
      );

      return {
        type: "Feature" as const,
        properties: {
          destIata: route.destination.iata,
          color: getAirlineColor(airline.code),
        },
        geometry: {
          type: "LineString" as const,
          coordinates: coords,
        },
      };
    });
}

function buildDotFeatures(routeData: AirportRoutes, selectedAirline: string | null) {
  return routeData.routes
    .filter((route) =>
      !selectedAirline || route.airlines.some((a) => a.code === selectedAirline)
    )
    .map((route) => {
      const airline = selectedAirline
        ? route.airlines.find((a) => a.code === selectedAirline)!
        : route.airlines[0];
      return {
        type: "Feature" as const,
        properties: {
          destIata: route.destination.iata,
          color: getAirlineColor(airline.code),
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
  selectedAirline,
  selectedRoute,
  onSelectRoute,
}: FlightMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const routeDataRef = useRef<AirportRoutes | null>(routeData);

  useEffect(() => {
    routeDataRef.current = routeData;
  }, [routeData]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/liberty",
      center: [-98.5, 39.8],
      zoom: 3.5,
    });

    map.addControl(new maplibregl.NavigationControl(), "bottom-right");

    map.on("load", () => {
      map.addSource(SOURCE_ARCS, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource(SOURCE_DOTS, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource(SOURCE_ORIGIN, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

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

      map.addLayer({
        id: LAYER_ORIGIN,
        type: "circle",
        source: SOURCE_ORIGIN,
        paint: {
          "circle-color": "#1a1a2e",
          "circle-radius": 9,
          "circle-opacity": 1,
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffffff",
        },
      });

      readyRef.current = true;
    });

    map.on("click", LAYER_DOTS, (e) => {
      if (!e.features?.length || !routeDataRef.current) return;
      const destIata = e.features[0].properties?.destIata;
      const route = routeDataRef.current.routes.find(
        (r) => r.destination.iata === destIata
      );
      if (route) onSelectRoute(route);
    });

    map.on("click", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [LAYER_DOTS],
      });
      if (!features.length) onSelectRoute(null);
    });

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
      (map.getSource(SOURCE_ARCS) as maplibregl.GeoJSONSource)?.setData({
        type: "FeatureCollection",
        features: [],
      });
      (map.getSource(SOURCE_DOTS) as maplibregl.GeoJSONSource)?.setData({
        type: "FeatureCollection",
        features: [],
      });
      (map.getSource(SOURCE_ORIGIN) as maplibregl.GeoJSONSource)?.setData({
        type: "FeatureCollection",
        features: [],
      });
      return;
    }

    const arcFeatures = buildArcFeatures(routeData, selectedAirline);
    const dotFeatures = buildDotFeatures(routeData, selectedAirline);

    (map.getSource(SOURCE_ARCS) as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: arcFeatures,
    });
    (map.getSource(SOURCE_DOTS) as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: dotFeatures,
    });

    (map.getSource(SOURCE_ORIGIN) as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Point",
            coordinates: [routeData.airport.lon, routeData.airport.lat],
          },
        },
      ],
    });

    // Fly to the selected airport
    map.flyTo({
      center: [routeData.airport.lon, routeData.airport.lat],
      zoom: 4.5,
      duration: 1000,
    });
  }, [routeData, selectedAirline]);

  // Handle route selection highlighting
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !readyRef.current) return;

    if (selectedRoute) {
      const destIata = selectedRoute.destination.iata;
      map.setPaintProperty(LAYER_ARCS, "line-opacity", 0.15);
      map.setPaintProperty(LAYER_DOTS, "circle-opacity", 0.15);
      map.setFilter(LAYER_ARCS_HIGHLIGHT, ["==", ["get", "destIata"], destIata]);
      map.setFilter(LAYER_DOTS_HIGHLIGHT, ["==", ["get", "destIata"], destIata]);
    } else {
      map.setPaintProperty(LAYER_ARCS, "line-opacity", 0.6);
      map.setPaintProperty(LAYER_DOTS, "circle-opacity", 0.7);
      map.setFilter(LAYER_ARCS_HIGHLIGHT, ["==", ["get", "destIata"], ""]);
      map.setFilter(LAYER_DOTS_HIGHLIGHT, ["==", ["get", "destIata"], ""]);
    }
  }, [selectedRoute]);

  return <div ref={containerRef} className="w-full h-full" />;
}
