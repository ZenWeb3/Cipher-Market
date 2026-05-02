"use client";

import { RainbowKitProvider, darkTheme } from "@rainbow-me/rainbowkit";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { config } from "@/services/web3/wagmiConfig";
import { useCofhe } from "@/hooks/useCofhe";
import "@rainbow-me/rainbowkit/styles.css";

const queryClient = new QueryClient();

function CofheInitializer({ children }: { children: React.ReactNode }) {
  useCofhe();
  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={config} reconnectOnMount={true}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={darkTheme({
            accentColor: "#00E5FF",
            accentColorForeground: "#020617",
            borderRadius: "small",
            fontStack: "system",
          })}
        >
          <CofheInitializer>
            {children}
          </CofheInitializer>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}