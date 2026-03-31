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

type SortKey = "destination" | "time" | "freq";
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
      default:
        return 0;
    }
  });

  const arrow = (key: SortKey) =>
    sortKey === key ? (sortDir === "asc" ? " ▲" : " ▼") : "";

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto solari-board">
      <div className="max-w-6xl mx-auto pt-28 pb-12 px-6">
        {/* Sort controls */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-gray-400 text-sm">
            {filtered.length} nonstop destinations
          </span>
          <div className="flex gap-1">
            {(["destination", "freq", "time"] as SortKey[]).map((key) => (
              <button
                key={key}
                onClick={() => handleSort(key)}
                className={`px-3 py-1 rounded text-xs font-semibold transition-colors
                  ${sortKey === key
                    ? "bg-gray-700 text-amber-400"
                    : "text-gray-500 hover:text-gray-300"
                  }`}
              >
                {key === "destination" ? "A-Z" : key === "freq" ? "Frequency" : "Flight Time"}
                {arrow(key)}
              </button>
            ))}
          </div>
        </div>

        {/* Card grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {sorted.map((route) => {
            const totalDaily = Math.round(
              route.airlines.reduce((s, a) => s + a.weekly_flights, 0) / 7
            );
            const totalWeekly = route.airlines.reduce((s, a) => s + a.weekly_flights, 0);
            const visibleAirlines = selectedAirline
              ? route.airlines.filter((a) => a.code === selectedAirline)
              : route.airlines.slice(0, 5);

            return (
              <button
                key={route.destination.iata}
                onClick={() => onSelectRoute(route)}
                className="solari-row flex-col items-start gap-0 p-4 rounded-lg
                           hover:brightness-125 transition-all cursor-pointer text-left"
              >
                {/* Top: city + stats */}
                <div className="flex justify-between items-start w-full">
                  {/* Left: City + code + airlines */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="solari-text text-lg font-bold truncate leading-tight">
                        {route.destination.city.toUpperCase()}
                      </span>
                      {route.destination.region && (
                        <span className="text-gray-500 text-xs flex-shrink-0">
                          {route.destination.region}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2.5 mt-1.5">
                      <span className="solari-text-amber text-sm tracking-wider">
                        {route.destination.iata}
                      </span>
                      <div className="flex gap-1 items-center">
                        {visibleAirlines.map((a) => (
                          <span
                            key={a.code}
                            className="w-2.5 h-2.5 rounded-full"
                            style={{ backgroundColor: getAirlineColor(a.code) }}
                            title={a.name}
                          />
                        ))}
                        {!selectedAirline && route.airlines.length > 5 && (
                          <span
                            className="text-gray-500 text-[10px]"
                            title={route.airlines.slice(5).map((a) => a.name).join(", ")}
                          >
                            +{route.airlines.length - 5}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Right: time + freq stacked */}
                  <div className="text-right flex-shrink-0 ml-3">
                    <div className="text-gray-400 text-sm">
                      {estimateFlightTime(route.distance_miles)}
                    </div>
                    <div className="solari-text-amber text-sm font-bold mt-0.5">
                      {totalDaily > 0 ? `${totalDaily}/DAY` : `${totalWeekly}/WK`}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
