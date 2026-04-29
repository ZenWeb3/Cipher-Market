"use client";

import { useEffect, useMemo, useState } from "react";
import { Encryptable, FheTypes } from "@cofhe/sdk";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import { cofheClient } from "@/services/cofhe-client";
import { useCofheStore } from "@/services/store/cofheStore";

export function useCofhe() {
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { isConnected } = useAccount();
  const {
    isInitialized: globalIsInitialized,
    setIsInitialized: setGlobalIsInitialized,
  } = useCofheStore();

  const chainId = publicClient?.chain?.id;
  const accountAddress = walletClient?.account?.address;

  const [isInitializing, setIsInitializing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const isBrowser = typeof window !== "undefined";

  // Reset initialization when chain or account changes
  useEffect(() => {
    setGlobalIsInitialized(false);
  }, [chainId, accountAddress, setGlobalIsInitialized]);

  // Initialize cofheClient when wallet is connected
  useEffect(() => {
    if (!isBrowser || !isConnected) return;

    const initialize = async () => {
      if (
        globalIsInitialized ||
        isInitializing ||
        !publicClient ||
        !walletClient
      ) {
        return;
      }
      try {
        setIsInitializing(true);
        // The new @cofhe/sdk replaces `cofhejs.initializeWithViem` with a 3-step
        // config → client → connect flow. Config + client are module-level
        // (see services/cofhe-client.ts); here we only call connect.
        // Cast around viem type-identity drift: @cofhe/sdk re-exports viem
        // types from its own resolved viem instance, which on Vercel ends up
        // physically distinct from the workspace's viem (different zod peer →
        // separate .pnpm entry), so structurally-identical `Chain` types are
        // not assignment-compatible.
        await cofheClient.connect(publicClient as never, walletClient as never);
        console.log("CoFHE client connected successfully");
        setGlobalIsInitialized(true);
        setError(null);
      } catch (err) {
        console.error("Failed to connect CoFHE client:", err);
        setError(
          err instanceof Error
            ? err
            : new Error("Unknown error connecting CoFHE client")
        );
      } finally {
        setIsInitializing(false);
      }
    };

    initialize();
  }, [
    isBrowser,
    isConnected,
    walletClient,
    publicClient,
    chainId,
    isInitializing,
    accountAddress,
    globalIsInitialized,
    setGlobalIsInitialized,
  ]);

  return {
    isInitialized: globalIsInitialized,
    isInitializing,
    error,
    cofheClient,
    FheTypes,
    Encryptable,
  };
}

// ---------------------------------------------------------------------------
// Simpler reactive hooks that replace the old `useSyncExternalStore` versions
// which subscribed directly to `cofhejs.store` / `permitStore.store`.
// The new SDK doesn't expose subscribable stores, so we rely on wagmi + our
// Zustand `permitVersion` counter for reactivity.
// ---------------------------------------------------------------------------

export const useCofhejsInitialized = () =>
  useCofheStore((s) => s.isInitialized);

export const useCofhejsAccount = () => {
  const { address } = useAccount();
  return address ?? null;
};

export const useCofhejsActivePermit = () => {
  const { address, chainId } = useAccount();
  const initialized = useCofhejsInitialized();
  const permitVersion = useCofheStore((s) => s.permitVersion);

  return useMemo(() => {
    if (!address || !chainId || !initialized) return undefined;
    try {
      return cofheClient.permits.getActivePermit(chainId, address);
    } catch {
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, chainId, initialized, permitVersion]);
};

export const useCofhejsActivePermitHash = () => {
  const activePermit = useCofhejsActivePermit();
  return activePermit?.hash;
};

export const useCofhejsAllPermits = () => {
  const { address, chainId } = useAccount();
  const initialized = useCofhejsInitialized();
  const permitVersion = useCofheStore((s) => s.permitVersion);

  return useMemo(() => {
    if (!address || !chainId || !initialized) return undefined;
    try {
      const permits = cofheClient.permits.getPermits(chainId, address);
      return Object.values(permits ?? {});
    } catch {
      return undefined;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, chainId, initialized, permitVersion]);
};

// Re-export for convenience so consumers can import from "@/hooks/useCofhe"
export { FheTypes, Encryptable } from "@cofhe/sdk";
