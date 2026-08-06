"use client";

import { useState } from "react";
import { getAirlineColor, getFocusColor, needsDarkText } from "@/lib/airlines";

interface AirlineFiltersProps {
  airlines: { code: string; name: string }[];
  selectedAirline: string | null;
  onToggle: (code: string) => void;
  dark?: boolean;
}

const VISIBLE_COUNT = 8;

export default function AirlineFilters({
  airlines,
  selectedAirline,
  onToggle,
  dark,
}: AirlineFiltersProps) {
  const [expanded, setExpanded] = useState(false);

  if (airlines.length === 0) return null;

  const visible = expanded ? airlines : airlines.slice(0, VISIBLE_COUNT);
  const hiddenCount = airlines.length - VISIBLE_COUNT;

  const pillBase = dark ? "rgba(55,65,81,0.7)" : "rgba(255,255,255,0.85)";
  const pillText = dark ? "#d1d5db" : "#4b5563";
  const moreBg = dark ? "bg-gray-700/70 text-gray-400 hover:bg-gray-600/70" : "bg-white/85 text-gray-500 hover:bg-white";

  return (
    <div className="flex flex-wrap gap-2 justify-center max-w-2xl">
      {visible.map((airline) => {
        const isSelected = selectedAirline === airline.code;
        // Selected pills use the emphasis colour so the pill matches the arcs
        // it just drew; carriers in the shared bucket would otherwise show a
        // grey pill over vermillion routes.
        const color = isSelected
          ? getFocusColor(airline.code)
          : getAirlineColor(airline.code);
        const darkText = needsDarkText(airline.code);

        return (
          <button
            key={airline.code}
            onClick={() => onToggle(airline.code)}
            className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
            style={{
              backgroundColor: isSelected ? color : pillBase,
              color: isSelected ? (darkText ? "#1f2937" : "#ffffff") : pillText,
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
          className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors ${moreBg}`}
          style={{ boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}
        >
          {expanded ? "Show less" : `+${hiddenCount} more`}
        </button>
      )}
    </div>
  );
}
