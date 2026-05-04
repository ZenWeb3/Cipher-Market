"use client";

import { useState, useEffect } from "react";
import {
  MarketData, MarketStatus,
  getEffectiveStatus, formatTokenAmount, getOutcomeLabel,
} from "@/utils/marketContracts";

interface MarketCardProps {
  market: MarketData;
  onClick?: () => void;
}

function timeLeft(market: MarketData): string {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now < market.startTime) return "Not started";
  if (now >= market.endTime) return "Ended";
  const s = Number(market.endTime - now);
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86400)}d`;
}

function statusInfo(market: MarketData): { cls: string; label: string } {
  const s = getEffectiveStatus(market);
  return {
    [MarketStatus.Active]: { cls: "badge-live", label: "Live" },
    [MarketStatus.Closed]: { cls: "badge-closed", label: "Closed" },
    [MarketStatus.Resolved]: { cls: "badge-resolving", label: "Resolving" },
    [MarketStatus.Settled]: { cls: "badge-settled", label: "Settled" },
    [MarketStatus.Cancelled]: { cls: "badge-cancelled", label: "Cancelled" },
  }[s] || { cls: "", label: "" };
}

export const MarketCard = ({ market, onClick }: MarketCardProps) => {
  const [, tick] = useState(0);
  useEffect(() => {
    const s = getEffectiveStatus(market);
    if (s === MarketStatus.Active) {
      const iv = setInterval(() => tick(t => t + 1), 1000);
      return () => clearInterval(iv);
    }
  }, [market]);

  const st = statusInfo(market);
  const isSettled = market.status === MarketStatus.Settled;
  const total = Number(market.yesBettors) + Number(market.noBettors);
  const yesPct = total > 0 ? Math.round((Number(market.yesBettors) / total) * 100) : 50;

  return (
    <div onClick={onClick} className={`card ${onClick ? "card-hover" : ""}`} style={{ padding: 20 }}>
      {/* Status + time */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <span className={`badge ${st.cls}`}>
          {st.label === "Live" && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />}
          {st.label}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-3)", fontFamily: "'JetBrains Mono'" }}>
          {timeLeft(market)}
        </span>
      </div>

      {/* Question */}
      <p style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.45, marginBottom: 16, color: "var(--text)" }}>
        {market.question}
      </p>

      {/* Yes/No bar */}
      <div style={{ display: "flex", height: 34, borderRadius: 6, overflow: "hidden", gap: 2, marginBottom: 14 }}>
        <div style={{
          flex: yesPct, background: "var(--green-dim)", display: "flex",
          alignItems: "center", justifyContent: "center", minWidth: 44, borderRadius: "6px 0 0 6px",
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--green-text)" }}>Yes {yesPct}%</span>
        </div>
        <div style={{
          flex: 100 - yesPct, background: "var(--red-dim)", display: "flex",
          alignItems: "center", justifyContent: "center", minWidth: 44, borderRadius: "0 6px 6px 0",
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--red-text)" }}>No {100 - yesPct}%</span>
        </div>
      </div>

      {/* Settled pools */}
      {isSettled && (
        <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
          <div style={{ flex: 1, padding: "6px 0", textAlign: "center", background: "var(--green-dim)", borderRadius: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--green-text)", fontFamily: "'JetBrains Mono'" }}>
              {formatTokenAmount(market.decryptedYesPool)} AUCT
            </span>
          </div>
          <div style={{ flex: 1, padding: "6px 0", textAlign: "center", background: "var(--red-dim)", borderRadius: 4 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--red-text)", fontFamily: "'JetBrains Mono'" }}>
              {formatTokenAmount(market.decryptedNoPool)} AUCT
            </span>
          </div>
        </div>
      )}

      {/* Winner */}
      {isSettled && (
        <div style={{
          padding: "5px 10px", background: "var(--surface-2)", borderRadius: 4,
          display: "inline-flex", alignItems: "center", gap: 4, marginBottom: 12,
          fontSize: 11, color: "var(--text-2)", fontWeight: 600,
        }}>
          ✓ {getOutcomeLabel(market.winningOutcome)} won
        </div>
      )}

      {/* Footer */}
      <div style={{
        display: "flex", justifyContent: "space-between",
        paddingTop: 12, borderTop: "1px solid var(--border)",
        fontSize: 11, color: "var(--text-3)",
      }}>
        <span>{market.totalBets.toString()} bet{market.totalBets !== BigInt(1) ? "s" : ""}</span>
        {!isSettled && (
          <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            encrypted
          </span>
        )}
      </div>
    </div>
  );
};