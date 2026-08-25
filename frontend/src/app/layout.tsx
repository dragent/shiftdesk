import type { Metadata } from "next";
import { Lexend } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";
import { UnreadNotesProvider } from "@/lib/UnreadNotesContext";

/**
 * Lexend is a typeface designed and scientifically validated to improve
 * reading speed and comfort (research project backed by Google Fonts).
 * Its wide, clearly distinct letterforms make it noticeably more legible
 * for elderly or visually impaired users, while keeping the sober,
 * professional look expected from a business tool.
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
        <AuthProvider>
          <UnreadNotesProvider>{children}</UnreadNotesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
