import type { AirportRoutes, Route } from "@/lib/types";

/**
 * A route is "new / seasonal" when it comes only from Wikipedia announcements,
 * i.e. it is newer than the latest DOT/BTS reporting cycle and has no volume yet.
 */
export function isNewRoute(route: Route): boolean {
  return route.sources?.length === 1 && route.sources[0] === "wikipedia";
}

function isUpcomingNote(note: string | null | undefined): boolean {
  if (!note) return false;
  const lead = note.trim().toLowerCase();
  return lead.startsWith("begins") || lead.startsWith("resumes");
}

/**
 * All new/seasonal routes, sorted for the "What's new" feed:
 *  1. upcoming (note begins/resumes) first
 *  2. then non-seasonal "new"
 *  3. then seasonal
 * Within each group, by destination city A-Z.
 */
export function getNewRoutes(routeData: AirportRoutes | null): Route[] {
  if (!routeData) return [];

  const rank = (route: Route): number => {
    if (isUpcomingNote(route.note)) return 0;
    if (!route.seasonal) return 1;
    return 2;
  };

  return routeData.routes
    .filter(isNewRoute)
    .sort((a, b) => {
      const ra = rank(a);
      const rb = rank(b);
      if (ra !== rb) return ra - rb;
      return a.destination.city.localeCompare(b.destination.city);
    });
}

const MONTH_ABBR: Record<string, string> = {
  january: "Jan",
  february: "Feb",
  march: "Mar",
  april: "Apr",
  may: "May",
  june: "Jun",
  july: "Jul",
  august: "Aug",
  september: "Sep",
  october: "Oct",
  november: "Nov",
  december: "Dec",
};

/** Capitalize the first letter and shorten any month name to keep labels tidy. */
function tidyNote(note: string): string {
  const shortened = note.replace(
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/gi,
    (m) => MONTH_ABBR[m.toLowerCase()] ?? m
  );
  return shortened.charAt(0).toUpperCase() + shortened.slice(1);
}

export type NewRouteKind = "upcoming" | "seasonal" | "new";

export interface NewRouteLabel {
  kind: NewRouteKind;
  text: string;
}

/**
 * Short label for a new/seasonal route, e.g.
 *  { kind: "upcoming", text: "Begins Sep 1, 2026" }
 *  { kind: "seasonal", text: "Seasonal" }
 *  { kind: "new",      text: "New" }
 */
export function newRouteLabel(route: Route): NewRouteLabel {
  if (isUpcomingNote(route.note)) {
    return { kind: "upcoming", text: tidyNote(route.note as string) };
  }
  if (route.seasonal) {
    return { kind: "seasonal", text: "Seasonal" };
  }
  return { kind: "new", text: "New" };
}
