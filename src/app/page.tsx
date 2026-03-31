"use client";

import { useState, useMemo, useCallback } from "react";
import type { AirportIndex, Route } from "@/lib/types";
import { useRouteData } from "@/hooks/useRouteData";
import FlightMap from "@/components/FlightMap";
import AirportSearch from "@/components/AirportSearch";
import AirlineFilters from "@/components/AirlineFilters";
import RouteDetailPanel from "@/components/RouteDetailPanel";
import DestinationList from "@/components/DestinationList";
import Footer from "@/components/Footer";

export default function Home() {
  const [selectedAirport, setSelectedAirport] = useState<AirportIndex | null>(null);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [selectedAirline, setSelectedAirline] = useState<string | null>(null);
  const [view, setView] = useState<"map" | "list">("map");

  const { data: routeData, loading } = useRouteData(selectedAirport?.iata ?? null);

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

  const handleAirportSelect = useCallback((airport: AirportIndex) => {
    setSelectedAirport(airport);
    setSelectedRoute(null);
    setSelectedAirline(null);
  }, []);

  const handleAirlineToggle = useCallback((code: string) => {
    setSelectedAirline((prev) => (prev === code ? null : code));
    setSelectedRoute(null);
  }, []);

  const handleListRouteSelect = useCallback((route: Route) => {
    setSelectedRoute(route);
    setView("map");
  }, []);

  return (
    <main className="h-screen w-screen relative overflow-hidden">
      {/* Map */}
      <FlightMap
        routeData={routeData}
        selectedAirline={selectedAirline}
        selectedRoute={selectedRoute}
        onSelectRoute={setSelectedRoute}
      />

      {/* List view */}
      {view === "list" && routeData && (
        <DestinationList
          routeData={routeData}
          selectedAirline={selectedAirline}
          onSelectRoute={handleListRouteSelect}
        />
      )}

      {/* Top bar */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 flex flex-col items-center gap-2">
        <div className="flex gap-2 items-center">
          <AirportSearch onSelect={handleAirportSelect} selected={selectedAirport} />
          {routeData && (
            <button
              onClick={() => setView(view === "map" ? "list" : "map")}
              className="bg-white rounded-lg shadow-md px-3.5 py-3 text-sm
                         text-gray-600 hover:bg-gray-50 transition-colors font-medium"
              title={view === "map" ? "Show list" : "Show map"}
            >
              {view === "map" ? "List" : "Map"}
            </button>
          )}
        </div>
        {routeData && (
          <AirlineFilters
            airlines={airlines}
            selectedAirline={selectedAirline}
            onToggle={handleAirlineToggle}
          />
        )}
      </div>

      {/* Loading */}
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
          rank={routeData.routes.findIndex(
            (r) => r.destination.iata === selectedRoute.destination.iata
          ) + 1}
          totalRoutes={routeData.routes.length}
          onClose={() => setSelectedRoute(null)}
        />
      )}

      {/* Footer */}
      <Footer lastUpdated={routeData?.last_updated ?? null} />
    </main>
  );
}
