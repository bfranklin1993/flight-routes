"use client";

import { getAirlineColor, getFocusColor, isOtherCarrier, OTHER_COLOR } from "@/lib/airlines";

interface MapLegendProps {
  airlines: { code: string; name: string }[];
  selectedAirline: string | null;
}

/**
 * Key for the map's two encodings: colour for carrier, width for weekly volume.
 *
 * Without this the map asks you to remember which pill you clicked, and gives no
 * way at all to read line thickness.
 */
export default function MapLegend({ airlines, selectedAirline }: MapLegendProps) {
  if (airlines.length === 0) return null;

  const named = airlines.filter((a) => !isOtherCarrier(a.code));
  const otherCount = airlines.length - named.length;

  const selected = selectedAirline
    ? airlines.find((a) => a.code === selectedAirline)
    : null;

  return (
    <div
      className="absolute bottom-12 left-3 z-30 rounded-lg bg-white/95 backdrop-blur-sm
                 px-3 py-2.5 shadow-md ring-1 ring-black/5 hidden sm:block"
    >
      {selected ? (
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-1 w-6 rounded-full"
            style={{ backgroundColor: getFocusColor(selected.code) }}
          />
          <span className="text-xs font-semibold text-gray-700">
            {selected.name} only
          </span>
        </div>
      ) : (
        <ul className="space-y-1">
          {named.map((airline) => (
            <li key={airline.code} className="flex items-center gap-2">
              <span
                className="inline-block h-1 w-6 rounded-full"
                style={{ backgroundColor: getAirlineColor(airline.code) }}
              />
              <span className="text-xs text-gray-700">{airline.name}</span>
            </li>
          ))}
          {otherCount > 0 && (
            <li className="flex items-center gap-2">
              <span
                className="inline-block h-1 w-6 rounded-full"
                style={{ backgroundColor: OTHER_COLOR }}
              />
              <span className="text-xs text-gray-700">
                Other carriers ({otherCount})
              </span>
            </li>
          )}
        </ul>
      )}

      <div className="mt-2 border-t border-gray-200 pt-2">
        <div className="flex items-center gap-2">
          <span className="flex w-6 flex-col items-stretch gap-[3px]" aria-hidden="true">
            <span className="block h-[1px] rounded-full bg-gray-500" />
            <span className="block h-[2px] rounded-full bg-gray-500" />
            <span className="block h-[4px] rounded-full bg-gray-500" />
          </span>
          <span className="text-[11px] text-gray-600">Thicker = more flights</span>
        </div>
      </div>
    </div>
  );
}
