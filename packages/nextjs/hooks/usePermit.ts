"use client";

import { useCallback, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { cofheClient } from "@/services/cofhe-client";
import { useCofheStore } from "@/services/store/cofheStore";

/**
 * usePermit — manages the currently active self-signed permit for decrypting
 * encrypted values in the UI. Reactivity is driven by `permitVersion` from the
 * Zustand store (bumped on every create/remove) since the new @cofhe/sdk does
 * not expose a subscribable permit store.
 */
export function usePermit() {
  const { address, chainId } = useAccount();
  const { isInitialized: isCofheInitialized } = useCofheStore();
  const permitVersion = useCofheStore((s) => s.permitVersion);
  const bumpPermitVersion = useCofheStore((s) => s.bumpPermitVersion);

  const [isGeneratingPermit, setIsGeneratingPermit] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasValidPermit = useMemo(() => {
    if (!isCofheInitialized || !address || !chainId) return false;
    try {
      const active = cofheClient.permits.getActivePermit(chainId, address);
      return !!active;
    } catch {
      return false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isCofheInitialized, address, chainId, permitVersion]);

  const checkPermit = useCallback(() => {
    if (!isCofheInitialized || !address || !chainId) return false;
    try {
      return !!cofheClient.permits.getActivePermit(chainId, address);
    } catch {
      return false;
    }
  }, [isCofheInitialized, address, chainId]);

  const generatePermit = useCallback(async () => {
    if (!isCofheInitialized || !address || !chainId || isGeneratingPermit) {
      return { success: false as const, error: "Not ready to generate permit" };
    }

    try {
      setIsGeneratingPermit(true);
      setError(null);

      const permitName = "Sealed Bid Auction";
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 30);

      await cofheClient.permits.getOrCreateSelfPermit(chainId, address, {
        issuer: address,
        name: permitName,
        expiration: Math.round(expirationDate.getTime() / 1000),
      });

      bumpPermitVersion();
      console.log("Permit created successfully");
      return { success: true as const };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error generating permit";
      setError(errorMessage);
      return { success: false as const, error: errorMessage };
    } finally {
      setIsGeneratingPermit(false);
    }
  }, [
    isCofheInitialized,
    address,
    chainId,
    isGeneratingPermit,
    bumpPermitVersion,
  ]);

  const removePermit = useCallback(async () => {
    if (!isCofheInitialized || !chainId || !address) {
      return false;
    }

    try {
      const active = cofheClient.permits.getActivePermit(chainId, address);
      if (!active) {
        return false;
      }
      cofheClient.permits.removePermit(active.hash, chainId, address);
      bumpPermitVersion();
      setError(null);
      return true;
    } catch (err) {
      console.error("Error removing permit:", err);
      setError("Failed to remove permit");
      return false;
    }
  }, [isCofheInitialized, chainId, address, bumpPermitVersion]);

  return {
    hasValidPermit,
    isGeneratingPermit,
    error,
    generatePermit,
    checkPermit,
    removePermit,
  };
}
