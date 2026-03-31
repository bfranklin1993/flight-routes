"use client";

import { useState } from "react";
import type { AirportRoutes, Route } from "@/lib/types";
import { getAirlineColor } from "@/lib/airlines";

interface DestinationListProps {
  routeData: AirportRoutes;
  selectedAirline: string | null;
  onSelectRoute: (route: Route) => void;
}

function estimateFlightTime(miles: number): string {
  const hours = miles / 500 + 0.5;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function flightTimeMinutes(miles: number): number {
  return Math.round((miles / 500 + 0.5) * 60);
}

type SortKey = "destination" | "time" | "freq" | "airlines";
type SortDir = "asc" | "desc";

export default function DestinationList({
  routeData,
  selectedAirline,
  onSelectRoute,
}: DestinationListProps) {
  const [sortKey, setSortKey] = useState<SortKey>("freq");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir(key === "destination" ? "asc" : "desc");
    }
  };

  const filtered = (selectedAirline
    ? routeData.routes.filter((r) =>
        r.airlines.some((a) => a.code === selectedAirline)
      )
    : routeData.routes
  ).filter((r) => r.airlines.reduce((s, a) => s + a.weekly_flights, 0) > 0);

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    switch (sortKey) {
      case "destination":
        return dir * a.destination.city.localeCompare(b.destination.city);
      case "time":
        return dir * (a.distance_miles - b.distance_miles);
      case "freq": {
        const aFreq = a.airlines.reduce((s, al) => s + al.weekly_flights, 0);
        const bFreq = b.airlines.reduce((s, al) => s + al.weekly_flights, 0);
        return dir * (aFreq - bFreq);
      }
      case "airlines":
        return dir * (a.airlines.length - b.airlines.length);
      default:
        return 0;
    }
  });

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto solari-board">
      <div className="max-w-5xl mx-auto pt-28 pb-12 px-6">
        {/* Summary */}
        <div className="px-1 mb-3">
          <span className="text-gray-400 text-sm">
            {filtered.length} nonstop destinations
            {selectedAirline && " on this airline"}
          </span>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-lg">
          {/* Column headers — clickable for sort */}
          <div className="flex items-center px-4 py-2.5 bg-black/30">
            <button
              onClick={() => handleSort("destination")}
              className="solari-header w-16 text-left hover:text-gray-300 transition-colors cursor-pointer"
            >
              Code{arrow("destination")}
            </button>
            <button
              onClick={() => handleSort("destination")}
              className="solari-header flex-1 text-left hover:text-gray-300 transition-colors cursor-pointer"
            >
              Destination{arrow("destination")}
            </button>
            <button
              onClick={() => handleSort("airlines")}
              className="solari-header w-28 text-right hover:text-gray-300 transition-colors cursor-pointer"
            >
              Airlines{arrow("airlines")}
            </button>
            <button
              onClick={() => handleSort("time")}
              className="solari-header w-20 text-right hover:text-gray-300 transition-colors cursor-pointer"
            >
              Time{arrow("time")}
            </button>
            <button
              onClick={() => handleSort("freq")}
              className="solari-header w-20 text-right hover:text-gray-300 transition-colors cursor-pointer"
            >
              Freq{arrow("freq")}
            </button>
          </div>

          {/* Rows */}
          {sorted.map((route) => {
            const totalDaily = Math.round(
              route.airlines.reduce((s, a) => s + a.weekly_flights, 0) / 7
            );
            const totalWeekly = route.airlines.reduce((s, a) => s + a.weekly_flights, 0);
            const visibleAirlines = selectedAirline
              ? route.airlines.filter((a) => a.code === selectedAirline)
              : route.airlines.slice(0, 6);

            return (
              <button
                key={route.destination.iata}
                onClick={() => onSelectRoute(route)}
                className="solari-row w-full text-left hover:brightness-125
                           transition-all cursor-pointer"
              >
                <span className="solari-text-amber w-16 flex-shrink-0">
                  {route.destination.iata}
                </span>
                <span className="solari-text flex-1 truncate">
                  {route.destination.city.toUpperCase()}
                </span>
                <span className="w-28 flex justify-end gap-1.5 flex-shrink-0 items-center">
                  {visibleAirlines.map((a) => (
                    <span
                      key={a.code}
                      className="w-2.5 h-2.5 rounded-full inline-block"
                      style={{ backgroundColor: getAirlineColor(a.code) }}
                    />
                  ))}
                  {!selectedAirline && route.airlines.length > 6 && (
                    <span className="text-gray-500 text-[10px]">
                      +{route.airlines.length - 6}
                    </span>
                  )}
                </span>
                <span className="solari-text w-20 text-right text-xs flex-shrink-0">
                  {estimateFlightTime(route.distance_miles)}
                </span>
                <span className="solari-text-amber w-20 text-right text-xs flex-shrink-0">
                  {totalDaily > 0 ? `${totalDaily}/DAY` : `${totalWeekly}/WK`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
