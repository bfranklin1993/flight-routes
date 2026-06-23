"use client";

import { useRef, useEffect } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { AirportRoutes, Route } from "@/lib/types";
import { greatCircleArc } from "@/lib/geo";
import { getAirlineColor } from "@/lib/airlines";
import { getNewRoutes, isNewRoute } from "@/lib/routes";

interface FlightMapProps {
  routeData: AirportRoutes | null;
  selectedAirline: string | null;
  selectedRoute: Route | null;
  onSelectRoute: (route: Route | null) => void;
}

const SOURCE_ARCS = "route-arcs";
const SOURCE_DOTS = "route-dots";
const SOURCE_ORIGIN = "origin-marker";
const SOURCE_NEW_ARCS = "new-route-arcs";
const SOURCE_NEW_DOTS = "new-route-dots";
const LAYER_ARCS = "route-arc-lines";
const LAYER_ARCS_HIGHLIGHT = "route-arc-highlight";
const LAYER_DOTS = "route-dot-circles";
const LAYER_DOTS_HIGHLIGHT = "route-dot-highlight";
const LAYER_ORIGIN = "origin-marker-circle";
const LAYER_NEW_ARCS = "new-route-arc-lines";
const LAYER_NEW_ARCS_HIGHLIGHT = "new-route-arc-highlight";
const LAYER_NEW_DOTS = "new-route-diamonds";
const NEW_ROUTE_COLOR = "#FF5A1F";
const DIAMOND_ICON = "new-route-diamond";

/** Draw an orange diamond with a white edge into a canvas for map.addImage. */
function makeDiamondIcon(size = 18): ImageData | null {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const c = size / 2;
  // white outline diamond (slightly larger)
  ctx.beginPath();
  ctx.moveTo(c, 1);
  ctx.lineTo(size - 1, c);
  ctx.lineTo(c, size - 1);
  ctx.lineTo(1, c);
  ctx.closePath();
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  // orange diamond inset
  const inset = 2.5;
  ctx.beginPath();
  ctx.moveTo(c, inset);
  ctx.lineTo(size - inset, c);
  ctx.lineTo(c, size - inset);
  ctx.lineTo(inset, c);
  ctx.closePath();
  ctx.fillStyle = NEW_ROUTE_COLOR;
  ctx.fill();
  return ctx.getImageData(0, 0, size, size);
}

function buildNewArcFeatures(routeData: AirportRoutes) {
  const origin = routeData.airport;
  return getNewRoutes(routeData).map((route) => {
    const coords = greatCircleArc(
      [origin.lon, origin.lat],
      [route.destination.lon, route.destination.lat]
    );
    return {
      type: "Feature" as const,
      properties: { destIata: route.destination.iata },
      geometry: { type: "LineString" as const, coordinates: coords },
    };
  });
}

function buildNewDotFeatures(routeData: AirportRoutes) {
  return getNewRoutes(routeData).map((route) => ({
    type: "Feature" as const,
    properties: {
      destIata: route.destination.iata,
      name: route.destination.city,
    },
    geometry: {
      type: "Point" as const,
      coordinates: [route.destination.lon, route.destination.lat],
    },
  }));
}

