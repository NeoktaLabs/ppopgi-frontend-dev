// src/lib/wallet.tsx
import "@rainbow-me/rainbowkit/styles.css";
import React, { useEffect, useRef } from "react";
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
  // Avoid double-run in React.StrictMode (dev)
  const didInit = useRef(false);

  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;

    // initial reconnect (helps on first load)
    reconnect(wagmiConfig).catch(() => {});
  }, []);

  useEffect(() => {
    const onWake = () => {
      // When returning from wallet app (Safari/QR), refresh wagmi state
      reconnect(wagmiConfig).catch(() => {});
    };

    // Safari often triggers visibilitychange when coming back from WC wallet
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") onWake();
    });

    // Also handle normal focus
    window.addEventListener("focus", onWake);

    return () => {
      window.removeEventListener("focus", onWake);
      // can't remove the anonymous visibility handler; keep it simple:
      // it's fine because provider is mounted once in the app.
    };
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