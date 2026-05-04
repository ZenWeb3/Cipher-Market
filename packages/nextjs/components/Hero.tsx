"use client";

import { useEffect, useState } from "react";
import { useMarket } from "@/hooks/useMarket";
import { usePublicClient } from "wagmi";

export const Hero = () => {
  const publicClient = usePublicClient();
  const { getTotalMarkets, getAllMarkets } = useMarket();
  const [stats, setStats] = useState({ markets: 0, bets: 0, revealed: 0 });

  useEffect(() => {
    if (!publicClient) return;
    const load = async () => {
      try {
        const total = await getTotalMarkets();
        const all = await getAllMarkets(BigInt(0), Number(total));
        const totalBets = all.reduce((sum, m) => sum + Number(m.totalBets), 0);
        const settled = all.filter(m => m.status === 3).length;
        setStats({ markets: all.length, bets: totalBets, revealed: settled });
      } catch {}
    };
    load();
  }, [publicClient, getTotalMarkets, getAllMarkets]);

  return (
    <div style={{ marginBottom: 48 }}>
      {/* Tagline */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 44,
          fontWeight: 800,
          letterSpacing: "-0.04em",
          lineHeight: 1.1,
          marginBottom: 12,
        }}>
          Bet on anything.
          <br />
          <span style={{ color: "var(--cm-accent)" }}>Reveal nothing.</span>
        </h1>
        <p style={{ fontSize: 17, color: "var(--cm-text-secondary)", maxWidth: 520, lineHeight: 1.5 }}>
          The first prediction market where your bets are fully encrypted using 
          Fully Homomorphic Encryption. No one sees your position — not even us.
        </p>
      </div>

      {/* Live privacy stats */}
      <div style={{
        display: "flex",
        gap: 1,
        background: "var(--cm-border)",
        borderRadius: "var(--cm-radius-lg)",
        overflow: "hidden",
        maxWidth: 520,
      }}>
        <div style={{
          flex: 1, padding: "16px 20px",
          background: "var(--cm-surface)",
          borderRadius: "var(--cm-radius-lg) 0 0 var(--cm-radius-lg)",
        }}>
          <div style={{
            fontSize: 28, fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            color: "var(--cm-accent)",
          }}>
            {stats.bets}
          </div>
          <div style={{ fontSize: 12, color: "var(--cm-text-muted)", marginTop: 2 }}>
            bets sealed
          </div>
        </div>
        <div style={{
          flex: 1, padding: "16px 20px",
          background: "var(--cm-surface)",
        }}>
          <div style={{
            fontSize: 28, fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            color: "var(--cm-green-text)",
          }}>
            {stats.markets}
          </div>
          <div style={{ fontSize: 12, color: "var(--cm-text-muted)", marginTop: 2 }}>
            markets live
          </div>
        </div>
        <div style={{
          flex: 1, padding: "16px 20px",
          background: "var(--cm-surface)",
          borderRadius: "0 var(--cm-radius-lg) var(--cm-radius-lg) 0",
        }}>
          <div style={{
            fontSize: 28, fontWeight: 700,
            fontFamily: "'JetBrains Mono', monospace",
            color: "var(--cm-red-text)",
          }}>
            0
          </div>
          <div style={{ fontSize: 12, color: "var(--cm-text-muted)", marginTop: 2 }}>
            positions revealed
          </div>
        </div>
      </div>

      {/* FHE badge */}
      <div style={{
        display: "inline-flex", alignItems: "center", gap: 8,
        marginTop: 16, padding: "8px 14px",
        background: "var(--cm-accent-dim)",
        borderRadius: 100,
        border: "1px solid rgba(77, 201, 246, 0.15)",
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: "50%",
          background: "var(--cm-accent)",
          boxShadow: "0 0 8px var(--cm-accent)",
          animation: "pulse 2s ease-in-out infinite",
        }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--cm-accent)", letterSpacing: "0.02em" }}>
          Powered by Fhenix CoFHE — Base Sepolia
        </span>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
};