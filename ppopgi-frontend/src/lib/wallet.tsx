// src/lib/wallet.tsx
import "@rainbow-me/rainbowkit/styles.css";
import React, { useEffect } from "react";
import { RainbowKitProvider, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider, http } from "wagmi";
import { reconnect } from "wagmi/actions";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { etherlink } from "viem/chains";

const projectId = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID as string;

const rpcUrl =
  (import.meta.env.VITE_RPC_URL as string) || "https://node.mainnet.etherlink.com";

const chains = [etherlink] as const;

export const wagmiConfig = getDefaultConfig({
  appName: "Ppopgi",
  projectId,
  chains,
  transports: {
    [etherlink.id]: http(rpcUrl),
  },
  ssr: false,
});

const queryClient = new QueryClient();

export function WalletProviders({ children }: { children: React.ReactNode }) {
  // ✅ Force reconnect on mount (fixes “connected only after refresh” for QR / WC sessions)
  useEffect(() => {
    reconnect(wagmiConfig).catch(() => {});
  }, []);

  return (
    <WagmiProvider config={wagmiConfig} reconnectOnMount={true}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider initialChain={etherlink}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}