import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geist = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Brawl Prodigy",
  description: "Competitive Brawl Stars platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geist.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col" style={{ background: "var(--bs-bg)" }}>
        <nav
          className="border-b sticky top-0 z-50 backdrop-blur"
          style={{ background: "rgba(8,16,32,0.92)", borderColor: "var(--bs-border)" }}
        >
          <div className="max-w-5xl mx-auto px-4 h-12 flex items-center gap-6">
            <Link
              href="/"
              className="font-extrabold text-lg tracking-tight"
              style={{ color: "var(--bs-gold)" }}
            >
              ★ Brawl Prodigy
            </Link>
            <Link href="/" className="text-sm transition-colors hover:text-white" style={{ color: "var(--bs-muted)" }}>
              Leaderboard
            </Link>
            <Link href="/maps" className="text-sm transition-colors hover:text-white" style={{ color: "var(--bs-muted)" }}>
              Maps
            </Link>
            <Link href="/draft" className="text-sm transition-colors hover:text-white" style={{ color: "var(--bs-muted)" }}>
              Draft Tool
            </Link>
          </div>
        </nav>
        {children}
      </body>
    </html>
  );
}
