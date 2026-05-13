"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { useCofhe } from "@/hooks/useCofhe";
import { useMarket } from "@/hooks/useMarket";
import { BetModal } from "./BetModal";
import { SuccessModal } from "../SuccessModal";
import { MarketChat } from "./MarketChat";
import {
  MarketData,
  MarketStatus,
  Outcome,
  getEffectiveStatus,
  formatTokenAmount,
  getOutcomeLabel,
} from "@/utils/marketContracts";

interface MarketDetailProps {
  marketId: bigint;
  onBack: () => void;
  onActionSuccess?: (title: string, message: string) => void;
}

export const MarketDetail = ({
  marketId,
  onBack,
  onActionSuccess,
}: MarketDetailProps) => {
  const { address } = useAccount();
  const { isInitialized: isCofheReady } = useCofhe();
  const {
    getMarket,
    hasBetOnMarket,
    getBettorOutcome,
    hasClaimedFromMarket,
    resolveMarket,
    finalizeSettlement,
    claimWinnings,
    claimRefund,
    cancelMarket,
    isLoading,
  } = useMarket();

  const [market, setMarket] = useState<MarketData | null>(null);
  const [userHasBet, setUserHasBet] = useState(false);
  const [userOutcome, setUserOutcome] = useState<Outcome | null>(null);
  const [userHasClaimed, setUserHasClaimed] = useState(false);
  const [loadingData, setLoadingData] = useState(true);
  const [showBet, setShowBet] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [resolveStep, setResolveStep] = useState("");
  const [successModal, setSuccessModal] = useState<{
    title: string;
    message: string;
  } | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const load = useCallback(async () => {
    const m = await getMarket(marketId);
    setMarket(m);
    if (address && m) {
      const [bet, outcome, claimed] = await Promise.all([
        hasBetOnMarket(marketId, address),
        getBettorOutcome(marketId, address),
        hasClaimedFromMarket(marketId, address),
      ]);
      setUserHasBet(bet);
      setUserOutcome(bet ? outcome : null);
      setUserHasClaimed(claimed);
    }
    setLoadingData(false);
  }, [
    marketId,
    address,
    getMarket,
    hasBetOnMarket,
    getBettorOutcome,
    hasClaimedFromMarket,
  ]);

  useEffect(() => {
    setLoadingData(true);
    load();
  }, [load]);
  useEffect(() => {
    pollRef.current = setInterval(load, 8000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  if (loadingData || !market) {
    return (
      <div
        style={{
          padding: "80px 0",
          textAlign: "center",
          color: "var(--text-3)",
        }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          className="spin"
          style={{ margin: "0 auto 8px", display: "block" }}
        >
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        Loading...
      </div>
    );
  }

  const eff = getEffectiveStatus(market);
  const isCreator = address?.toLowerCase() === market.creator.toLowerCase();
  const now = BigInt(Math.floor(Date.now() / 1000));
  const hasEnded = now >= market.endTime;
  const hasStarted = now >= market.startTime;
  const isActive =
    market.status === MarketStatus.Active && hasStarted && !hasEnded;
  const canBet = isActive && !userHasBet && !!address;
  const canResolve =
    isCreator &&
    market.status === MarketStatus.Active &&
    hasEnded &&
    market.totalBets > BigInt(0);
  const canFinalize = market.status === MarketStatus.Resolved;
  const isSettled = market.status === MarketStatus.Settled;
  const isWinner =
    isSettled && userHasBet && userOutcome === market.winningOutcome;
  const isLoser =
    isSettled && userHasBet && userOutcome !== market.winningOutcome;
  const canClaimWin = isWinner && !userHasClaimed;
  const canClaimRefund = isLoser && !userHasClaimed;
  const noBets =
    market.status === MarketStatus.Active &&
    hasEnded &&
    market.totalBets === BigInt(0);
  const busy = isLoading || resolving;

  const total = Number(market.yesBettors) + Number(market.noBettors);
  const yesPct =
    total > 0 ? Math.round((Number(market.yesBettors) / total) * 100) : 50;

  const handleResolve = async (outcome: Outcome) => {
    setResolving(true);
    setResolveStep("Resolving...");
    const ok = await resolveMarket(marketId, outcome);
    if (!ok) {
      setResolving(false);
      setResolveStep("");
      return;
    }
    setResolveStep("Decrypting pools...");
    await new Promise((r) => setTimeout(r, 2000));
    const fin = await finalizeSettlement(marketId);
    setResolveStep("");
    setResolving(false);
    await load();
    if (fin)
      setSuccessModal({
        title: "Market Settled",
        message: `${getOutcomeLabel(outcome)} wins. Pool totals have been decrypted and are now visible.`,
      });
  };

  const handleFinalize = async () => {
    const ok = await finalizeSettlement(marketId);
    if (ok) {
      await load();
      setSuccessModal({
        title: "Settlement Complete",
        message: "Pool totals decrypted successfully.",
      });
    }
  };

  const handleClaim = async () => {
    const ok = await claimWinnings(marketId);
    if (ok) {
      await load();
      setSuccessModal({
        title: "Winnings Claimed",
        message: "Your encrypted bet has been returned to your wallet.",
      });
    }
  };

  const handleRefund = async () => {
    const ok = await claimRefund(marketId);
    if (ok) {
      await load();
      setSuccessModal({
        title: "Refund Claimed",
        message: "Your bet has been returned to your wallet.",
      });
    }
  };

  const statusBadge: Record<number, { cls: string; label: string }> = {
    [MarketStatus.Active]: { cls: "badge-live", label: "Live" },
    [MarketStatus.Closed]: { cls: "badge-closed", label: "Closed" },
    [MarketStatus.Resolved]: { cls: "badge-resolving", label: "Resolving" },
    [MarketStatus.Settled]: { cls: "badge-settled", label: "Settled" },
    [MarketStatus.Cancelled]: { cls: "badge-cancelled", label: "Cancelled" },
  };
  const sb = statusBadge[eff] || { cls: "", label: "" };

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }} className="fade-in">
      {/* Back */}
      <button
        onClick={onBack}
        className="btn"
        style={{ marginBottom: 20, padding: "5px 12px", fontSize: 12 }}
      >
        ← Back
      </button>

      {/* Main */}
      <div className="card" style={{ padding: 28, marginBottom: 12 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "var(--text-3)",
              fontFamily: "'JetBrains Mono'",
            }}
          >
            #{market.id.toString()}
          </span>
          <span className={`badge ${sb.cls}`}>
            {sb.label === "Live" && (
              <span
                style={{
                  width: 5,
                  height: 5,
                  borderRadius: "50%",
                  background: "var(--green)",
                  display: "inline-block",
                }}
              />
            )}
            {sb.label}
          </span>
        </div>

        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            lineHeight: 1.3,
            marginBottom: 20,
            letterSpacing: "-0.02em",
          }}
        >
          {market.question}
        </h1>

        {/* Yes/No bar */}
        {total > 0 ? (
          <div
            style={{
              display: "flex",
              height: 34,
              borderRadius: 6,
              overflow: "hidden",
              gap: 2,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                flex: yesPct,
                background: "var(--green-dim)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 44,
                borderRadius: "6px 0 0 6px",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--green-text)",
                }}
              >
                Yes {yesPct}%
              </span>
            </div>
            <div
              style={{
                flex: 100 - yesPct,
                background: "var(--red-dim)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: 44,
                borderRadius: "0 6px 6px 0",
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: "var(--red-text)",
                }}
              >
                No {100 - yesPct}%
              </span>
            </div>
          </div>
        ) : (
          <div
            style={{
              height: 34,
              borderRadius: 6,
              marginBottom: 14,
              background: "var(--surface-2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span style={{ fontSize: 12, color: "var(--text-3)" }}>
              No bets yet
            </span>
          </div>
        )}

        {/* Pools (settled) */}
        {isSettled && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <div
              style={{
                padding: 12,
                background: "var(--green-dim)",
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: "var(--green-text)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 4,
                }}
              >
                Yes Pool
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--green-text)",
                  fontFamily: "'JetBrains Mono'",
                }}
              >
                {formatTokenAmount(market.decryptedYesPool)}
              </div>
            </div>
            <div
              style={{
                padding: 12,
                background: "var(--red-dim)",
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: "var(--red-text)",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: 4,
                }}
              >
                No Pool
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: "var(--red-text)",
                  fontFamily: "'JetBrains Mono'",
                }}
              >
                {formatTokenAmount(market.decryptedNoPool)}
              </div>
            </div>
          </div>
        )}

        {/* Winner */}
        {isSettled && (
          <div
            style={{
              padding: "8px 12px",
              background: "var(--surface-2)",
              borderRadius: 6,
              marginBottom: 16,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ fontSize: 14 }}>✓</span>
            <span
              style={{ fontSize: 13, fontWeight: 600, color: "var(--text-2)" }}
            >
              {getOutcomeLabel(market.winningOutcome)} won ·{" "}
              {formatTokenAmount(
                market.decryptedYesPool + market.decryptedNoPool,
              )}{" "}
              AUCT total
            </span>
          </div>
        )}

        {/* Stats */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 8,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
          }}
        >
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                fontFamily: "'JetBrains Mono'",
              }}
            >
              {market.totalBets.toString()}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--text-3)",
                marginTop: 2,
                textTransform: "uppercase",
              }}
            >
              Bets
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
                lineHeight: 1.4,
              }}
            >
              {new Date(Number(market.startTime) * 1000).toLocaleTimeString(
                [],
                { hour: "2-digit", minute: "2-digit" },
              )}
              {" → "}
              {new Date(Number(market.endTime) * 1000).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--text-3)",
                marginTop: 2,
                textTransform: "uppercase",
              }}
            >
              Betting Window
            </div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--text-2)"
                strokeWidth="2"
                style={{ verticalAlign: "-1px", marginRight: 3 }}
              >
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
              FHE
            </div>
            <div
              style={{
                fontSize: 10,
                color: "var(--text-3)",
                marginTop: 2,
                textTransform: "uppercase",
              }}
            >
              Privacy
            </div>
          </div>
        </div>
      </div>

      {/* User status */}
      {userHasBet && (
        <div
          className="card"
          style={{
            padding: "12px 16px",
            marginBottom: 12,
            borderColor: isWinner
              ? "rgba(34,197,94,0.2)"
              : isLoser
                ? "rgba(239,68,68,0.2)"
                : "var(--border)",
            background: isWinner
              ? "var(--green-dim)"
              : isLoser
                ? "var(--red-dim)"
                : "var(--surface)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>{isWinner ? "🎉" : isLoser ? "✗" : "🔒"}</span>
            <div>
              <span style={{ fontSize: 13, fontWeight: 600 }}>
                {isWinner
                  ? "You won!"
                  : isLoser
                    ? "You lost"
                    : `You bet ${getOutcomeLabel(userOutcome!)}`}
              </span>
              <span
                style={{ fontSize: 11, color: "var(--text-3)", marginLeft: 8 }}
              >
                {userHasClaimed
                  ? "Claimed"
                  : canClaimWin
                    ? "Claim below"
                    : canClaimRefund
                      ? "Refund below"
                      : "Sealed"}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* No bets message */}
      {noBets && (
        <div
          className="card"
          style={{
            padding: "16px 20px",
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--text-3)" }}>
            No bets were placed on this market
          </span>
        </div>
      )}

      <MarketChat
        marketId={marketId}
        userHasBet={userHasBet}
        isSettled={isSettled}
      />
      {/* Not started yet */}
      {!hasStarted && market.status === MarketStatus.Active && (
        <div
          className="card"
          style={{
            padding: "14px 20px",
            marginBottom: 12,
            textAlign: "center",
          }}
        >
          <span style={{ fontSize: 13, color: "var(--text-2)" }}>
            Betting opens in ~
            {Math.max(0, Math.ceil(Number(market.startTime - now) / 60))} min
          </span>
        </div>
      )}
      {/* Bet button */}
      {canBet && (
        <button
          onClick={() => setShowBet(true)}
          className="btn btn-white"
          style={{
            width: "100%",
            padding: "13px",
            fontSize: 15,
            marginBottom: 12,
          }}
        >
          Place Encrypted Bet
        </button>
      )}

      {/* Resolve */}
      {canResolve && (
        <div className="card" style={{ padding: 20, marginBottom: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
            Resolve
          </div>
          <p style={{ fontSize: 12, color: "var(--text-3)", marginBottom: 14 }}>
            Select winner. Pools decrypt automatically.
          </p>
          {resolveStep && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "8px 12px",
                background: "var(--surface-2)",
                borderRadius: 6,
                marginBottom: 12,
                fontSize: 12,
                color: "var(--text-2)",
              }}
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                className="spin"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              {resolveStep}
            </div>
          )}
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}
          >
            <button
              onClick={() => handleResolve(Outcome.Yes)}
              disabled={busy}
              className="btn btn-green"
              style={{ padding: "10px" }}
            >
              Yes Wins
            </button>
            <button
              onClick={() => handleResolve(Outcome.No)}
              disabled={busy}
              className="btn btn-red"
              style={{ padding: "10px" }}
            >
              No Wins
            </button>
          </div>
        </div>
      )}

      {/* Finalize fallback */}
      {canFinalize && !resolving && (
        <button
          onClick={handleFinalize}
          disabled={busy}
          className="btn btn-white"
          style={{ width: "100%", padding: "12px", marginBottom: 12 }}
        >
          Decrypt & Finalize
        </button>
      )}

      {/* Claim */}
      {canClaimWin && (
        <button
          onClick={handleClaim}
          disabled={busy}
          className="btn btn-green"
          style={{
            width: "100%",
            padding: "13px",
            fontSize: 15,
            marginBottom: 12,
          }}
        >
          Claim Winnings
        </button>
      )}
      {canClaimRefund && (
        <button
          onClick={handleRefund}
          disabled={busy}
          className="btn"
          style={{ width: "100%", padding: "12px", marginBottom: 12 }}
        >
          Claim Refund
        </button>
      )}

      {/* Cancel */}
      {isCreator &&
        market.status === MarketStatus.Active &&
        market.totalBets === BigInt(0) && (
          <button
            onClick={async () => {
              const ok = await cancelMarket(marketId);
              if (ok) onBack();
            }}
            disabled={busy}
            style={{
              background: "none",
              border: "none",
              color: "var(--red-text)",
              fontSize: 12,
              cursor: "pointer",
              padding: "8px 0",
            }}
          >
            Cancel Market
          </button>
        )}

      {/* Bet modal */}
      {showBet && (
        <BetModal
          market={market}
          onClose={() => setShowBet(false)}
          onSuccess={() => {
            load();
            setSuccessModal({
              title: "Bet Placed",
              message:
                "Your bet has been encrypted and sealed on-chain. No one can see your position.",
            });
          }}
        />
      )}

      {/* Success modal */}
      {successModal && (
        <SuccessModal
          title={successModal.title}
          message={successModal.message}
          onClose={() => setSuccessModal(null)}
        />
      )}
    </div>
  );
};
