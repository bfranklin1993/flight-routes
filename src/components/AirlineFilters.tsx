"use client";

import { useState } from "react";
import { getAirlineColor, needsDarkText } from "@/lib/airlines";

interface AirlineFiltersProps {
  airlines: { code: string; name: string }[];
  activeFilters: Set<string>;
  onToggle: (code: string) => void;
}

const VISIBLE_COUNT = 8;

export default function AirlineFilters({
  airlines,
  activeFilters,
  onToggle,
}: AirlineFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  if (airlines.length === 0) return null;

  const visible = expanded ? airlines : airlines.slice(0, VISIBLE_COUNT);
  const hiddenCount = airlines.length - VISIBLE_COUNT;

  return (
    <div className="flex flex-wrap gap-2 justify-center mt-2 max-w-2xl">
      {visible.map((airline) => {
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
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-200 text-gray-600
                     hover:bg-gray-300 transition-colors"
        >
          {expanded ? "Show less" : `+${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}
