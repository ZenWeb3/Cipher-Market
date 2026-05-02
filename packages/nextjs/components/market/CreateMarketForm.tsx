"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { Plus, Loader2, Lock } from "lucide-react";
import { useMarket } from "@/hooks/useMarket";
import { useMarketStore } from "@/services/store/marketStore";

export const CreateMarketForm = () => {
  const { address } = useAccount();
  const { createMarket, isLoading } = useMarket();
  const { setMarketSubTab } = useMarketStore();

  const [question, setQuestion] = useState("");
  const [durationHours, setDurationHours] = useState("24");

  const isWalletConnected = !!address;

  const handleSubmit = async () => {
    if (!question.trim()) return;

    const hours = parseFloat(durationHours) || 24;
    const now = Math.floor(Date.now() / 1000);
    const startTime = BigInt(now + 60); // starts in 1 minute
    const endTime = BigInt(now + hours * 3600);

    const marketId = await createMarket(question.trim(), startTime, endTime);

    if (marketId !== null) {
      setQuestion("");
      setDurationHours("24");
      setMarketSubTab("browse");
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-base-200 border border-base-300 p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 border border-primary/30">
            <Plus className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-display font-bold text-base-content uppercase tracking-wide">
              Create Market
            </h2>
            <p className="text-sm text-base-content/50">
              Ask a yes/no question for the world to bet on
            </p>
          </div>
        </div>

        {!isWalletConnected && (
          <div className="alert alert-warning">
            <span className="font-display uppercase tracking-wide text-sm">
              Connect your wallet to create a market
            </span>
          </div>
        )}

        {/* Question */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-pixel uppercase tracking-widest text-xs">
              Question
            </span>
            <span className="label-text-alt text-xs text-base-content/50">
              {question.length}/200
            </span>
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value.slice(0, 200))}
            placeholder="Will ETH hit $5,000 by June 30?"
            className="textarea textarea-bordered font-sans text-base h-24 resize-none"
            disabled={!isWalletConnected || isLoading}
          />
        </div>

        {/* Duration */}
        <div className="form-control">
          <label className="label">
            <span className="label-text font-pixel uppercase tracking-widest text-xs">
              Duration (hours)
            </span>
          </label>
          <div className="grid grid-cols-4 gap-2">
           {[
              { value: "0.05", label: "3 min" },
              { value: "0.5", label: "30 min" },
              { value: "1", label: "1 hr" },
              { value: "24", label: "24 hr" },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDurationHours(opt.value)}
                className={`btn btn-sm font-mono ${
                  durationHours === opt.value ? "btn-primary" : "btn-ghost border border-base-300"
                }`}
                disabled={!isWalletConnected || isLoading}
              >
                {opt.label}
              </button>
            ))}
          </div>
         
        </div>

        {/* Privacy notice */}
        <div className="flex items-start gap-3 p-4 bg-primary/5 border border-primary/20 rounded-sm">
          <Lock className="w-5 h-5 text-primary mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-display text-base-content font-bold uppercase tracking-wide">
              FHE-Powered Privacy
            </p>
            <p className="text-xs text-base-content/60 mt-1">
              All bets are encrypted using Fully Homomorphic Encryption. Pool totals are computed
              on-chain without ever revealing individual positions. No one sees who bet what.
            </p>
          </div>
        </div>

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={!isWalletConnected || isLoading || !question.trim()}
          className="btn btn-fhenix w-full font-display uppercase tracking-wide text-sm"
        >
          {isLoading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Plus className="w-5 h-5" />
          )}
          Create Prediction Market
        </button>
      </div>
    </div>
  );
};