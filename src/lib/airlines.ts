/**
 * Airline colours keyed by IATA carrier code.
 *
 * This is deliberately NOT a set of brand colours. Airline brand palettes are
 * dominated by near-identical dark blues (United #0051C3, Delta #003366,
 * JetBlue #003876, Alaska #00467F), which are hard to tell apart with normal
 * colour vision and collapse entirely under protanopia and deuteranopia.
 *
 * Instead these are drawn from the Okabe-Ito colourblind-safe qualitative
 * palette, anchored on the product's own vermillion (#C23E0E, also used on
 * /how-it-works). Verified with Vienot 1999 dichromat simulation: the closest
 * pair is dE 19.0 under deuteranopia and 20.7 under protanopia, versus dE 1.6
 * for the brand-colour palette this replaces.
 *
 * Only carriers large enough to read as distinct on a map get a hue. Everything
 * else shares OTHER_COLOR and is labelled "Other carriers" in the legend, which
 * is honest: a hub like ORD serves ~49 carriers, and pretending each has its own
 * identity produced 38 indistinguishable greys.
 */
const AIRLINE_COLORS: Record<string, string> = {
  UA: "#0072B2", // United — blue
  AA: "#C23E0E", // American — vermillion (product anchor)
  DL: "#CC79A7", // Delta — reddish purple
  WN: "#E69F00", // Southwest — amber
  B6: "#56B4E9", // JetBlue — sky blue
  AS: "#007A59", // Alaska — bluish green (darkened so white pill text clears AA)
};

/** Shared colour for every carrier without a dedicated hue. */
export const OTHER_COLOR = "#4B5563";

/** The product's signature vermillion. Used to emphasise a filtered carrier. */
export const ANCHOR_COLOR = "#C23E0E";

export function getAirlineColor(code: string): string {
  return AIRLINE_COLORS[code] || OTHER_COLOR;
}

/** True when this carrier falls into the shared "Other carriers" bucket. */
export function isOtherCarrier(code: string): boolean {
  return !AIRLINE_COLORS[code];
}

/**
 * Colour to draw a carrier's routes when it is the active filter.
 *
 * When a filter is applied the map shows only that carrier, so the colour no
 * longer needs to identify anyone. It needs to be visible. Carriers in the
 * shared bucket would otherwise render as flat grey, which reads as "nothing
 * happened" rather than "filter applied".
 */
export function getFocusColor(code: string): string {
  return AIRLINE_COLORS[code] || ANCHOR_COLOR;
}

/**
 * Returns true if the airline's colour is too light for white text.
 * Used to decide text colour on filter pills.
 *
 * Measured: with the paired text colour every pill clears WCAG AA (4.5:1) for
 * 12px text. Delta, Southwest and JetBlue need #1f2937; the rest take white.
 */
export function needsDarkText(code: string): boolean {
  return ["DL", "WN", "B6"].includes(code);
}
