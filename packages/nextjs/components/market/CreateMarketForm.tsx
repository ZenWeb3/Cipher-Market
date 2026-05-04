"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useMarket } from "@/hooks/useMarket";

interface CreateMarketFormProps {
  onSuccess?: () => void;
}

export const CreateMarketForm = ({ onSuccess }: CreateMarketFormProps) => {
  const { address } = useAccount();
  const { createMarket, isLoading } = useMarket();
  const [question, setQuestion] = useState("");
  const [duration, setDuration] = useState("1");

  const durations = [
    { value: "0.05", label: "3m" },
    { value: "0.5", label: "30m" },
    { value: "1", label: "1h" },
    { value: "6", label: "6h" },
    { value: "24", label: "24h" },
    { value: "72", label: "3d" },
  ];

  const submit = async () => {
    if (!question.trim()) return;
    const hours = parseFloat(duration) || 1;
    const now = Math.floor(Date.now() / 1000);
    const result = await createMarket(question.trim(), BigInt(now + 60), BigInt(now + Math.floor(hours * 3600)));
    if (result !== null) {
      setQuestion("");
      onSuccess?.();
    }
  };

  if (!address) {
    return <div style={{ padding: "48px 0", textAlign: "center", color: "var(--text-3)", fontSize: 13 }}>Connect wallet to create</div>;
  }

  return (
    <div style={{ maxWidth: 480, margin: "0 auto" }} className="fade-in">
      <div className="card" style={{ padding: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>New Market</h2>
        <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 24 }}>Ask a yes/no question. All bets are encrypted.</p>

        {/* Question */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Question</label>
            <span style={{ fontSize: 10, color: "var(--text-3)" }}>{question.length}/200</span>
          </div>
          <textarea value={question} onChange={e => setQuestion(e.target.value.slice(0, 200))}
            placeholder="Will ETH hit $5,000 by June 30?"
            className="textarea" style={{ height: 72 }} disabled={isLoading} />
        </div>

        {/* Duration */}
        <div style={{ marginBottom: 24 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "var(--text-3)", textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>Duration</label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 4 }}>
            {durations.map(d => (
              <button key={d.value} onClick={() => setDuration(d.value)} disabled={isLoading}
                style={{
                  padding: "7px 0", fontSize: 12, fontWeight: 600, fontFamily: "'JetBrains Mono'",
                  background: duration === d.value ? "var(--surface-3)" : "var(--surface)",
                  border: `1px solid ${duration === d.value ? "var(--border-hover)" : "var(--border)"}`,
                  borderRadius: 6, color: duration === d.value ? "var(--text)" : "var(--text-3)",
                  cursor: "pointer", transition: "all 0.15s",
                }}>
                {d.label}
              </button>
            ))}
          </div>
        </div>

        {/* Privacy */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 12px", background: "var(--surface-2)", borderRadius: "var(--radius)",
          marginBottom: 20, border: "1px solid var(--border)",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>All bets encrypted via FHE</span>
        </div>

        <button onClick={submit} disabled={isLoading || !question.trim()}
          className="btn btn-white" style={{ width: "100%", padding: "11px", fontSize: 14 }}>
          {isLoading && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>}
          Create Market
        </button>
      </div>
    </div>
  );
};