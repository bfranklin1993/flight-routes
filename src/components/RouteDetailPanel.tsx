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
    <div className="absolute top-0 right-0 h-full w-80 bg-white shadow-xl border-l
                    border-gray-100 z-40 overflow-y-auto animate-slide-in">
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 z-50 w-7 h-7 rounded-full bg-white/20
                   flex items-center justify-center text-gray-300 hover:text-white
                   hover:bg-white/30 transition-colors text-sm backdrop-blur-sm"
      >
        ✕
      </button>

      {/* Boarding Pass Header */}
      <div style={{ background: "#1a1a2e", fontFamily: "'Courier New', monospace" }}>
        <div className="flex justify-end items-center px-4 py-2.5"
             style={{ background: "#16213e" }}>
          <span className="text-gray-500 text-xs">
            #{rank} of {totalRoutes} routes
          </span>
        </div>

        <div className="flex justify-between items-center px-5 py-5">
          <div className="text-center">
            <div className="text-white text-3xl font-bold tracking-[2px]">
              {origin.iata}
            </div>
            <div className="text-gray-400 text-xs mt-0.5">{origin.city}</div>
          </div>
          <div className="flex-1 px-3 relative">
            <div className="border-t border-dashed border-gray-600 w-full" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                            text-gray-400 text-sm">
              ✈
            </div>
          </div>
          <div className="text-center">
            <div className="text-white text-3xl font-bold tracking-[2px]">
              {dest.iata}
            </div>
            <div className="text-gray-400 text-xs mt-0.5">{dest.city}</div>
          </div>
        </div>

        <div className="mx-2" style={{ borderTop: "2px dashed #2a2a4a" }} />

        <div className="flex justify-between px-5 py-3">
          <div>
            <div className="text-gray-500 text-[9px] uppercase tracking-[1px]">Distance</div>
            <div className="text-gray-200 text-sm font-semibold">
              {route.distance_miles.toLocaleString()} mi
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-500 text-[9px] uppercase tracking-[1px]">Daily</div>
            <div className="text-gray-200 text-sm font-semibold">
              ~{dailyAvg}
            </div>
          </div>
          <div className="text-right">
            <div className="text-gray-500 text-[9px] uppercase tracking-[1px]">Flight</div>
            <div className="text-gray-200 text-sm font-semibold">
              ~{estimateFlightTime(route.distance_miles)}
            </div>
          </div>
        </div>
      </div>

      {/* Airlines — Solari split-flap board */}
      <div className="solari-board px-3 py-4">
        {/* Column headers */}
        <div className="flex items-center justify-between px-2 mb-2">
          <span className="solari-header">Airline</span>
          <span className="solari-header">Freq</span>
        </div>

        {route.airlines.map((airline, i) => {
          const dailyFlights = Math.round(airline.weekly_flights / 7);
          return (
            <div key={airline.code} className="solari-row">
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className="w-1.5 h-4 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: getAirlineColor(airline.code) }}
                />
                <span className="solari-text truncate">{airline.name.toUpperCase()}</span>
              </div>
              <span className="solari-text-amber flex-shrink-0">
                {dailyFlights > 0
                  ? `${dailyFlights}/DAY`
                  : `${airline.weekly_flights}/WK`}
              </span>
            </div>
          );
        })}
      </div>

      {/* Search Flights */}
      <div className="p-5 pt-2">
        <a
          href={googleFlightsUrl(origin.iata, dest.iata)}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-center bg-gray-800 text-white py-2.5 rounded-lg
                     font-semibold text-sm hover:bg-gray-700 transition-colors"
        >
          Search Flights →
        </a>
      </div>
    </div>
  );
}
