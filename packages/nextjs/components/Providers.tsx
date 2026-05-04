"use client";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "@/services/web3/wagmiConfig";
import { useCofhe } from "@/hooks/useCofhe";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

function CofheInit({ children }: { children: React.ReactNode }) {
  useCofhe();
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config} reconnectOnMount={true}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({
          accentColor: "#fafafa",
          accentColorForeground: "#000",
          borderRadius: "medium",
          fontStack: "system",
          overlayBlur: "small",
        })}>
          <CofheInit>{children}</CofheInit>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}