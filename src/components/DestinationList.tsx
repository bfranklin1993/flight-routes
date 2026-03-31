"use client";

import type { AirportRoutes, Route } from "@/lib/types";
import { getAirlineColor } from "@/lib/airlines";

interface DestinationListProps {
  routeData: AirportRoutes;
  selectedAirline: string | null;
  onSelectRoute: (route: Route) => void;
}

function estimateFlightTime(miles: number): string {
  // ~500mph cruise + 30min for taxi/climb/descent
  const hours = miles / 500 + 0.5;
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export default function DestinationList({
  routeData,
  selectedAirline,
  onSelectRoute,
}: DestinationListProps) {
  const filtered = (selectedAirline
    ? routeData.routes.filter((r) =>
        r.airlines.some((a) => a.code === selectedAirline)
      )
    : routeData.routes
  ).filter((r) => {
    // Filter out 0-frequency routes
    const totalWeekly = r.airlines.reduce((s, a) => s + a.weekly_flights, 0);
    return totalWeekly > 0;
  });

  return (
    <div className="absolute inset-0 z-30 overflow-y-auto solari-board">
      <div className="max-w-3xl mx-auto pt-28 pb-12 px-4">
        {/* Column headers */}
        <div className="flex items-center px-3 py-2 mb-1">
          <span className="solari-header w-14">Code</span>
          <span className="solari-header flex-1">Destination</span>
          <span className="solari-header w-20 text-right">Airlines</span>
          <span className="solari-header w-16 text-right">Time</span>
          <span className="solari-header w-16 text-right">Freq</span>
        </div>

        {filtered.map((route) => {
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
              className="solari-row w-full text-left hover:brightness-125
                         transition-all cursor-pointer"
            >
              <span className="solari-text-amber w-14 flex-shrink-0">
                {route.destination.iata}
              </span>
              <span className="solari-text flex-1 truncate">
                {route.destination.city.toUpperCase()}
              </span>
              <span className="w-20 flex justify-end gap-1 flex-shrink-0 items-center">
                {visibleAirlines.map((a) => (
                  <span
                    key={a.code}
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: getAirlineColor(a.code) }}
                  />
                ))}
                {!selectedAirline && route.airlines.length > 5 && (
                  <span className="text-gray-500 text-[10px]">
                    +{route.airlines.length - 5}
                  </span>
                )}
              </span>
              <span className="solari-text w-16 text-right text-xs flex-shrink-0">
                {estimateFlightTime(route.distance_miles)}
              </span>
              <span className="solari-text-amber w-16 text-right text-xs flex-shrink-0">
                {totalDaily > 0 ? `${totalDaily}/DAY` : `${totalWeekly}/WK`}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
