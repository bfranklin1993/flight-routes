"use client";

import type { Route, Airport } from "@/lib/types";
import { getAirlineColor } from "@/lib/airlines";
import { googleFlightsUrl } from "@/lib/google-flights";

interface RouteDetailPanelProps {
  route: Route;
  origin: Airport;
  rank: number;
  totalRoutes: number;
  onClose: () => void;
}

export default function RouteDetailPanel({
  route,
  origin,
  rank,
  totalRoutes,
  onClose,
}: RouteDetailPanelProps) {
  const dest = route.destination;
  const totalDailyFlights = route.airlines.reduce(
    (sum, a) => sum + a.weekly_flights, 0
  );
  const dailyAvg = Math.round(totalDailyFlights / 7);

  return (
    <div className="absolute top-0 right-0 h-full w-72 bg-white shadow-xl border-l
                    border-gray-100 z-40 overflow-y-auto animate-slide-in">
      {/* Header */}
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <div>
          <div className="text-lg font-bold text-gray-800">
            {origin.iata} → {dest.iata}
          </div>
          <div className="text-sm text-gray-500">{dest.name}</div>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center
                     text-gray-500 hover:bg-gray-200 transition-colors text-sm"
        >
          ✕
        </button>
      </div>

      {/* Rank badge */}
      <div className="px-5 pt-4 pb-1">
        <span className="inline-block text-xs font-semibold text-indigo-600 bg-indigo-50
                         rounded-full px-2.5 py-1">
          #{rank} of {totalRoutes} routes from {origin.iata}
        </span>
      </div>

      <div className="p-5 pt-3">
        {/* Airlines */}
        <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-3">
          Airlines
        </div>
        <div className="space-y-2">
          {route.airlines.map((airline) => {
            const dailyFlights = Math.round(airline.weekly_flights / 7);
            return (
              <div
                key={airline.code}
                className="bg-gray-50 rounded-lg p-3 flex items-center justify-between"
              >
                <div>
                  <div
                    className="font-semibold text-sm"
                    style={{ color: getAirlineColor(airline.code) }}
                  >
                    {airline.name}
                  </div>
                  <div className="text-xs text-gray-400">
                    {dailyFlights > 0
                      ? `~${dailyFlights}/day (${airline.weekly_flights}/week)`
                      : `~${airline.weekly_flights}/week`}
                  </div>
                </div>
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: getAirlineColor(airline.code) }}
                />
              </div>
            );
          })}
        </div>

        {/* Stats */}
        <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-3 mt-5">
          Stats
        </div>
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
          {dailyAvg > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total daily flights</span>
              <span className="font-semibold text-gray-800">~{dailyAvg}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">Distance</span>
            <span className="font-semibold text-gray-800">
              {route.distance_miles.toLocaleString()} mi
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">~Passengers/yr</span>
            <span className="font-semibold text-gray-800">
              {route.total_annual_passengers >= 1_000_000
                ? `${(route.total_annual_passengers / 1_000_000).toFixed(1)}M`
                : `${(route.total_annual_passengers / 1_000).toFixed(0)}K`}
            </span>
          </div>
        </div>

        {/* Search Flights link */}
        <a
          href={googleFlightsUrl(origin.iata, dest.iata)}
          target="_blank"
          rel="noopener noreferrer"
          className="block mt-5 text-center bg-gray-800 text-white py-2.5 rounded-lg
                     font-semibold text-sm hover:bg-gray-700 transition-colors"
        >
          Search Flights →
        </a>
      </div>
    </div>
  );
}
