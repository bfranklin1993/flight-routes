"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { AirportIndex } from "@/lib/types";

interface AirportSearchProps {
  onSelect: (airport: AirportIndex) => void;
  selected: AirportIndex | null;
}

export default function AirportSearch({ onSelect, selected }: AirportSearchProps) {
  const [query, setQuery] = useState("");
  const [airports, setAirports] = useState<AirportIndex[]>([]);
  const [results, setResults] = useState<AirportIndex[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Load airport index once
  useEffect(() => {
    fetch("/data/airports.json")
      .then((res) => res.json())
      .then((data: AirportIndex[]) => setAirports(data))
      .catch(() => {});
  }, []);

  // Filter results as user types
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const q = query.toLowerCase();
    const filtered = airports.filter(
      (a) =>
        a.iata.toLowerCase().includes(q) ||
        a.name.toLowerCase().includes(q) ||
        a.city.toLowerCase().includes(q)
    );

    // Sort: exact IATA match first, then IATA prefix, then city prefix, then rest
    filtered.sort((a, b) => {
      const aIata = a.iata.toLowerCase();
      const bIata = b.iata.toLowerCase();
      const aCity = a.city.toLowerCase();
      const bCity = b.city.toLowerCase();

      const aExact = aIata === q ? 0 : aIata.startsWith(q) ? 1 : aCity.startsWith(q) ? 2 : 3;
      const bExact = bIata === q ? 0 : bIata.startsWith(q) ? 1 : bCity.startsWith(q) ? 2 : 3;
      return aExact - bExact;
    });

    setResults(filtered.slice(0, 8));
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
    } else if (e.key === "Enter" && highlightIndex >= 0) {
      e.preventDefault();
      handleSelect(results[highlightIndex]);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div className="relative w-full max-w-md">
      {selected && !isOpen ? (
        <button
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          className="w-full bg-white rounded-lg px-5 py-3 shadow-md text-left
                     text-gray-800 font-medium hover:shadow-lg transition-shadow"
        >
          <span className="text-gray-400 mr-1">✈</span>
          <span className="font-bold">{selected.iata}</span>
          <span className="text-gray-500 ml-2">— {selected.name}</span>
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
            className="w-full bg-white rounded-lg px-5 py-3 shadow-md
                       text-gray-800 placeholder-gray-400 outline-none
                       focus:shadow-lg transition-shadow"
          />
          {isOpen && results.length > 0 && (
            <ul
              ref={listRef}
              className="absolute top-full mt-1 w-full bg-white rounded-lg shadow-lg
                         border border-gray-100 overflow-hidden z-50"
            >
              {results.map((airport, i) => (
                <li
                  key={airport.iata}
                  onMouseDown={() => handleSelect(airport)}
                  className={`px-5 py-3 cursor-pointer transition-colors
                    ${i === highlightIndex ? "bg-gray-100" : "hover:bg-gray-50"}`}
                >
                  <span className="font-bold text-gray-800">{airport.iata}</span>
                  <span className="text-gray-500 ml-2">
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
