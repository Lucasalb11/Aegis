"use client";

import { WalletProviders } from "./WalletProviders";
import { AegisProvider } from "./AegisProvider";

type ClientProvidersProps = {
  programId: string | undefined;
  children: React.ReactNode;
};

export function ClientProviders({ programId, children }: ClientProvidersProps) {
  return (
    <WalletProviders>
      <AegisProvider programId={programId}>{children}</AegisProvider>
    </WalletProviders>
  );
}