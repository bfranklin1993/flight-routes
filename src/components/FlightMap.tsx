"use client";

import { useRef, useEffect, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AirportRoutes, Route } from "@/lib/types";
import { greatCircleArc } from "@/lib/geo";
import { getAirlineColor, getFocusColor } from "@/lib/airlines";

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

/**
 * Weekly flights carried on a route, scoped to the active filter when there is
 * one. This drives line width and dot size, so volume reads without relying on
 * colour.
 */
function weeklyFlightsFor(
  route: AirportRoutes["routes"][number],
  selectedAirline: string | null
): number {
  if (selectedAirline) {
    return route.airlines.find((a) => a.code === selectedAirline)?.weekly_flights ?? 0;
  }
  return route.airlines.reduce((s, a) => s + a.weekly_flights, 0);
}

/**
 * Colour for a route. When a carrier is filtered every visible arc belongs to
 * it, so we use the emphasis colour rather than the shared "other" grey.
 */
function routeColorFor(
  route: AirportRoutes["routes"][number],
  selectedAirline: string | null
): string {
  if (selectedAirline) return getFocusColor(selectedAirline);
  return getAirlineColor(route.airlines[0].code);
}

/**
 * Shift a longitude into the same 360-degree window as the origin.
 *
 * Without this, bounds for a Pacific hub span the long way round the globe:
 * HNL at -157.9 plus Tokyo at +139.8 reads as a 297-degree box through
 * Greenwich rather than the short hop across the Pacific.
 */
function normalizeLon(lon: number, originLon: number): number {
  let result = lon;
  while (result - originLon > 180) result -= 360;
  while (result - originLon < -180) result += 360;
  return result;
}

/**
 * Bounds covering the origin and every visible destination, so the camera frames
 * the actual answer instead of a fixed zoom that cuts off long-haul routes.
 */
function boundsFor(routeData: AirportRoutes, selectedAirline: string | null) {
  const origin = routeData.airport;
  const bounds = new maplibregl.LngLatBounds(
    [origin.lon, origin.lat],
    [origin.lon, origin.lat]
  );
  for (const route of visibleRoutes(routeData, selectedAirline)) {
    bounds.extend([
      normalizeLon(route.destination.lon, origin.lon),
      route.destination.lat,
    ]);
  }
  return bounds;
}

function visibleRoutes(routeData: AirportRoutes, selectedAirline: string | null) {
  return routeData.routes
    .filter((route) => route.airlines.reduce((s, a) => s + a.weekly_flights, 0) > 0)
    .filter((route) =>
      !selectedAirline || route.airlines.some((a) => a.code === selectedAirline)
    );
}

function buildArcFeatures(routeData: AirportRoutes, selectedAirline: string | null) {
  const origin = routeData.airport;

  return visibleRoutes(routeData, selectedAirline).map((route) => {
    const coords = greatCircleArc(
      [origin.lon, origin.lat],
      [route.destination.lon, route.destination.lat]
    );

    return {
      type: "Feature" as const,
      properties: {
        destIata: route.destination.iata,
        color: routeColorFor(route, selectedAirline),
        weeklyFlights: weeklyFlightsFor(route, selectedAirline),
      },
      geometry: {
        type: "LineString" as const,
        coordinates: coords,
      },
    };
  });
}

function buildDotFeatures(routeData: AirportRoutes, selectedAirline: string | null) {
  return visibleRoutes(routeData, selectedAirline).map((route) => ({
    type: "Feature" as const,
    properties: {
      destIata: route.destination.iata,
      color: routeColorFor(route, selectedAirline),
      weeklyFlights: weeklyFlightsFor(route, selectedAirline),
      name: route.destination.city,
    },
    geometry: {
      type: "Point" as const,
      coordinates: [route.destination.lon, route.destination.lat],
    },
  }));
}

