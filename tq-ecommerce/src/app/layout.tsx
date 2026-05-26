import type { Metadata } from "next";
import { Inter, Barlow_Condensed } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const barlowCondensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  variable: "--font-barlow",
});

export const metadata: Metadata = {
  title: {
    default: "Tres Quartos — Donde el rugby sigue vivo",
    template: "%s | Tres Quartos",
  },
  description: "Equipamiento deportivo de rugby y otros deportes. Del vestuario a tu equipo.",
  openGraph: {
    type: "website",
    locale: "es_AR",
    siteName: "Tres Quartos",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${inter.variable} ${barlowCondensed.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
