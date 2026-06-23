import Link from "next/link";

interface FooterProps {
  lastUpdated: string | null;
}

export default function Footer({ lastUpdated }: FooterProps) {
  return (
    <div className="absolute bottom-2 left-3 z-10 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-400">
      <span>Route data: US DOT / BTS · OurAirports · Wikipedia</span>
      <span aria-hidden="true">·</span>
      <Link
        href="/how-it-works"
        className="text-gray-500 underline decoration-gray-300 underline-offset-2 hover:text-gray-700"
      >
        How this works
      </Link>
      {lastUpdated && (
        <>
          <span aria-hidden="true">·</span>
          <span>Last updated: {lastUpdated}</span>
        </>
      )}
    </div>
  );
}
