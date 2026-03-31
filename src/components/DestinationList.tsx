"use client";

import type { AirportRoutes, Route } from "@/lib/types";
import { getAirlineColor } from "@/lib/airlines";

interface DestinationListProps {
  routeData: AirportRoutes;
  selectedAirline: string | null;
  onSelectRoute: (route: Route) => void;
}

export default function DestinationList({
  routeData,
  selectedAirline,
  onSelectRoute,
}: DestinationListProps) {
  const filtered = selectedAirline
    ? routeData.routes.filter((r) =>
        r.airlines.some((a) => a.code === selectedAirline)
      )
    : routeData.routes;

  return (
    <div className="absolute inset-0 z-30 bg-gray-50 overflow-y-auto">
      <div className="max-w-2xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="mb-4">
          <h2 className="text-lg font-bold text-gray-800">
            {filtered.length} nonstop destinations from {routeData.airport.iata}
          </h2>
          <p className="text-sm text-gray-500">
            {routeData.airport.name} — {routeData.airport.city}
          </p>
        </div>

        {/* Solari board list */}
        <div className="solari-board rounded-lg overflow-hidden">
          {/* Column headers */}
          <div className="flex items-center px-4 py-2.5 border-b border-gray-700/50">
            <span className="solari-header w-16">Code</span>
            <span className="solari-header flex-1">Destination</span>
            <span className="solari-header w-24 text-right">Airlines</span>
            <span className="solari-header w-20 text-right">Freq</span>
          </div>

          {filtered.map((route) => {
            const totalDaily = Math.round(
              route.airlines.reduce((s, a) => s + a.weekly_flights, 0) / 7
            );
            const airlineCount = selectedAirline
              ? 1
              : route.airlines.length;

            return (
              <button
                key={route.destination.iata}
                onClick={() => onSelectRoute(route)}
                className="solari-row w-full text-left hover:brightness-125
                           transition-all cursor-pointer"
              >
                <span className="solari-text-amber w-16">{route.destination.iata}</span>
                <span className="solari-text flex-1 truncate">
                  {route.destination.city.toUpperCase()}
                </span>
                <span className="w-24 flex justify-end gap-1">
                  {(selectedAirline
                    ? route.airlines.filter((a) => a.code === selectedAirline)
                    : route.airlines.slice(0, 4)
                  ).map((a) => (
                    <span
                      key={a.code}
                      className="w-2 h-2 rounded-full inline-block"
                      style={{ backgroundColor: getAirlineColor(a.code) }}
                    />
                  ))}
                  {!selectedAirline && route.airlines.length > 4 && (
                    <span className="text-gray-500 text-[10px] ml-0.5">
                      +{route.airlines.length - 4}
                    </span>
                  )}
                </span>
                <span className="solari-text-amber w-20 text-right text-xs">
                  {totalDaily > 0 ? `${totalDaily}/DAY` : `${route.airlines.reduce((s, a) => s + a.weekly_flights, 0)}/WK`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
