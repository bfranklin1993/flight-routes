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

  const estimateFlightTime = (miles: number): string => {
    const hours = miles / 500 + 0.5;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 z-40" onClick={onClose} />

      {/* Centered floating panels */}
      <div className="absolute top-16 right-8 z-50 flex flex-col gap-3 w-[380px] animate-slide-in">
        {/* Boarding pass card */}
        <div className="rounded-2xl overflow-hidden shadow-2xl relative">
          <div style={{ background: "#1a1a2e", fontFamily: "'Courier New', monospace" }}>
            <div className="flex justify-between items-center px-5 py-2.5"
                 style={{ background: "#16213e" }}>
              <span className="text-gray-500 text-xs">
                #{rank} of {totalRoutes} routes
              </span>
              <button
                onClick={onClose}
                className="text-gray-500 hover:text-gray-300 transition-colors text-xs"
              >
                ✕ close
              </button>
            </div>

            <div className="flex justify-between items-center px-6 py-6">
              <div className="text-center">
                <div className="text-white text-4xl font-bold tracking-[3px]">
                  {origin.iata}
                </div>
                <div className="text-gray-400 text-sm mt-1">{origin.city}</div>
              </div>
              <div className="flex-1 px-4 relative">
                <div className="border-t border-dashed border-gray-600 w-full" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                                text-gray-400 text-base">
                  ✈
                </div>
              </div>
              <div className="text-center">
                <div className="text-white text-4xl font-bold tracking-[3px]">
                  {dest.iata}
                </div>
                <div className="text-gray-400 text-sm mt-1">{dest.city}</div>
              </div>
            </div>

            <div className="mx-4" style={{ borderTop: "2px dashed #2a2a4a" }} />

            <div className="flex justify-between px-6 py-4">
              <div>
                <div className="text-gray-500 text-[10px] uppercase tracking-[1px]">Distance</div>
                <div className="text-gray-200 text-base font-semibold">
                  {route.distance_miles.toLocaleString()} mi
                </div>
              </div>
              <div className="text-center">
                <div className="text-gray-500 text-[10px] uppercase tracking-[1px]">Daily</div>
                <div className="text-gray-200 text-base font-semibold">
                  ~{dailyAvg}
                </div>
              </div>
              <div className="text-right">
                <div className="text-gray-500 text-[10px] uppercase tracking-[1px]">Flight</div>
                <div className="text-gray-200 text-base font-semibold">
                  ~{estimateFlightTime(route.distance_miles)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Airlines card */}
        <div className="solari-board rounded-2xl overflow-hidden shadow-2xl px-4 py-4">
          <div className="flex items-center justify-between px-2 mb-2">
            <span className="solari-header">Airline</span>
            <span className="solari-header">Freq</span>
          </div>

          {route.airlines.map((airline) => {
            const dailyFlights = Math.round(airline.weekly_flights / 7);
            return (
              <div key={airline.code} className="solari-row">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className="w-1.5 h-5 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: getAirlineColor(airline.code) }}
                  />
                  <span className="solari-text truncate text-sm">
                    {airline.name.toUpperCase()}
                  </span>
                </div>
                <span className="solari-text-amber flex-shrink-0 text-sm">
                  {dailyFlights > 0
                    ? `${dailyFlights}/DAY`
                    : `${airline.weekly_flights}/WK`}
                </span>
              </div>
            );
          })}
        </div>

        {/* Search Flights card */}
        <a
          href={googleFlightsUrl(origin.iata, dest.iata)}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center bg-gray-800 text-white py-3.5 rounded-2xl
                     font-semibold text-sm hover:bg-gray-700 transition-colors shadow-2xl"
        >
          Search Flights →
        </a>
      </div>
    </>
  );
}
