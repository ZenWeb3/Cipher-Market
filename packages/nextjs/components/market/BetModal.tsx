"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { useMarket } from "@/hooks/useMarket";
import { MarketData, Outcome, getOutcomeLabel } from "@/utils/marketContracts";

interface BetModalProps {
  market: MarketData;
  onClose: () => void;
  onSuccess: () => void;
}

const EncryptingOverlay = () => {
  const [text, setText] = useState("Encrypting bet...");
  const glitch = "█▓▒░╔╗╚╝║═■●◆";

  useEffect(() => {
    const msgs = ["Encrypting amount...", "Generating ciphertext...", "Sealing position...", "Submitting to chain..."];
    let idx = 0, frame = 0;
    const iv = setInterval(() => {
      frame++;
      if (frame % 30 === 0) idx = Math.min(idx + 1, msgs.length - 1);
      setText(msgs[idx].split("").map((c, i) =>
        c === " " ? " " : Math.random() > 0.65 ? glitch[Math.floor(Math.random() * glitch.length)] : c
      ).join(""));
    }, 60);
    return () => clearInterval(iv);
  }, []);

  return (
    <div style={{
      position: "absolute", inset: 0, background: "rgba(0,0,0,0.9)",
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      borderRadius: "var(--radius-lg)", zIndex: 10,
    }}>
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" strokeWidth="1.5"
        style={{ marginBottom: 16, animation: "spin 2s linear infinite" }}>
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" stroke="var(--text-2)" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" stroke="var(--text-2)" />
        <circle cx="12" cy="16" r="1.5" fill="var(--text-2)">
          <animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite" />
        </circle>
      </svg>
      <span style={{ fontFamily: "'JetBrains Mono'", fontSize: 12, color: "var(--text-3)", letterSpacing: "0.05em" }}>
        {text}
      </span>
    </div>
  );
};

export const BetModal = ({ market, onClose, onSuccess }: BetModalProps) => {
  const { address } = useAccount();
  const { placeBet, isLoading } = useMarket();
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [amount, setAmount] = useState("");
  const [encrypting, setEncrypting] = useState(false);

  const submit = async () => {
    if (outcome === null || !amount || !address) return;
    setEncrypting(true);
    const result = await placeBet(market.id, outcome, BigInt(Math.floor(parseFloat(amount) * 1_000_000)));
    setEncrypting(false);
    if (result) { onSuccess(); onClose(); }
  };

  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget && !encrypting) onClose(); }}>
      <div className="modal" style={{ padding: 24, position: "relative", overflow: "hidden" }}>
        {encrypting && <EncryptingOverlay />}

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em", fontWeight: 600 }}>Place a bet</div>
            <h3 style={{ fontSize: 17, fontWeight: 600, lineHeight: 1.3 }}>{market.question}</h3>
          </div>
          <button onClick={onClose} disabled={encrypting}
            style={{ background: "none", border: "none", color: "var(--text-3)", cursor: "pointer", fontSize: 18, padding: 4 }}>×</button>
        </div>

        {/* Yes / No */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
          {[Outcome.Yes, Outcome.No].map(o => {
            const isYes = o === Outcome.Yes;
            const selected = outcome === o;
            const color = isYes ? "var(--green)" : "var(--red)";
            const dim = isYes ? "var(--green-dim)" : "var(--red-dim)";
            const textColor = isYes ? "var(--green-text)" : "var(--red-text)";
            return (
              <button key={o} onClick={() => setOutcome(o)} disabled={encrypting}
                style={{
                  padding: "20px 12px", borderRadius: "var(--radius)",
                  border: `2px solid ${selected ? color : "var(--border)"}`,
                  background: selected ? dim : "transparent",
                  color: selected ? textColor : "var(--text-3)",
                  cursor: encrypting ? "not-allowed" : "pointer",
                  fontWeight: 700, fontSize: 16, fontFamily: "'DM Sans'",
                  transition: "all 0.15s",
                }}>
                {isYes ? "Yes" : "No"}
              </button>
            );
          })}
        </div>

        {/* Amount */}
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", display: "block", marginBottom: 6 }}>
            Amount (AUCT)
          </label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0.00" className="input" style={{ fontSize: 18, fontWeight: 600, padding: "12px" }}
            disabled={encrypting} />
          <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
            {[10, 50, 100, 500].map(v => (
              <button key={v} onClick={() => setAmount(v.toString())} disabled={encrypting}
                style={{
                  flex: 1, padding: "6px 0", fontSize: 12, fontWeight: 600,
                  fontFamily: "'JetBrains Mono'",
                  background: amount === v.toString() ? "var(--surface-3)" : "var(--surface)",
                  border: `1px solid ${amount === v.toString() ? "var(--border-hover)" : "var(--border)"}`,
                  borderRadius: 6, color: "var(--text-2)", cursor: "pointer",
                }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Privacy */}
        <div style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "8px 12px", background: "var(--surface-2)",
          borderRadius: "var(--radius)", marginBottom: 20,
          border: "1px solid var(--border)",
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--text-3)" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span style={{ fontSize: 11, color: "var(--text-3)" }}>Encrypted end-to-end with FHE</span>
        </div>

        {/* Submit */}
        <button onClick={submit}
          disabled={outcome === null || !amount || encrypting}
          className={`btn ${outcome === Outcome.Yes ? "btn-green" : outcome === Outcome.No ? "btn-red" : "btn-white"}`}
          style={{ width: "100%", padding: "12px", fontSize: 14 }}>
          {outcome !== null ? `Bet ${getOutcomeLabel(outcome)} — ${amount || "0"} AUCT` : "Select outcome"}
        </button>
      </div>
    </div>
  );
};