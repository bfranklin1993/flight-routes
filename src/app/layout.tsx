import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://nonstoproutes.com"),
  title: {
    default: "Nonstop Routes: Flight Maps from Any US Airport",
    template: "%s | Nonstop Routes",
  },
  description:
    "Interactive map of nonstop flight routes from US airports. See where you can fly, filter by airline, explore destinations.",
  openGraph: {
    siteName: "Nonstop Routes",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
