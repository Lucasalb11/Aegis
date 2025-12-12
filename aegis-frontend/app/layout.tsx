import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ClientProviders } from "../src/providers/ClientProviders";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Aegis DEX",
  description: "Aegis Protocol AMM and liquidity management",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const programId = process.env.NEXT_PUBLIC_AEGIS_PROGRAM_ID;

  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-display bg-background-dark text-white`}>
        <ClientProviders programId={programId}>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
