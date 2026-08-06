export interface Airport {
  iata: string;
  name: string;
  city: string;
  region?: string;
  lat: number;
  lon: number;
}

export interface AirlineRoute {
  code: string;
  name: string;
  weekly_flights: number;
  annual_passengers: number;
}

export interface Route {
  destination: Airport;
  airlines: AirlineRoute[];
  distance_miles: number;
  total_annual_passengers: number;
}

export interface AirportRoutes {
  airport: Airport;
  routes: Route[];
  last_updated: string;
}

export interface AirportIndex {
  iata: string;
  name: string;
  city: string;
  region?: string;
  lat: number;
  lon: number;
  /** Total annual departing passengers. Ranks search results by real size. */
  passengers?: number;
}
