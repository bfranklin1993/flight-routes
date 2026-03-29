interface FooterProps {
  lastUpdated: string | null;
}

export default function Footer({ lastUpdated }: FooterProps) {
  return (
    <div className="absolute bottom-2 left-3 text-xs text-gray-400 z-10">
      {lastUpdated && <>Last updated: {lastUpdated}</>}
    </div>
  );
}
