import fs from "fs";
import path from "path";
import { cache } from "react";
import type { AirportIndex, AirportRoutes } from "@/lib/types";

const DATA_DIR = path.join(process.cwd(), "public", "data");

export const getAllAirports = cache((): AirportIndex[] => {
  const file = path.join(DATA_DIR, "airports.json");
  const raw = fs.readFileSync(file, "utf-8");
  return JSON.parse(raw) as AirportIndex[];
});

export const getAirportRoutes = cache((iata: string): AirportRoutes | null => {
  const code = iata.toLowerCase();
  const file = path.join(DATA_DIR, "routes", `${code}.json`);
  try {
    const raw = fs.readFileSync(file, "utf-8");
    return JSON.parse(raw) as AirportRoutes;
  } catch {
    return null;
  }
});

export const getAirportsWithRoutes = cache((): AirportIndex[] => {
  return getAllAirports().filter((a) => {
    const file = path.join(DATA_DIR, "routes", `${a.iata.toLowerCase()}.json`);
    return fs.existsSync(file);
  });
});
