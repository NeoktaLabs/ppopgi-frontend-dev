// src/lib/wallet.tsx
import "@rainbow-me/rainbowkit/styles.css";
import React from "react";
import { RainbowKitProvider } from "@rainbow-me/rainbowkit";
import { WagmiProvider, createConfig, http } from "wagmi";
import { etherlink } from "viem/chains";
import { injected, walletConnect } from "wagmi/connectors";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const RPC = (import.meta.env.VITE_RPC_URL as string) || "https://node.mainnet.etherlink.com";
const wcProjectId = (import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string) || "";

const connectors = [
  // MetaMask / Injected — most reliable for your case
  injected({ shimDisconnect: true }),
  // WalletConnect (optional)
  ...(wcProjectId ? [walletConnect({ projectId: wcProjectId, showQrModal: true })] : []),
];

export const wagmiConfig = createConfig({
  chains: [etherlink],
  connectors,
  transports: {
    [etherlink.id]: http(RPC),
  },
  ssr: false,
});

const queryClient = new QueryClient();

export function WalletProviders({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider>{children}</RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}