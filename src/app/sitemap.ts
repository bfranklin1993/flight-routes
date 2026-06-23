import type { MetadataRoute } from "next";
import { getAirportsWithRoutes } from "@/lib/airports-server";

const BASE_URL = "https://nonstoproutes.com";

export default function sitemap(): MetadataRoute.Sitemap {
  const airports = getAirportsWithRoutes();

  return [
    {
      url: BASE_URL,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${BASE_URL}/how-it-works`,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    ...airports.map((a) => ({
      url: `${BASE_URL}/${a.iata.toLowerCase()}`,
      changeFrequency: "monthly" as const,
      priority: 0.7,
    })),
  ];
}
