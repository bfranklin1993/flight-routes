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

  const formatPax = (n: number) =>
    n >= 1_000_000
      ? `${(n / 1_000_000).toFixed(1)}M`
      : `${(n / 1_000).toFixed(0)}K`;

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
        {/* Top strip — rank only */}
        <div className="flex justify-end items-center px-4 py-2.5"
             style={{ background: "#16213e" }}>
          <span className="text-gray-500 text-xs">
            #{rank} of {totalRoutes} routes
          </span>
        </div>

        {/* Route codes */}
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

        {/* Perforated line */}
        <div className="mx-2" style={{ borderTop: "2px dashed #2a2a4a" }} />

        {/* Stats strip */}
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
            <div className="text-gray-500 text-[9px] uppercase tracking-[1px]">Pax/Year</div>
            <div className="text-gray-200 text-sm font-semibold">
              {formatPax(route.total_annual_passengers)}
            </div>
          </div>
        </div>
      </div>

      {/* Airlines — Solari board style */}
      <div style={{ background: "#0a0a0a", fontFamily: "'Courier New', monospace" }}
           className="px-4 py-4">
        <div className="text-[9px] uppercase tracking-[1px] text-gray-600 mb-2 px-1">
          Airlines
        </div>
        <div className="space-y-1">
          {route.airlines.map((airline) => {
            const dailyFlights = Math.round(airline.weekly_flights / 7);
            return (
              <div
                key={airline.code}
                className="flex items-center justify-between px-2.5 py-2 rounded"
                style={{ background: "#141414", border: "1px solid #222" }}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: getAirlineColor(airline.code) }}
                  />
                  <span className="text-gray-200 text-sm font-semibold tracking-wide">
                    {airline.name}
                  </span>
                </div>
                <span className="text-amber-400 text-xs font-bold tracking-wider">
                  {dailyFlights > 0
                    ? `${dailyFlights}/DAY`
                    : `${airline.weekly_flights}/WK`}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Search Flights */}
      <div className="p-5">
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
