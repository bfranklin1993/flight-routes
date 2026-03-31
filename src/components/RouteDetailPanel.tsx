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
    <div className="absolute top-0 right-0 h-full w-72 bg-white shadow-xl border-l
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
        {/* Top strip */}
        <div className="flex justify-between items-center px-4 py-2.5"
             style={{ background: "#16213e" }}>
          <span className="text-gray-300 text-[10px] uppercase tracking-[2px]">
            Boarding Pass
          </span>
          <span className="text-gray-500 text-[10px]">
            #{rank} of {totalRoutes}
          </span>
        </div>

        {/* Route codes */}
        <div className="flex justify-between items-center px-4 py-5">
          <div className="text-center">
            <div className="text-white text-[28px] font-bold tracking-[2px]">
              {origin.iata}
            </div>
            <div className="text-gray-400 text-[11px] mt-0.5">{origin.city}</div>
          </div>
          <div className="flex-1 px-3 relative">
            <div className="border-t border-dashed border-gray-600 w-full" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                            text-gray-400 text-sm">
              ✈
            </div>
          </div>
          <div className="text-center">
            <div className="text-white text-[28px] font-bold tracking-[2px]">
              {dest.iata}
            </div>
            <div className="text-gray-400 text-[11px] mt-0.5">{dest.city}</div>
          </div>
        </div>

        {/* Perforated line */}
        <div className="mx-2" style={{ borderTop: "2px dashed #2a2a4a" }} />

        {/* Stats strip */}
        <div className="flex justify-between px-4 py-3">
          <div>
            <div className="text-gray-500 text-[8px] uppercase tracking-[1px]">Distance</div>
            <div className="text-gray-200 text-[13px] font-semibold">
              {route.distance_miles.toLocaleString()} mi
            </div>
          </div>
          <div className="text-center">
            <div className="text-gray-500 text-[8px] uppercase tracking-[1px]">Daily</div>
            <div className="text-gray-200 text-[13px] font-semibold">
              ~{dailyAvg}
            </div>
          </div>
          <div className="text-right">
            <div className="text-gray-500 text-[8px] uppercase tracking-[1px]">Pax/Year</div>
            <div className="text-gray-200 text-[13px] font-semibold">
              {formatPax(route.total_annual_passengers)}
            </div>
          </div>
        </div>
      </div>

      {/* Airlines + Search */}
      <div className="p-5">
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
