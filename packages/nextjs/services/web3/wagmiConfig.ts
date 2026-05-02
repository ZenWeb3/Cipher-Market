"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { baseSepolia } from "wagmi/chains";

export const config = getDefaultConfig({
  appName: "CipherMarket",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo-project-id",
  chains: [baseSepolia],
  ssr: true,
});