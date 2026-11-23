import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./poketrako.css";
import "./android.css";
import "./refinement.css";

export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export const metadata: Metadata = {
  title: "Poketra’ko — Ton argent, tes décisions",
  description: "Un atelier financier personnel : portefeuilles, projets, budgets continus et trésorerie en Ariary.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Poketra’ko", statusBarStyle: "default" },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
