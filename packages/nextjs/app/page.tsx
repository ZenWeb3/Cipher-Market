"use client";

import { Navbar } from "@/components/Navbar";
import { MarketsPage } from "@/components/market";
import { MintPage } from "@/components/mint";
import { useMarketStore } from "@/services/store/marketStore";

export default function Home() {
  const mainTab = useMarketStore((state) => state.mainTab);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)" }}>
      <Navbar />
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px 64px" }}>
        {mainTab === "markets" ? <MarketsPage /> : <MintPage />}
      </main>
    </div>
  );
}