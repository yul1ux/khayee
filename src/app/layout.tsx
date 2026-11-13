import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Khayee | Find your next adventure",
  description:
    "Discover small-group hikes, treks, camping trips, and outdoor adventures around Mandalay and across Myanmar.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <Suspense fallback={<MarketplaceHeaderFallback />}>
          <MarketplaceHeader />
        </Suspense>
        {children}
      </body>
    </html>
  );
}

function MarketplaceHeaderFallback() {
  return (
    <header aria-busy="true" className="h-[77px] border-b border-[#e9e7df] bg-[#fbfaf7]">
      <div className="page-shell flex h-full items-center">
        <span className="h-9 w-28 animate-pulse bg-[#f0efe9]" />
      </div>
    </header>
  );
}
