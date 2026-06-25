import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How Nonstop Routes Works",
  description:
    "How Nonstop Routes is built: official US DOT (BTS) filings for passenger volume and airlines, and OurAirports for airport locations.",
  alternates: { canonical: "/how-it-works" },
  openGraph: {
    title: "How Nonstop Routes Works",
    description:
      "Where the routes come from: official US DOT (BTS) filings and OurAirports data, assembled into one interactive map.",
    url: "/how-it-works",
    type: "article",
  },
};

const SOURCES = [
  {
    label: "Volume & airlines",
    name: "US DOT (BTS)",
    desc: "Every passenger and departure US carriers officially report. The source of truth for which routes fly and how busy each one is.",
  },
  {
    label: "Airports",
    name: "OurAirports",
    desc: "Open airport locations, names, and codes that place every dot on the map.",
  },
];

export default function HowItWorksPage() {
  return (
    <main className="min-h-screen bg-[#FBFAF6] text-[#11110F]">
      <div className="mx-auto max-w-[720px] px-6 py-16 sm:py-24">
        <Link
          href="/"
          className="text-sm font-medium text-[#C23E0E] underline decoration-[#FF5A1F]/40 underline-offset-2 hover:decoration-[#FF5A1F]"
        >
          ← Back to the map
        </Link>

        <p className="mt-10 font-mono text-xs uppercase tracking-[0.1em] text-[#C23E0E]">
          How this works
        </p>
        <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
          Where these routes come from
        </h1>
        <p className="mt-5 text-lg leading-relaxed text-[#56544E]">
          Nonstop Routes is built on the official record of US air travel: the
          same Department of Transportation filings the airlines themselves
          report. No estimates, no scraped booking sites.
        </p>

        <h2 className="mt-12 text-xl font-bold tracking-tight">
          Two sources, one map
        </h2>
        <p className="mt-3 leading-relaxed text-[#56544E]">
          Each route on the map is assembled from authoritative, public data. We
          do not guess and we do not scrape booking sites.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {SOURCES.map((s) => (
            <div
              key={s.name}
              className="rounded-xl border border-[#E6E2D8] bg-white p-5"
            >
              <p className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#C23E0E]">
                {s.label}
              </p>
              <p className="mt-2 text-lg font-bold tracking-tight">{s.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-[#56544E]">
                {s.desc}
              </p>
            </div>
          ))}
        </div>

        <h2 className="mt-12 text-xl font-bold tracking-tight">
          How fresh is it?
        </h2>
        <p className="mt-3 leading-relaxed text-[#56544E]">
          Routes and passenger-volume figures reflect the most recent DOT
          reporting cycle, which the government publishes on a rolling
          several-month delay. It is the authoritative record of what actually
          flew, so the map trades real-time speed for accuracy you can trust.
        </p>

        <p className="mt-14 border-t border-[#E6E2D8] pt-6 text-sm leading-relaxed text-[#56544E]">
          Passenger and departure figures are from the U.S. Bureau of
          Transportation Statistics (public domain). Airport data from
          OurAirports (public domain).
        </p>
      </div>
    </main>
  );
}
