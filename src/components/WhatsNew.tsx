"use client";

import { useState } from "react";
import type { AirportRoutes, Route } from "@/lib/types";
import { getNewRoutes, newRouteLabel } from "@/lib/routes";

interface WhatsNewProps {
  routeData: AirportRoutes;
  selectedRoute: Route | null;
  onSelect: (route: Route) => void;
}

const ACCENT = "#FF5A1F";
const ACCENT_INK = "#C23E0E";
const PREVIEW_COUNT = 6;

function Diamond({ size = 10 }: { size?: number }) {
  return (
    <span
      aria-hidden
      className="flex-shrink-0 rotate-45 rounded-[2px]"
      style={{ width: size, height: size, backgroundColor: ACCENT }}
    />
  );
}

export default function WhatsNew({
  routeData,
  selectedRoute,
  onSelect,
}: WhatsNewProps) {
  const [expanded, setExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const newRoutes = getNewRoutes(routeData);
  if (newRoutes.length === 0) return null;

  const origin = routeData.airport;
  const visible = expanded ? newRoutes : newRoutes.slice(0, PREVIEW_COUNT);
  const hiddenCount = newRoutes.length - PREVIEW_COUNT;

  return (
    <div
      className="absolute z-40 bottom-4 left-4 right-4 md:right-auto md:w-[340px]
                 max-h-[55vh] md:max-h-[70vh] flex flex-col
                 rounded-2xl overflow-hidden bg-white shadow-2xl
                 border border-gray-100 animate-slide-up md:animate-slide-in"
    >
      {/* Header */}
      <div className="flex items-baseline justify-between px-4 py-3 border-b border-gray-100">
        <div className="min-w-0">
          <h3 className="text-[13px] font-extrabold tracking-wide uppercase text-gray-900 truncate">
            New from {origin.city}
          </h3>
          <p className="text-[11.5px] text-gray-500 mt-0.5">
            added or returning this season
          </p>
        </div>
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="md:hidden text-gray-400 hover:text-gray-600 text-xs flex-shrink-0 ml-2"
          aria-label={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? "Show" : "Hide"}
        </button>
      </div>

      {!collapsed && (
        <>
          <ul className="overflow-y-auto">
            {visible.map((route) => {
              const label = newRouteLabel(route);
              const isActive =
                selectedRoute?.destination.iata === route.destination.iata;
              return (
                <li key={route.destination.iata}>
                  <button
                    onClick={() => onSelect(route)}
                    className="group w-full flex items-center gap-3 px-4 py-3 text-left
                               border-b border-gray-50 last:border-b-0 transition-colors"
                    style={isActive ? { backgroundColor: "#FFE9DF" } : undefined}
                    onMouseEnter={(e) => {
                      if (!isActive)
                        e.currentTarget.style.backgroundColor = "#FFF4EE";
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive)
                        e.currentTarget.style.backgroundColor = "";
                    }}
                  >
                    <Diamond />
                    <span className="flex-1 min-w-0">
                      <span className="block text-[14px] font-bold text-gray-900 truncate">
                        {route.destination.city}
                      </span>
                      <span
                        className="block text-[11px] text-gray-500 mt-0.5"
                        style={{ fontFamily: "'Courier New', monospace" }}
                      >
                        {origin.iata} &rarr; {route.destination.iata}
                      </span>
                    </span>
                    <span
                      className="text-[11px] font-bold flex-shrink-0 text-right"
                      style={{
                        fontFamily: "'Courier New', monospace",
                        color: ACCENT_INK,
                      }}
                    >
                      {label.text}
                    </span>
                    <span
                      className="flex-shrink-0 -translate-x-1 opacity-0 transition-all
                                 group-hover:translate-x-0 group-hover:opacity-100"
                      style={{ color: ACCENT }}
                      aria-hidden
                    >
                      &rarr;
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {hiddenCount > 0 && (
            <button
              onClick={() => setExpanded((x) => !x)}
              className="px-4 py-2.5 text-[12px] font-semibold text-gray-500
                         hover:text-gray-800 border-t border-gray-100 transition-colors"
            >
              {expanded ? "Show less" : `Show all ${newRoutes.length}`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