function buildArcFeatures(routeData: AirportRoutes, selectedAirline: string | null) {
  const origin = routeData.airport;

  return routeData.routes
    .filter((route) => route.airlines.reduce((s, a) => s + a.weekly_flights, 0) > 0)
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
    .filter((route) => route.airlines.reduce((s, a) => s + a.weekly_flights, 0) > 0)
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
      map.addSource(SOURCE_NEW_ARCS, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });
      map.addSource(SOURCE_NEW_DOTS, {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
      });

      // Diamond icon for new/seasonal route markers (colorblind-safe shape).
      let hasDiamond = false;
      if (!map.hasImage(DIAMOND_ICON)) {
        const icon = makeDiamondIcon(18);
        if (icon) {
          map.addImage(DIAMOND_ICON, icon, { pixelRatio: 2 });
          hasDiamond = true;
        }
      } else {
        hasDiamond = true;
      }

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

      // New/seasonal route dashed orange arcs (drawn under the origin marker).
      map.addLayer(
        {
          id: LAYER_NEW_ARCS,
          type: "line",
          source: SOURCE_NEW_ARCS,
          paint: {
            "line-color": NEW_ROUTE_COLOR,
            "line-width": 2.2,
            "line-opacity": 0.85,
            "line-dasharray": [1.5, 2],
          },
        },
        LAYER_ORIGIN
      );

      map.addLayer(
        {
          id: LAYER_NEW_ARCS_HIGHLIGHT,
          type: "line",
          source: SOURCE_NEW_ARCS,
          paint: {
            "line-color": NEW_ROUTE_COLOR,
            "line-width": 3.4,
            "line-opacity": 1,
            "line-dasharray": [1.5, 1.5],
          },
          filter: ["==", ["get", "destIata"], ""],
        },
        LAYER_ORIGIN
      );

      // New/seasonal route destination markers: diamond symbols when the icon
      // is available, otherwise a clearly distinct orange circle fallback.
      if (hasDiamond) {
        map.addLayer({
          id: LAYER_NEW_DOTS,
          type: "symbol",
          source: SOURCE_NEW_DOTS,
          layout: {
            "icon-image": DIAMOND_ICON,
            "icon-allow-overlap": true,
            "icon-size": [
              "interpolate", ["linear"], ["zoom"],
              3, 0.7,
              6, 0.9,
              10, 1.1,
            ],
          },
        });
      } else {
        map.addLayer({
          id: LAYER_NEW_DOTS,
          type: "circle",
          source: SOURCE_NEW_DOTS,
          paint: {
            "circle-color": NEW_ROUTE_COLOR,
            "circle-radius": [
              "interpolate", ["linear"], ["zoom"],
              3, 4,
              6, 6,
              10, 8,
            ],
            "circle-opacity": 1,
            "circle-stroke-width": 2.5,
            "circle-stroke-color": "#ffffff",
          },
        });
      }

      readyRef.current = true;
    });

    const selectByIata = (destIata: unknown) => {
      if (!routeDataRef.current || typeof destIata !== "string") return;
      const route = routeDataRef.current.routes.find(
        (r) => r.destination.iata === destIata
      );
      if (route) onSelectRoute(route);
    };

    map.on("click", LAYER_DOTS, (e) => {
      if (!e.features?.length) return;
      selectByIata(e.features[0].properties?.destIata);
    });

    map.on("click", LAYER_NEW_DOTS, (e) => {
      if (!e.features?.length) return;
      selectByIata(e.features[0].properties?.destIata);
    });

    map.on("click", (e) => {
      const features = map.queryRenderedFeatures(e.point, {
        layers: [LAYER_DOTS, LAYER_NEW_DOTS].filter((id) => map.getLayer(id)),
      });
      if (!features.length) onSelectRoute(null);
    });

    const setPointer = () => {
      map.getCanvas().style.cursor = "pointer";
    };
    const clearPointer = () => {
      map.getCanvas().style.cursor = "";
    };
    map.on("mouseenter", LAYER_DOTS, setPointer);
    map.on("mouseleave", LAYER_DOTS, clearPointer);
    map.on("mouseenter", LAYER_NEW_DOTS, setPointer);
    map.on("mouseleave", LAYER_NEW_DOTS, clearPointer);

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
      (map.getSource(SOURCE_NEW_ARCS) as maplibregl.GeoJSONSource)?.setData({
        type: "FeatureCollection",
        features: [],
      });
      (map.getSource(SOURCE_NEW_DOTS) as maplibregl.GeoJSONSource)?.setData({
        type: "FeatureCollection",
        features: [],
      });
      return;
    }

    const arcFeatures = buildArcFeatures(routeData, selectedAirline);
    const dotFeatures = buildDotFeatures(routeData, selectedAirline);
    // New/seasonal routes have empty airline codes, so they only show when no
    // specific airline filter is active.
    const showNew = !selectedAirline;
    const newArcFeatures = showNew ? buildNewArcFeatures(routeData) : [];
    const newDotFeatures = showNew ? buildNewDotFeatures(routeData) : [];

    (map.getSource(SOURCE_ARCS) as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: arcFeatures,
    });
    (map.getSource(SOURCE_DOTS) as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: dotFeatures,
    });
    (map.getSource(SOURCE_NEW_ARCS) as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: newArcFeatures,
    });
    (map.getSource(SOURCE_NEW_DOTS) as maplibregl.GeoJSONSource)?.setData({
      type: "FeatureCollection",
      features: newDotFeatures,
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

    const setNewArcOpacity = (value: number) => {
      if (map.getLayer(LAYER_NEW_ARCS)) {
        map.setPaintProperty(LAYER_NEW_ARCS, "line-opacity", value);
      }
    };
    const setNewDotOpacity = (value: number) => {
      if (!map.getLayer(LAYER_NEW_DOTS)) return;
      const prop =
        map.getLayer(LAYER_NEW_DOTS)!.type === "symbol"
          ? "icon-opacity"
          : "circle-opacity";
      map.setPaintProperty(LAYER_NEW_DOTS, prop, value);
    };

    if (selectedRoute) {
      const destIata = selectedRoute.destination.iata;
      const isNew = isNewRoute(selectedRoute);

      // Dim everything else.
      map.setPaintProperty(LAYER_ARCS, "line-opacity", 0.15);
      map.setPaintProperty(LAYER_DOTS, "circle-opacity", 0.15);

      if (isNew) {
        // Emphasize the selected new arc, dim other new arcs/diamonds.
        setNewArcOpacity(0.15);
        setNewDotOpacity(0.25);
        map.setFilter(LAYER_NEW_ARCS_HIGHLIGHT, ["==", ["get", "destIata"], destIata]);
        // Established highlights stay hidden.
        map.setFilter(LAYER_ARCS_HIGHLIGHT, ["==", ["get", "destIata"], ""]);
        map.setFilter(LAYER_DOTS_HIGHLIGHT, ["==", ["get", "destIata"], ""]);

        // Frame origin -> destination smoothly.
        const origin = routeDataRef.current?.airport;
        const dest = selectedRoute.destination;
        if (origin) {
          const bounds = new maplibregl.LngLatBounds(
            [origin.lon, origin.lat],
            [origin.lon, origin.lat]
          );
          bounds.extend([dest.lon, dest.lat]);
          map.fitBounds(bounds, { padding: 110, duration: 900, maxZoom: 6 });
        }
      } else {
        // Established route selected: keep new layer dimmed but visible.
        setNewArcOpacity(0.18);
        setNewDotOpacity(0.3);
        map.setFilter(LAYER_NEW_ARCS_HIGHLIGHT, ["==", ["get", "destIata"], ""]);
        map.setFilter(LAYER_ARCS_HIGHLIGHT, ["==", ["get", "destIata"], destIata]);
        map.setFilter(LAYER_DOTS_HIGHLIGHT, ["==", ["get", "destIata"], destIata]);
      }
    } else {
      map.setPaintProperty(LAYER_ARCS, "line-opacity", 0.6);
      map.setPaintProperty(LAYER_DOTS, "circle-opacity", 0.7);
      map.setFilter(LAYER_ARCS_HIGHLIGHT, ["==", ["get", "destIata"], ""]);
      map.setFilter(LAYER_DOTS_HIGHLIGHT, ["==", ["get", "destIata"], ""]);
      setNewArcOpacity(0.85);
      setNewDotOpacity(1);
      map.setFilter(LAYER_NEW_ARCS_HIGHLIGHT, ["==", ["get", "destIata"], ""]);
    }
  }, [selectedRoute]);

  return <div ref={containerRef} className="w-full h-full" />;
}