export default function FlightMap({
  routeData,
  selectedAirline,
  selectedRoute,
  onSelectRoute,
}: FlightMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const routeDataRef = useRef<AirportRoutes | null>(routeData);
  const selectedAirlineRef = useRef<string | null>(selectedAirline);
  const selectedRouteRef = useRef<Route | null>(selectedRoute);

  // Kept in sync so the map's own "load" handler, and the click handlers
  // registered once at init, can read current values. Declared before the
  // effects that call apply* below: effects run in declaration order, so these
  // are always up to date by the time the map is written to.
  useEffect(() => {
    routeDataRef.current = routeData;
  }, [routeData]);
  useEffect(() => {
    selectedAirlineRef.current = selectedAirline;
  }, [selectedAirline]);
  useEffect(() => {
    selectedRouteRef.current = selectedRoute;
  }, [selectedRoute]);

  /**
   * Write route data onto the map.
   *
   * Callable from both the data effect and the map's "load" handler. Route JSON
   * is a small same-origin file off the CDN, while the map style, glyphs and
   * sprites come cross-origin, so the data almost always wins the race. The
   * previous implementation guarded on a ready ref and returned; because
   * mutating a ref triggers no re-render, the effect never ran again and the map
   * stayed empty until some unrelated state change re-triggered it.
   */
  const applyRouteData = useCallback(() => {
    const map = mapRef.current;
    // Sources only exist once "load" has run; that handler calls this itself.
    if (!map || !map.getSource(SOURCE_ARCS)) return;

    const routeData = routeDataRef.current;
    const selectedAirline = selectedAirlineRef.current;

    const arcs = map.getSource(SOURCE_ARCS) as maplibregl.GeoJSONSource;
    const dots = map.getSource(SOURCE_DOTS) as maplibregl.GeoJSONSource;
    const origin = map.getSource(SOURCE_ORIGIN) as maplibregl.GeoJSONSource;

    if (!routeData) {
      const empty = { type: "FeatureCollection" as const, features: [] };
      arcs?.setData(empty);
      dots?.setData(empty);
      origin?.setData(empty);
      return;
    }

    arcs?.setData({
      type: "FeatureCollection",
      features: buildArcFeatures(routeData, selectedAirline),
    });
    dots?.setData({
      type: "FeatureCollection",
      features: buildDotFeatures(routeData, selectedAirline),
    });
    origin?.setData({
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

    // Frame the origin plus every visible destination. A fixed zoom cut off the
    // answer the page promises: ORD's long-haul routes ran off all four edges,
    // and HNL showed open ocean with no destination visible at all. Extra top
    // padding clears the search bar and airline pills.
    map.fitBounds(boundsFor(routeData, selectedAirline), {
      padding: { top: 170, bottom: 70, left: 60, right: 60 },
      maxZoom: 6,
      duration: 1000,
    });
  }, []);

  /** Dim everything except the selected route. Same load-race fix as above. */
  const applyHighlight = useCallback(() => {
    const map = mapRef.current;
    if (!map || !map.getLayer(LAYER_ARCS)) return;

    const selectedRoute = selectedRouteRef.current;
    const destIata = selectedRoute?.destination.iata ?? "";

    map.setPaintProperty(LAYER_ARCS, "line-opacity", selectedRoute ? 0.15 : 0.6);
    map.setPaintProperty(LAYER_DOTS, "circle-opacity", selectedRoute ? 0.15 : 0.7);
    map.setFilter(LAYER_ARCS_HIGHLIGHT, ["==", ["get", "destIata"], destIata]);
    map.setFilter(LAYER_DOTS_HIGHLIGHT, ["==", ["get", "destIata"], destIata]);
  }, []);

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
          // Width carries route volume, so the map reads without relying on
          // colour alone and shows which routes are actually significant.
          "line-width": [
            "interpolate", ["linear"], ["get", "weeklyFlights"],
            1, 0.8,
            20, 1.6,
            80, 2.8,
            250, 4.5,
          ],
          "line-opacity": 0.6,
        },
      });

      map.addLayer({
        id: LAYER_ARCS_HIGHLIGHT,
        type: "line",
        source: SOURCE_ARCS,
        paint: {
          "line-color": ["get", "color"],
          "line-width": [
            "interpolate", ["linear"], ["get", "weeklyFlights"],
            1, 2.5,
            20, 3.5,
            80, 5,
            250, 7,
          ],
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
          // Radius scales with volume as well as zoom, matching the arcs.
          "circle-radius": [
            "interpolate", ["linear"], ["zoom"],
            3, ["interpolate", ["linear"], ["get", "weeklyFlights"], 1, 2, 250, 5],
            6, ["interpolate", ["linear"], ["get", "weeklyFlights"], 1, 3.5, 250, 8],
            10, ["interpolate", ["linear"], ["get", "weeklyFlights"], 1, 5, 250, 11],
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

      // Data may already have arrived before the style finished loading, so
      // apply whatever we have now rather than waiting for another change.
      applyRouteData();
      applyHighlight();
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
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    applyRouteData();
  }, [routeData, selectedAirline, applyRouteData]);

  useEffect(() => {
    applyHighlight();
  }, [selectedRoute, applyHighlight]);

  return <div ref={containerRef} className="w-full h-full" />;
}
