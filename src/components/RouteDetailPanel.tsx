"use client";

import type { Route, Airport } from "@/lib/types";
import { getAirlineColor, needsDarkText } from "@/lib/airlines";
import { googleFlightsUrl } from "@/lib/google-flights";

interface RouteDetailPanelProps {
  route: Route;
  origin: Airport;
  onClose: () => void;
}

export default function RouteDetailPanel({
  route,
  origin,
  onClose,
}: RouteDetailPanelProps) {
  const dest = route.destination;

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

      {/* Airlines */}
      <div className="p-5">
        <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-3">
          Airlines
        </div>
        <div className="space-y-2">
          {route.airlines.map((airline) => (
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
                  ~{airline.weekly_flights} flights/week
                </div>
              </div>
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: getAirlineColor(airline.code) }}
              />
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="text-xs uppercase tracking-wide text-gray-400 font-semibold mb-3 mt-5">
          Stats
        </div>
        <div className="bg-gray-50 rounded-lg p-3 space-y-2">
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
