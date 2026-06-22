import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  getAirportRoutes,
  getAirportsWithRoutes,
} from "@/lib/airports-server";
import RouteExplorer from "@/components/RouteExplorer";

export const dynamicParams = true;

const BASE_URL = "https://nonstoproutes.com";

export function generateStaticParams() {
  return getAirportsWithRoutes().map((a) => ({ iata: a.iata.toLowerCase() }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ iata: string }>;
}): Promise<Metadata> {
  const { iata: rawIata } = await params;
  const iata = rawIata.toLowerCase();
  const data = getAirportRoutes(iata);

  if (!data) {
    return {
      title: "Airport not found",
      description: "No nonstop route data is available for this airport.",
    };
  }

  const { airport, routes } = data;
  const IATA = airport.iata.toUpperCase();

  const title = `Nonstop Flights from ${airport.city} (${IATA}), ${airport.name}`;
  const description = `See all ${routes.length} nonstop destinations you can fly to from ${airport.name} (${IATA}) in ${airport.city}. Explore routes on an interactive map and filter by airline.`;
  const url = "/" + iata;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: "website",
    },
  };
}

export default async function AirportPage({
  params,
}: {
  params: Promise<{ iata: string }>;
}) {
  const { iata: rawIata } = await params;
  const iata = rawIata.toLowerCase();
  const data = getAirportRoutes(iata);

  if (!data) {
    notFound();
  }

  const { airport, routes } = data;
  const IATA = airport.iata.toUpperCase();

  const sortedRoutes = [...routes].sort(
    (a, b) => b.total_annual_passengers - a.total_annual_passengers
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `Nonstop destinations from ${airport.name} (${IATA})`,
    description: `Nonstop flight destinations from ${airport.name} (${IATA}) in ${airport.city}.`,
    numberOfItems: sortedRoutes.length,
    itemListElement: sortedRoutes.map((route, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: `${route.destination.city} (${route.destination.iata})`,
      url: `${BASE_URL}/${route.destination.iata.toLowerCase()}`,
    })),
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* Crawlable SEO content */}
      <section className="sr-only">
        <h1>
          Nonstop flights from {airport.name} ({IATA})
        </h1>
        <p>
          {airport.name} ({IATA}) in {airport.city} has {sortedRoutes.length}{" "}
          nonstop destinations. Explore every route on an interactive map and
          filter by airline.
        </p>
        <ul>
          {sortedRoutes.map((route) => (
            <li key={route.destination.iata}>
              <Link href={`/${route.destination.iata.toLowerCase()}`}>
                {route.destination.city} ({route.destination.iata})
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <RouteExplorer initialAirport={airport} />
    </>
  );
}
