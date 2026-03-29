"use client";

import { getAirlineColor, needsDarkText } from "@/lib/airlines";

interface AirlineFiltersProps {
  airlines: { code: string; name: string }[];
  activeFilters: Set<string>;
  onToggle: (code: string) => void;
}

export default function AirlineFilters({
  airlines,
  activeFilters,
  onToggle,
}: AirlineFiltersProps) {
  if (airlines.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 justify-center mt-2">
      {airlines.map((airline) => {
        const isActive = activeFilters.has(airline.code);
        const color = getAirlineColor(airline.code);
        const darkText = needsDarkText(airline.code);

        return (
          <button
            key={airline.code}
            onClick={() => onToggle(airline.code)}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
            style={{
              backgroundColor: isActive ? color : "#e5e7eb",
              color: isActive ? (darkText ? "#1f2937" : "#ffffff") : "#6b7280",
              opacity: isActive ? 1 : 0.6,
            }}
          >
            {airline.name}
          </button>
        );
      })}
    </div>
  );
}
