"use client";

import { useState, useEffect } from "react";
import { Clock, Users, Lock, TrendingUp, Trophy } from "lucide-react";
import {
  MarketData,
  MarketStatus,
  Outcome,
  getEffectiveStatus,
  getEffectiveStatusColor,
  getEffectiveStatusLabel,
  formatTokenAmount,
  getOutcomeLabel,
} from "@/utils/marketContracts";

interface MarketCardProps {
  market: MarketData;
  onClick?: () => void;
}

function getTimeDisplay(market: MarketData): { label: string; value: string } {
  const now = BigInt(Math.floor(Date.now() / 1000));

  if (now < market.startTime) {
    const seconds = Number(market.startTime - now);
    return { label: "Starts in", value: formatDuration(seconds) };
  }

  const effectiveStatus = getEffectiveStatus(market);
  if (now < market.endTime && effectiveStatus === MarketStatus.Active) {
    const seconds = Number(market.endTime - now);
    return { label: "Ends in", value: formatDuration(seconds) };
  }

  return { label: "Ended", value: formatTimeSince(Number(now - market.endTime)) };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return hours > 0 ? `${hours}h ${minutes % 60}m` : `${minutes}m`;
  const days = Math.floor(hours / 24);
  return days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`;
}

function formatTimeSince(seconds: number): string {
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const MarketCard = ({ market, onClick }: MarketCardProps) => {
  const [, setTick] = useState(0);

  useEffect(() => {
    const effectiveStatus = getEffectiveStatus(market);
    if (effectiveStatus === MarketStatus.Active || Date.now() / 1000 < Number(market.startTime)) {
      const interval = setInterval(() => setTick((t) => t + 1), 1000);
      return () => clearInterval(interval);
    }
  }, [market]);

  const timeDisplay = getTimeDisplay(market);
  const isSettled = market.status === MarketStatus.Settled;
  const isClickable = !!onClick;

  return (
    <div
      onClick={onClick}
      onKeyDown={isClickable ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick?.(); } } : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      className={`bg-base-200 border border-base-300 p-5 transition-all duration-200 ${
        isClickable
          ? "cursor-pointer hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
          : ""
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <span className={`badge ${getEffectiveStatusColor(market)} badge-sm font-display uppercase tracking-wide`}>
          {getEffectiveStatusLabel(market)}
        </span>
        <div className="flex items-center gap-1.5 text-base-content/50">
          <Clock className="w-3.5 h-3.5" />
          <span className="text-xs font-mono">{timeDisplay.value}</span>
        </div>
      </div>

      {/* Question */}
      <h3 className="text-lg font-display font-bold text-base-content leading-tight mb-4">
        {market.question}
      </h3>

      {/* Pool Display */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-success/10 border border-success/20 rounded-sm p-3 text-center">
          <div className="text-[10px] font-pixel text-success uppercase tracking-widest mb-1">Yes</div>
          {isSettled ? (
            <div className="text-sm font-mono font-bold text-success">
              {formatTokenAmount(market.decryptedYesPool)} AUCT
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 text-success/70">
              <Lock className="w-3 h-3" />
              <span className="text-xs font-mono">encrypted</span>
            </div>
          )}
        </div>
        <div className="bg-error/10 border border-error/20 rounded-sm p-3 text-center">
          <div className="text-[10px] font-pixel text-error uppercase tracking-widest mb-1">No</div>
          {isSettled ? (
            <div className="text-sm font-mono font-bold text-error">
              {formatTokenAmount(market.decryptedNoPool)} AUCT
            </div>
          ) : (
            <div className="flex items-center justify-center gap-1.5 text-error/70">
              <Lock className="w-3 h-3" />
              <span className="text-xs font-mono">encrypted</span>
            </div>
          )}
        </div>
      </div>

      {/* Winner badge for settled markets */}
      {isSettled && (
        <div className="flex items-center gap-2 mb-3 px-3 py-2 bg-primary/10 border border-primary/20 rounded-sm">
          <Trophy className="w-4 h-4 text-primary" />
          <span className="text-xs font-display uppercase tracking-wider text-primary font-bold">
            Winner: {getOutcomeLabel(market.winningOutcome)}
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between pt-3 border-t border-base-300">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <span className="text-sm font-mono text-base-content">
            {market.totalBets.toString()}
          </span>
          <span className="text-xs text-base-content/50">
            {market.totalBets === BigInt(1) ? "bet" : "bets"}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs text-base-content/50">
          <span className="text-success">{market.yesBettors.toString()} yes</span>
          <span className="text-error">{market.noBettors.toString()} no</span>
        </div>
      </div>
    </div>
  );
};