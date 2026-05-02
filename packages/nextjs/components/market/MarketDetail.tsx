"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useCofhe } from "@/hooks/useCofhe";
import { useAccount } from "wagmi";
import {
  ArrowLeft, Clock, Users, Lock, Trophy, Loader2,
  CheckCircle, XCircle, Shield, TrendingUp, RefreshCw
} from "lucide-react";
import { useMarket } from "@/hooks/useMarket";
import {
  MarketData, MarketStatus, Outcome,
  getEffectiveStatus, getEffectiveStatusColor, getEffectiveStatusLabel,
  formatTokenAmount, getOutcomeLabel,
} from "@/utils/marketContracts";

interface MarketDetailProps {
  marketId: bigint;
  onBack: () => void;
}

export const MarketDetail = ({ marketId, onBack }: MarketDetailProps) => {
  const { address } = useAccount();
  const { isInitialized: isCofheReady } = useCofhe();
  const {
    getMarket, hasBetOnMarket, getBettorOutcome, hasClaimedFromMarket,
    placeBet, resolveMarket, finalizeSettlement, claimWinnings, claimRefund,
    cancelMarket, isLoading,
  } = useMarket();

  const [market, setMarket] = useState<MarketData | null>(null);
  const [userHasBet, setUserHasBet] = useState(false);
  const [userOutcome, setUserOutcome] = useState<Outcome | null>(null);
  const [userHasClaimed, setUserHasClaimed] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [betAmount, setBetAmount] = useState("");
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveStep, setResolveStep] = useState("");

  // Auto-refresh polling
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const loadData = useCallback(async () => {
    const m = await getMarket(marketId);
    setMarket(m);

    if (address && m) {
      const [hasBet, outcome, claimed] = await Promise.all([
        hasBetOnMarket(marketId, address),
        getBettorOutcome(marketId, address),
        hasClaimedFromMarket(marketId, address),
      ]);
      setUserHasBet(hasBet);
      setUserOutcome(hasBet ? outcome : null);
      setUserHasClaimed(claimed);
    }
    setIsLoadingData(false);
  }, [marketId, address, getMarket, hasBetOnMarket, getBettorOutcome, hasClaimedFromMarket]);

  // Initial load
  useEffect(() => {
    setIsLoadingData(true);
    loadData();
  }, [loadData]);

  // Poll every 10 seconds for updates
  useEffect(() => {
    pollRef.current = setInterval(() => {
      loadData();
    }, 10000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadData]);

  if (isLoadingData || !market) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-base-content/70">Loading market...</p>
      </div>
    );
  }

  const effectiveStatus = getEffectiveStatus(market);
  const isCreator = address?.toLowerCase() === market.creator.toLowerCase();
  const now = BigInt(Math.floor(Date.now() / 1000));
  const hasStarted = now >= market.startTime;
  const hasEnded = now >= market.endTime;
  const isActive = market.status === MarketStatus.Active && hasStarted && !hasEnded;
  const canBet = isActive && !userHasBet && !!address;
  const canResolve = isCreator && market.status === MarketStatus.Active && hasEnded && market.totalBets > BigInt(0);
  const canFinalize = market.status === MarketStatus.Resolved;
  const isSettled = market.status === MarketStatus.Settled;
  const isWinner = isSettled && userHasBet && userOutcome === market.winningOutcome;
  const isLoser = isSettled && userHasBet && userOutcome !== market.winningOutcome;
  const canClaimWin = isWinner && !userHasClaimed;
  const canClaimRefund = isLoser && !userHasClaimed;
  const canCancel = isCreator && market.status === MarketStatus.Active;

  const handlePlaceBet = async () => {
    if (selectedOutcome === null || !betAmount) return;
    const amount = BigInt(Math.floor(parseFloat(betAmount) * 1_000_000));
    const result = await placeBet(marketId, selectedOutcome, amount);
    if (result) {
      setBetAmount("");
      setSelectedOutcome(null);
      await loadData();
    }
  };

  // Combined resolve + finalize flow — one click does everything
  const handleResolveAndFinalize = async (outcome: Outcome) => {
    setIsResolving(true);
    try {
      // Step 1: Resolve
      setResolveStep("Resolving market...");
      const resolved = await resolveMarket(marketId, outcome);
      if (!resolved) {
        setIsResolving(false);
        setResolveStep("");
        return;
      }

      // Step 2: Auto-finalize
      setResolveStep("Decrypting pool totals...");
      // Small delay to let the chain state settle
      await new Promise(r => setTimeout(r, 2000));

      const finalized = await finalizeSettlement(marketId);
      if (!finalized) {
        setResolveStep("Resolution complete. Please click 'Decrypt & Finalize' to finish.");
        await loadData();
        setIsResolving(false);
        return;
      }

      setResolveStep("");
      await loadData();
    } catch (error) {
      console.error("Resolve flow failed:", error);
      setResolveStep("");
      await loadData();
    } finally {
      setIsResolving(false);
    }
  };

  const handleFinalize = async () => {
    const result = await finalizeSettlement(marketId);
    if (result) await loadData();
  };

  const handleClaimWin = async () => {
    const result = await claimWinnings(marketId);
    if (result) await loadData();
  };

  const handleClaimRefund = async () => {
    const result = await claimRefund(marketId);
    if (result) await loadData();
  };

  const handleCancel = async () => {
    const result = await cancelMarket(marketId);
    if (result) onBack();
  };

  const isBusy = isLoading || isResolving;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Back button */}
      <div className="flex items-center justify-between">
        <button onClick={onBack} className="btn btn-ghost btn-sm gap-2 font-display uppercase tracking-wide">
          <ArrowLeft className="w-4 h-4" /> Back to markets
        </button>
        <button onClick={loadData} className="btn btn-ghost btn-sm" title="Refresh">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Market Header */}
      <div className="bg-base-200 border border-base-300 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 border border-primary/30">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <span className="text-xs font-mono text-base-content/50">Market #{market.id.toString()}</span>
          </div>
          <span className={`badge ${getEffectiveStatusColor(market)} badge-md font-display uppercase tracking-wide`}>
            {getEffectiveStatusLabel(market)}
          </span>
        </div>

        <h1 className="text-2xl md:text-3xl font-display font-bold text-base-content leading-tight mb-6">
          {market.question}
        </h1>

        {/* Pool Display */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-success/10 border border-success/20 rounded-sm p-4">
            <div className="text-[10px] font-pixel text-success uppercase tracking-widest mb-2">Yes Pool</div>
            {isSettled ? (
              <div className="text-xl font-mono font-bold text-success">
                {formatTokenAmount(market.decryptedYesPool)} <span className="text-sm">AUCT</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-success/70">
                <Lock className="w-4 h-4" />
                <span className="text-sm font-mono">Encrypted</span>
              </div>
            )}
            <div className="text-xs text-success/60 mt-1">{market.yesBettors.toString()} bettors</div>
          </div>
          <div className="bg-error/10 border border-error/20 rounded-sm p-4">
            <div className="text-[10px] font-pixel text-error uppercase tracking-widest mb-2">No Pool</div>
            {isSettled ? (
              <div className="text-xl font-mono font-bold text-error">
                {formatTokenAmount(market.decryptedNoPool)} <span className="text-sm">AUCT</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-error/70">
                <Lock className="w-4 h-4" />
                <span className="text-sm font-mono">Encrypted</span>
              </div>
            )}
            <div className="text-xs text-error/60 mt-1">{market.noBettors.toString()} bettors</div>
          </div>
        </div>

        {/* Winner Banner */}
        {isSettled && (
          <div className="flex items-center gap-3 p-4 bg-primary/10 border border-primary/20 rounded-sm mb-6">
            <Trophy className="w-6 h-6 text-primary" />
            <div>
              <span className="font-display text-primary font-bold uppercase tracking-wide">
                Winner: {getOutcomeLabel(market.winningOutcome)}
              </span>
              <p className="text-xs text-base-content/50 mt-0.5">
                Total pool: {formatTokenAmount(market.decryptedYesPool + market.decryptedNoPool)} AUCT
              </p>
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center p-3 bg-base-300/50 rounded-sm">
            <Users className="w-4 h-4 mx-auto text-primary mb-1" />
            <div className="text-lg font-mono font-bold">{market.totalBets.toString()}</div>
            <div className="text-[10px] font-pixel text-base-content/50 uppercase">Total bets</div>
          </div>
          <div className="text-center p-3 bg-base-300/50 rounded-sm">
            <Clock className="w-4 h-4 mx-auto text-primary mb-1" />
            <div className="text-sm font-mono font-bold">
              {new Date(Number(market.endTime) * 1000).toLocaleDateString()}
            </div>
            <div className="text-[10px] font-pixel text-base-content/50 uppercase">End date</div>
          </div>
          <div className="text-center p-3 bg-base-300/50 rounded-sm">
            <Shield className="w-4 h-4 mx-auto text-primary mb-1" />
            <div className="text-sm font-mono font-bold">FHE</div>
            <div className="text-[10px] font-pixel text-base-content/50 uppercase">Privacy</div>
          </div>
        </div>
      </div>

      {/* User Status */}
      {userHasBet && (
        <div className={`border p-4 rounded-sm flex items-center gap-3 ${
          isWinner ? "bg-success/10 border-success/20" :
          isLoser ? "bg-error/10 border-error/20" :
          "bg-info/10 border-info/20"
        }`}>
          {isWinner ? <CheckCircle className="w-5 h-5 text-success" /> :
           isLoser ? <XCircle className="w-5 h-5 text-error" /> :
           <Lock className="w-5 h-5 text-info" />}
          <div>
            <p className="font-display uppercase tracking-wide text-sm font-bold">
              {isWinner ? "You won!" : isLoser ? "You lost" : `You bet ${getOutcomeLabel(userOutcome!)}`}
            </p>
            <p className="text-xs text-base-content/50">
              {userHasClaimed ? "Already claimed" :
               canClaimWin ? "Claim your winnings below" :
               canClaimRefund ? "Claim your refund below" :
               "Your bet is encrypted and sealed"}
            </p>
          </div>
        </div>
      )}

      {/* Place Bet */}
      {canBet && (
        <div className="bg-base-200 border border-base-300 p-6">
          <h3 className="text-lg font-display font-bold text-base-content uppercase tracking-wide mb-4">
            Place Your Bet
          </h3>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <button
              onClick={() => setSelectedOutcome(Outcome.Yes)}
              disabled={isBusy}
              className={`p-4 rounded-sm border-2 transition-all font-display uppercase tracking-wide font-bold ${
                selectedOutcome === Outcome.Yes
                  ? "border-success bg-success/10 text-success shadow-lg shadow-success/10"
                  : "border-base-300 hover:border-success/50 text-base-content/70"
              }`}
            >
              <CheckCircle className={`w-6 h-6 mx-auto mb-2 ${selectedOutcome === Outcome.Yes ? "text-success" : "text-base-content/30"}`} />
              Yes
            </button>
            <button
              onClick={() => setSelectedOutcome(Outcome.No)}
              disabled={isBusy}
              className={`p-4 rounded-sm border-2 transition-all font-display uppercase tracking-wide font-bold ${
                selectedOutcome === Outcome.No
                  ? "border-error bg-error/10 text-error shadow-lg shadow-error/10"
                  : "border-base-300 hover:border-error/50 text-base-content/70"
              }`}
            >
              <XCircle className={`w-6 h-6 mx-auto mb-2 ${selectedOutcome === Outcome.No ? "text-error" : "text-base-content/30"}`} />
              No
            </button>
          </div>

          <div className="form-control mb-4">
            <label className="label">
              <span className="label-text font-pixel uppercase tracking-widest text-xs">Amount (AUCT)</span>
            </label>
            <input
              type="number"
              value={betAmount}
              onChange={(e) => setBetAmount(e.target.value)}
              placeholder="100"
              className="input input-bordered font-mono no-spinners"
              min="0"
              disabled={isBusy}
            />
          </div>

          <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/20 rounded-sm mb-4">
            <Lock className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p className="text-xs text-base-content/60">
              Your bet amount and choice are fully encrypted via FHE. No one — not even the market
              creator — can see your position until the market is settled.
            </p>
          </div>

          <button
            onClick={handlePlaceBet}
            disabled={selectedOutcome === null || !betAmount || isBusy}
            className={`btn w-full font-display uppercase tracking-wide ${
              selectedOutcome === Outcome.Yes ? "bg-success hover:bg-success/80 text-success-content" :
              selectedOutcome === Outcome.No ? "bg-error hover:bg-error/80 text-error-content" :
              "btn-fhenix"
            }`}
          >
            {isBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
            {selectedOutcome !== null ? `Place Encrypted ${getOutcomeLabel(selectedOutcome)} Bet` : "Select an outcome"}
          </button>
        </div>
      )}

      {/* Creator: Resolve + Auto-Finalize (one click) */}
      {canResolve && (
        <div className="bg-base-200 border border-base-300 p-6">
          <h3 className="text-lg font-display font-bold text-base-content uppercase tracking-wide mb-2">
            Resolve Market
          </h3>
          <p className="text-sm text-base-content/50 mb-4">
            Select the winning outcome. This will resolve the market and automatically decrypt the pool totals.
          </p>

          {resolveStep && (
            <div className="flex items-center gap-3 p-3 bg-info/10 border border-info/20 rounded-sm mb-4">
              <Loader2 className="w-4 h-4 text-info animate-spin shrink-0" />
              <p className="text-sm text-info font-mono">{resolveStep}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleResolveAndFinalize(Outcome.Yes)}
              disabled={isBusy}
              className="btn bg-success hover:bg-success/80 text-success-content font-display uppercase tracking-wide"
            >
              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Yes Wins
            </button>
            <button
              onClick={() => handleResolveAndFinalize(Outcome.No)}
              disabled={isBusy}
              className="btn bg-error hover:bg-error/80 text-error-content font-display uppercase tracking-wide"
            >
              {isBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              No Wins
            </button>
          </div>
        </div>
      )}

      {/* Finalize Settlement (fallback if auto-finalize failed) */}
      {canFinalize && !isResolving && (
        <div className="bg-base-200 border border-base-300 p-6">
          <h3 className="text-lg font-display font-bold text-base-content uppercase tracking-wide mb-2">
            Finalize Settlement
          </h3>
          <p className="text-sm text-base-content/50 mb-4">
            Decrypt pool totals and finalize the market results.
          </p>
          <button
            onClick={handleFinalize}
            disabled={isBusy}
            className="btn btn-fhenix w-full font-display uppercase tracking-wide"
          >
            {isBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
            Decrypt & Finalize
          </button>
        </div>
      )}

      {/* Claim Actions */}
      {(canClaimWin || canClaimRefund) && (
        <div className="bg-base-200 border border-base-300 p-6">
          {canClaimWin && (
            <button
              onClick={handleClaimWin}
              disabled={isBusy}
              className="btn bg-success hover:bg-success/80 text-success-content w-full font-display uppercase tracking-wide"
            >
              {isBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trophy className="w-5 h-5" />}
              Claim Winnings
            </button>
          )}
          {canClaimRefund && (
            <button
              onClick={handleClaimRefund}
              disabled={isBusy}
              className="btn btn-ghost border border-base-300 w-full font-display uppercase tracking-wide"
            >
              {isBusy ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Claim Refund
            </button>
          )}
        </div>
      )}

      {/* Cancel */}
      {canCancel && market.totalBets === BigInt(0) && (
        <button
          onClick={handleCancel}
          disabled={isBusy}
          className="btn btn-ghost btn-sm text-error font-display uppercase tracking-wide"
        >
          Cancel Market
        </button>
      )}
    </div>
  );
};