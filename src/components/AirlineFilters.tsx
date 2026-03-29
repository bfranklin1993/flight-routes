"use client";

import { useState } from "react";
import { getAirlineColor, needsDarkText } from "@/lib/airlines";

interface AirlineFiltersProps {
  airlines: { code: string; name: string }[];
  selectedAirline: string | null;
  onToggle: (code: string) => void;
}

const VISIBLE_COUNT = 8;

export default function AirlineFilters({
  airlines,
  selectedAirline,
  onToggle,
}: AirlineFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  if (airlines.length === 0) return null;

  const visible = expanded ? airlines : airlines.slice(0, VISIBLE_COUNT);
  const hiddenCount = airlines.length - VISIBLE_COUNT;

  return (
    <div className="flex flex-wrap gap-2 justify-center mt-2 max-w-2xl">
      {visible.map((airline) => {
        const isSelected = selectedAirline === airline.code;
        const color = getAirlineColor(airline.code);
        const darkText = needsDarkText(airline.code);

        return (
          <button
            key={airline.code}
            onClick={() => onToggle(airline.code)}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
            style={{
              backgroundColor: isSelected ? color : "rgba(255,255,255,0.85)",
              color: isSelected ? (darkText ? "#1f2937" : "#ffffff") : "#4b5563",
              boxShadow: isSelected
                ? `0 0 0 2px ${color}`
                : "0 1px 2px rgba(0,0,0,0.08)",
            }}
          >
            {airline.name}
          </button>
        );
      })}
      {hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="px-3 py-1 rounded-full text-xs font-semibold bg-white/85 text-gray-500
                     hover:bg-white transition-colors"
          style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}
        >
          {expanded ? "Show less" : `+${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}
