"use client";

import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import { useMarketStore } from "@/services/store/marketStore";

export const Navbar = () => {
  const { isConnected, address } = useAccount();
  const { disconnect } = useDisconnect();
  const { openConnectModal } = useConnectModal();
  const { mainTab, setMainTab } = useMarketStore();

  return (
    <nav style={{
      borderBottom: "1px solid var(--border)",
      background: "rgba(0,0,0,0.85)",
      backdropFilter: "blur(16px)",
      position: "sticky", top: 0, zIndex: 40,
    }}>
      <div style={{
        maxWidth: 1100, margin: "0 auto", padding: "0 24px",
        height: 52, display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        {/* Left: Logo + Nav */}
        <div style={{ display: "flex", alignItems: "center", gap: 32 }}>
          <div
            onClick={() => setMainTab("markets")}
            style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
          >
      
            <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.03em" }}>
             <span style={{ color: "var(--text)" }}>Umbra</span>
            </span>
          </div>

          <div style={{ display: "flex", gap: 0 }}>
            <button
              onClick={() => setMainTab("markets")}
              className={`tab ${mainTab === "markets" ? "tab-active" : ""}`}
              style={{ fontSize: 13, marginRight: 16 }}
            >
              Markets
            </button>
            <button
              onClick={() => setMainTab("mint")}
              className={`tab ${mainTab === "mint" ? "tab-active" : ""}`}
              style={{ fontSize: 13 }}
            >
              Faucet
            </button>
          </div>
        </div>

        {/* Right: Wallet */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {isConnected && address ? (
            <>
              <span style={{
                padding: "4px 8px", fontSize: 10, fontWeight: 600,
                color: "var(--green-text)", background: "var(--green-dim)",
                borderRadius: 100, border: "1px solid rgba(34,197,94,0.15)",
              }}>
                Base Sepolia
              </span>
              <span style={{
                padding: "5px 10px", fontSize: 12,
                fontFamily: "'JetBrains Mono'", color: "var(--text-2)",
                background: "var(--surface)", border: "1px solid var(--border)",
                borderRadius: "var(--radius)",
              }}>
                {address.slice(0, 6)}...{address.slice(-4)}
              </span>
              <button onClick={() => disconnect()} className="btn" style={{ padding: "5px 10px", fontSize: 11 }}>
                ×
              </button>
            </>
          ) : (
            <button onClick={() => openConnectModal?.()} className="btn btn-white" style={{ padding: "6px 16px", fontSize: 12 }}>
              Connect
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};