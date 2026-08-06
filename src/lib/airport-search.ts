import type { AirportIndex } from "./types";

/**
 * Rank airports for a search query.
 *
 * The naive approach (substring match on iata, name and city) is actively
 * misleading for the most common query shape there is: a three-letter airport
 * code. "ord" is a substring of Hartford, Bedford, Bradford, Concord, Cordova,
 * New Bedford and Gerald R. Ford, so typing the code for the third-busiest
 * airport in the country filled the dropdown with seven wrong answers.
 *
 * Two rules fix it:
 *
 * 1. Short queries (three characters or fewer) never match loose substrings.
 *    They match codes, and they match the START of a word in a city or airport
 *    name. "ord" no longer finds Hartford; "chi" still finds Chicago.
 * 2. Ties break on real airport size, so a query matching several airports
 *    surfaces the one the user almost certainly meant. "was" puts Washington
 *    ahead of Wasilla.
 */

const SHORT_QUERY_MAX = 3;

/** Match quality, lower is better. Ordering these is the whole ranking. */
const Tier = {
  ExactCode: 0,
  CodePrefix: 1,
  CityPrefix: 2,
  WordPrefix: 3,
  Substring: 4,
  None: 99,
} as const;

type Tier = (typeof Tier)[keyof typeof Tier];

function startsWithWord(haystack: string, needle: string): boolean {
  if (haystack.startsWith(needle)) return true;
  // Match the start of any word, so "hare" finds "O'Hare" and "worth" finds
  // "Dallas-Fort Worth". Split on anything that is not a letter or digit.
  return haystack
    .split(/[^a-z0-9]+/)
    .some((word) => word.length > 0 && word.startsWith(needle));
}

function tierFor(airport: AirportIndex, query: string, isShort: boolean): Tier {
  const iata = airport.iata.toLowerCase();
  const city = airport.city.toLowerCase();
  const name = airport.name.toLowerCase();

  if (iata === query) return Tier.ExactCode;
  if (iata.startsWith(query)) return Tier.CodePrefix;
  if (city.startsWith(query)) return Tier.CityPrefix;
  if (startsWithWord(city, query) || startsWithWord(name, query)) {
    return Tier.WordPrefix;
  }
  // Loose substring is useful for longer queries ("hare", "international")
  // but is the source of the wrong-airport problem for short ones.
  if (!isShort && (city.includes(query) || name.includes(query))) {
    return Tier.Substring;
  }
  return Tier.None;
}

export function searchAirports(
  airports: AirportIndex[],
  rawQuery: string,
  limit = 8
): AirportIndex[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];

  const isShort = query.length <= SHORT_QUERY_MAX;

  const scored: { airport: AirportIndex; tier: Tier }[] = [];
  for (const airport of airports) {
    const tier = tierFor(airport, query, isShort);
    if (tier !== Tier.None) scored.push({ airport, tier });
  }

  scored.sort((a, b) => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    const sizeDelta = (b.airport.passengers ?? 0) - (a.airport.passengers ?? 0);
    if (sizeDelta !== 0) return sizeDelta;
    return a.airport.iata.localeCompare(b.airport.iata);
  });

  return scored.slice(0, limit).map((s) => s.airport);
}
