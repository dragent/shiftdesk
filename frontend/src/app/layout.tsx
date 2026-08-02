import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/AuthContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col print:block print:min-h-0 print:h-auto">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
