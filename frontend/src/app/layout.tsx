import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";

/**
 * Lexend est une police conçue et validée scientifiquement pour améliorer
 * la vitesse et le confort de lecture (projet de recherche soutenu par
 * Google Fonts). Ses formes de lettres larges et bien distinctes la
 * rendent nettement plus lisible pour les personnes âgées ou malvoyantes,
 * tout en conservant une allure sobre et professionnelle adaptée à un
 * outil métier.
 */
const lexend = Lexend({
  variable: "--font-primary-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ShiftDesk",
  description: "Gestion de l'accueil - pauses, plannings, demandes et supervision IA",
  icons: {
    icon: "/carrefour-logo.png",
    shortcut: "/carrefour-logo.png",
    apple: "/carrefour-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" className={`${lexend.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col print:block print:min-h-0 print:h-auto">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
