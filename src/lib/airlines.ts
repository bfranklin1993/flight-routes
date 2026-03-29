/**
 * Airline brand colors keyed by IATA carrier code.
 * Fallback to a neutral gray for unknown airlines.
 */
const AIRLINE_COLORS: Record<string, string> = {
  UA: "#0051C3", // United
  AA: "#B31942", // American
  DL: "#003366", // Delta
  WN: "#F9A01B", // Southwest
  B6: "#003876", // JetBlue
  AS: "#00467F", // Alaska
  NK: "#FFE600", // Spirit (use dark text)
  F9: "#01A651", // Frontier
  G4: "#702F8A", // Allegiant
  HA: "#7B2D8E", // Hawaiian
  SY: "#E31837", // Sun Country
};

const DEFAULT_COLOR = "#6B7280"; // gray-500

export function getAirlineColor(code: string): string {
  return AIRLINE_COLORS[code] || DEFAULT_COLOR;
}

/**
 * Returns true if the airline's brand color is too light for white text.
 * Used to decide text color on filter pills.
 */
export function needsDarkText(code: string): boolean {
  return ["NK", "WN"].includes(code);
}
