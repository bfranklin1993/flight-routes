"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { AirportIndex } from "@/lib/types";
import { searchAirports } from "@/lib/airport-search";

interface AirportSearchProps {
  onSelect: (airport: AirportIndex) => void;
  selected: AirportIndex | null;
  dark?: boolean;
}

export default function AirportSearch({ onSelect, selected, dark }: AirportSearchProps) {
  const [query, setQuery] = useState("");
  const [airports, setAirports] = useState<AirportIndex[]>([]);
  const [results, setResults] = useState<AirportIndex[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    fetch("/data/airports.json")
      .then((res) => res.json())
      .then((data: AirportIndex[]) => setAirports(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    setResults(searchAirports(airports, query));
    setHighlightIndex(-1);
  }, [query, airports]);

  const handleSelect = useCallback(
    (airport: AirportIndex) => {
      onSelect(airport);
      setQuery("");
      setIsOpen(false);
      inputRef.current?.blur();
    },
    [onSelect]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && results.length > 0) {
      // Enter with nothing highlighted takes the top result. Previously it
      // required pressing ArrowDown first, so typing a code and hitting Enter
      // silently did nothing.
      e.preventDefault();
      handleSelect(results[highlightIndex >= 0 ? highlightIndex : 0]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  const baseBg = dark ? "bg-gray-800 text-gray-100" : "bg-white text-gray-800";
  const baseHover = dark ? "hover:bg-gray-700" : "hover:shadow-lg";
  const subText = dark ? "text-gray-400" : "text-gray-500";
  const placeholderColor = dark ? "placeholder-gray-500" : "placeholder-gray-400";

  return (
    <div className="relative w-[min(480px,calc(100vw-6rem))]">
      {selected && !isOpen ? (
        <button
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className={`w-full rounded-lg px-5 py-3 shadow-md text-left font-medium
                     transition-all ${baseBg} ${baseHover}`}
        >
          <span className={`mr-1 ${subText}`}>✈</span>
          <span className="font-bold">{selected.iata}</span>
          <span className={`ml-2 ${subText}`}>— {selected.name}</span>
        </button>
      ) : (
        <div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => setTimeout(() => setIsOpen(false), 200)}
            onKeyDown={handleKeyDown}
            placeholder="Search airports (e.g., ORD, Chicago, O'Hare)"
            className={`w-full rounded-lg px-5 py-3 shadow-md outline-none
                       transition-shadow focus:shadow-lg ${baseBg} ${placeholderColor}`}
          />
          {isOpen && query.trim().length > 0 && results.length === 0 && (
            <div
              className={`absolute top-full mt-1 w-full rounded-lg shadow-lg px-5 py-3 z-50 text-sm
                         ${dark
                           ? "bg-gray-800 border border-gray-700 text-gray-400"
                           : "bg-white border border-gray-100 text-gray-500"}`}
            >
              No airports found for &ldquo;{query.trim()}&rdquo;. Try an airport code
              like ORD, or a city name.
            </div>
          )}
          {isOpen && results.length > 0 && (
            <ul
              ref={listRef}
              className={`absolute top-full mt-1 w-full rounded-lg shadow-lg
                         overflow-hidden z-50 ${dark ? "bg-gray-800 border border-gray-700" : "bg-white border border-gray-100"}`}
            >
              {results.map((airport, i) => (
                <li
                  key={airport.iata}
                  onMouseDown={() => handleSelect(airport)}
                  className={`px-5 py-3 cursor-pointer transition-colors
                    ${dark
                      ? (i === highlightIndex ? "bg-gray-700" : "hover:bg-gray-700")
                      : (i === highlightIndex ? "bg-gray-100" : "hover:bg-gray-50")
                    }`}
                >
                  <span className={`font-bold ${dark ? "text-gray-100" : "text-gray-800"}`}>
                    {airport.iata}
                  </span>
                  <span className={`ml-2 ${subText}`}>
                    {airport.name} — {airport.city}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
