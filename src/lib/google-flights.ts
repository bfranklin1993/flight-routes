/**
 * Build a Google Flights search URL for a given origin/destination pair.
 */
export function googleFlightsUrl(origin: string, destination: string): string {
  return `https://www.google.com/travel/flights?q=flights+from+${origin}+to+${destination}`;
}
