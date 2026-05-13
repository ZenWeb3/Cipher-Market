"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useAccount, usePublicClient } from "wagmi";
import { MarketCard } from "./MarketCard";
import { MarketDetail } from "./MarketDetail";
import { CreateMarketForm } from "./CreateMarketForm";
import { SuccessModal } from "../SuccessModal";
import { useMarket } from "@/hooks/useMarket";
import { useMarketStore } from "@/services/store/marketStore";
import {
  MarketData,
  MarketStatus,
  getEffectiveStatus,
} from "@/utils/marketContracts";

type Tab = "all" | "create" | "my-bets";

const ONE_HOUR = BigInt(3600);

function categorizeMarkets(markets: MarketData[]) {
  const now = BigInt(Math.floor(Date.now() / 1000));

  const allActive = markets.filter(
    (m) => getEffectiveStatus(m) === MarketStatus.Active,
  );

const endingSoon = allActive
    .filter((m) => m.startTime <= now && m.endTime > now && m.endTime - now <= ONE_HOUR)
    .sort((a, b) => Number(a.endTime - b.endTime));

  const endingSoonIds = new Set(endingSoon.map((m) => m.id.toString()));

  const active = allActive.filter((m) => !endingSoonIds.has(m.id.toString()));

  const closed = markets.filter((m) => {
    const s = getEffectiveStatus(m);
    return s === MarketStatus.Closed || s === MarketStatus.Resolved;
  });

  const settled = markets.filter(
    (m) => getEffectiveStatus(m) === MarketStatus.Settled,
  );

  return { endingSoon, active, closed, settled };
}

export const MarketsPage = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { getAllMarkets, getTotalMarkets, hasBetOnMarket } = useMarket();
  const { selectedMarketId, setSelectedMarketId, refreshTrigger } =
    useMarketStore();

  const [tab, setTab] = useState<Tab>("all");
  const [markets, setMarkets] = useState<MarketData[]>([]);
  const [myBets, setMyBets] = useState<MarketData[]>([]);
  const [successModal, setSuccessModal] = useState<{
    title: string;
    message: string;
    action?: { label: string; onClick: () => void };
  } | null>(null);

  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const loadingRef = useRef(false);

  const load = useCallback(async () => {
    if (!publicClient || loadingRef.current) return;

    loadingRef.current = true;

    try {
      const total = await getTotalMarkets();
      const all = await getAllMarkets(BigInt(0), Number(total));
      all.sort((a, b) => Number(b.id - a.id));
      setMarkets(all);

      if (address) {
        const checks = await Promise.all(
          all.map(async (m) => ({
            m,
            bet: await hasBetOnMarket(m.id, address),
          })),
        );
        setMyBets(checks.filter((c) => c.bet).map((c) => c.m));
      } else {
        setMyBets([]);
      }
    } catch (e) {
      console.error(e);
    } finally {
      loadingRef.current = false;
    }
  }, [publicClient, address, getAllMarkets, getTotalMarkets, hasBetOnMarket]);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

  useEffect(() => {
    pollRef.current = setInterval(load, 12000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [load]);

  const { endingSoon, active, closed, settled } = useMemo(
    () => categorizeMarkets(markets),
    [markets],
  );

  if (selectedMarketId !== null) {
    return (
      <MarketDetail
        marketId={selectedMarketId}
        onBack={() => setSelectedMarketId(null)}
        onActionSuccess={(title, message) =>
          setSuccessModal({ title, message })
        }
      />
    );
  }

  const grid = (items: MarketData[]) => (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))",
        gap: 10,
      }}
    >
      {items.map((m) => (
        <MarketCard
          key={m.id.toString()}
          market={m}
          onClick={() => setSelectedMarketId(m.id)}
        />
      ))}
    </div>
  );

  const Section = ({
    label,
    count,
    items,
  }: {
    label: string;
    count: number;
    items: MarketData[];
  }) => {
    if (items.length === 0) return null;
    return (
      <div style={{ marginBottom: 28 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--text-2)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
            }}
          >
            {label}
          </span>
          <span
            style={{
              fontSize: 11,
              color: "var(--text-3)",
              fontFamily: "var(--font-mono), 'JetBrains Mono', monospace",
            }}
          >
            {count}
          </span>
        </div>
        {grid(items)}
      </div>
    );
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            marginBottom: 4,
          }}
        >
          Markets
        </h1>
        <p style={{ fontSize: 14, color: "var(--text-3)" }}>
          Private prediction markets powered by FHE
        </p>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          marginBottom: 24,
          borderBottom: "1px solid var(--border)",
        }}
      >
        {[
          { id: "all" as Tab, label: "All Markets" },
          { id: "create" as Tab, label: "Create" },
          {
            id: "my-bets" as Tab,
            label: `My Bets${myBets.length ? ` · ${myBets.length}` : ""}`,
          },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`tab ${tab === t.id ? "tab-active" : ""}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* All Markets */}
      {tab === "all" && (
        <div>
          {!publicClient && (
            <div
              style={{
                padding: "48px 0",
                textAlign: "center",
                color: "var(--text-3)",
                fontSize: 13,
              }}
            >
              Connect wallet to browse
            </div>
          )}

          {publicClient && markets.length === 0 && (
            <div
              style={{
                padding: "48px 0",
                textAlign: "center",
                color: "var(--text-3)",
                fontSize: 13,
              }}
            >
              No markets yet
            </div>
          )}

          <Section
            label="Ending soon"
            count={endingSoon.length}
            items={endingSoon}
          />
          <Section label="Active" count={active.length} items={active} />
          <Section
            label="Awaiting resolution"
            count={closed.length}
            items={closed}
          />
          <Section label="Settled" count={settled.length} items={settled} />
        </div>
      )}

      {/* Create */}
      {tab === "create" && (
        <CreateMarketForm
          onSuccess={(marketId: bigint) => {
            load();
            setSuccessModal({
              title: "Market Created",
              message:
                "Your prediction market is live. Betting opens in ~1 minute.",
              action: {
                label: "Go to Market & Place Bet",
                onClick: () => {
                  setSuccessModal(null);
                  setTab("all");
                  setSelectedMarketId(marketId);
                },
              },
            });
          }}
        />
      )}

      {/* My Bets */}
      {tab === "my-bets" &&
        (!address ? (
          <div
            style={{
              padding: "48px 0",
              textAlign: "center",
              color: "var(--text-3)",
              fontSize: 13,
            }}
          >
            Connect wallet
          </div>
        ) : myBets.length === 0 ? (
          <div
            style={{
              padding: "48px 0",
              textAlign: "center",
              color: "var(--text-3)",
              fontSize: 13,
            }}
          >
            No bets yet
          </div>
        ) : (
          grid(myBets)
        ))}

      {/* Success Modal */}
      {successModal && (
        <SuccessModal
          title={successModal.title}
          message={successModal.message}
          action={successModal.action}
          onClose={() => setSuccessModal(null)}
        />
      )}
    </div>
  );
};
