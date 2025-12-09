import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { WalletProvider } from '@/components/providers/wallet-provider';
import { AegisProvider } from '@/components/providers/aegis-provider';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { Toaster } from 'sonner';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Aegis Protocol - AI Agent Vaults',
  description: 'Secure AI agent fund management on Solana with programmable spending policies',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className={inter.className}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <WalletProvider>
            <AegisProvider>
              {children}
            </AegisProvider>
          </WalletProvider>
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
