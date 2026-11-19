import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Poketra — Tes finances, à ton rythme",
  description: "Portefeuilles, projets, réserve de sécurité et budgets continus en Ariary.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Poketra", statusBarStyle: "default" },
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
