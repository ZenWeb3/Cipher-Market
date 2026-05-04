"use client";

import { useState, useCallback } from "react";
import { useAccount, usePublicClient, useWalletClient } from "wagmi";
import toast from "react-hot-toast";
import { FheTypes } from "@cofhe/sdk";
import { betTokenAbi } from "@/utils/marketContracts";
import { toastTxSuccess } from "@/utils/explorerLink";
import { usePermit } from "@/hooks/usePermit";
import { cofheClient } from "@/services/cofhe-client";
import { useCofhe } from "@/hooks/useCofhe";
import { SuccessModal } from "../SuccessModal";

const TOKEN_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_CONTRACT_ADDRESS as `0x${string}`;
const MINT_AMOUNT = BigInt(1000 * 1_000_000);

export const MintPage = () => {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();
  const { isInitialized: isCofheReady } = useCofhe();
  const { hasValidPermit, generatePermit } = usePermit();

  const [balance, setBalance] = useState<string | null>(null);
  const [minting, setMinting] = useState(false);
  const [unsealing, setUnsealing] = useState(false);
  const [successModal, setSuccessModal] = useState<{ title: string; message: string } | null>(null);

  const handleMint = async () => {
    if (!walletClient || !address || !publicClient) return;
    setMinting(true);
    try {
      toast.loading("Minting...", { id: "mint" });
      const hash = await walletClient.writeContract({
        address: TOKEN_CONTRACT_ADDRESS, abi: betTokenAbi,
        functionName: "mint", args: [address, MINT_AMOUNT],
      });
      await publicClient.waitForTransactionReceipt({ hash });
      toast.dismiss("mint");
      setBalance(null);
      setSuccessModal({ title: "Tokens Minted", message: "1,000 AUCT tokens have been added to your encrypted balance." });
    } catch (e) {
      console.error(e);
      toast.error("Mint failed", { id: "mint" });
    } finally { setMinting(false); }
  };

  const handleUnseal = useCallback(async () => {
    if (!publicClient || !address || !isCofheReady) return;
    setUnsealing(true);
    try {
      if (!hasValidPermit) {
        toast.loading("Generating permit...", { id: "unseal" });
        const r = await generatePermit();
        if (!r.success) { toast.error("Permit failed", { id: "unseal" }); setUnsealing(false); return; }
        toast.dismiss("unseal");
      }
      toast.loading("Unsealing...", { id: "unseal" });
      const ct = await publicClient.readContract({
        address: TOKEN_CONTRACT_ADDRESS, abi: betTokenAbi,
        functionName: "confidentialBalanceOf", args: [address],
      });
      if (!ct || ct === "0x0000000000000000000000000000000000000000000000000000000000000000") {
        setBalance("0"); toast.dismiss("unseal"); setUnsealing(false); return;
      }
      const result = await cofheClient.decryptForView(ct as `0x${string}`, FheTypes.Uint64).execute();
      const val = typeof result === "bigint" ? result : (result as any).decryptedValue ?? result;
      setBalance((Number(val) / 1_000_000).toLocaleString());
      toast.dismiss("unseal");
    } catch (e) {
      console.error(e);
      toast.error("Unseal failed", { id: "unseal" });
    } finally { setUnsealing(false); }
  }, [publicClient, address, isCofheReady, hasValidPermit, generatePermit]);

  if (!address) {
    return (
      <div className="fade-in" style={{ maxWidth: 480, margin: "0 auto" }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>Faucet</h1>
        <p style={{ color: "var(--text-3)", fontSize: 13, marginTop: 8 }}>Connect wallet to mint test tokens</p>
      </div>
    );
  }

  return (
    <div className="fade-in" style={{ maxWidth: 480, margin: "0 auto" }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, letterSpacing: "-0.03em", marginBottom: 4 }}>Faucet</h1>
      <p style={{ color: "var(--text-3)", fontSize: 13, marginBottom: 28 }}>Get AUCT tokens to bet on markets</p>

      {/* Balance */}
      <div className="card" style={{ padding: 24, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-3)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Your Balance</div>
            {balance !== null ? (
              <div style={{ fontSize: 32, fontWeight: 700, fontFamily: "'JetBrains Mono'", color: "var(--text)" }}>
                {balance} <span style={{ fontSize: 14, color: "var(--text-3)" }}>AUCT</span>
              </div>
            ) : (
              <div style={{ fontSize: 32, fontWeight: 700, color: "var(--text-3)" }}>
                🔒 ••••••
              </div>
            )}
          </div>
          {hasValidPermit && (
            <span style={{ fontSize: 10, color: "var(--green-text)", display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)" }} />
              Permit
            </span>
          )}
        </div>

        <button onClick={handleUnseal} disabled={unsealing || !isCofheReady} className="btn"
          style={{ marginTop: 14, padding: "6px 14px", fontSize: 12 }}>
          {unsealing && <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>}
          {balance !== null ? "Refresh" : "Unseal"}
        </button>

        <p style={{ fontSize: 11, color: "var(--text-3)", marginTop: 10 }}>
          Balance is encrypted on-chain. Only you can unseal it.
        </p>
      </div>

      {/* Mint */}
      <button onClick={handleMint} disabled={minting} className="btn btn-white"
        style={{ width: "100%", padding: "13px", fontSize: 15, marginBottom: 12 }}>
        {minting && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="spin"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>}
        Mint 1,000 AUCT
      </button>

      {/* Info */}
      <div className="card" style={{ padding: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>How it works</div>
        <div style={{ fontSize: 12, color: "var(--text-3)", lineHeight: 1.7 }}>
          <p style={{ marginBottom: 6 }}><strong style={{ color: "var(--text-2)" }}>Encrypted</strong> — AUCT balances are stored as FHE ciphertext. Not even block explorers can read them.</p>
          <p style={{ marginBottom: 6 }}><strong style={{ color: "var(--text-2)" }}>Private</strong> — Bets transfer encrypted tokens without revealing amounts.</p>
          <p><strong style={{ color: "var(--text-2)" }}>Yours</strong> — Only your wallet can unseal your balance.</p>
        </div>
      </div>

      {successModal && <SuccessModal title={successModal.title} message={successModal.message} onClose={() => setSuccessModal(null)} />}
    </div>
  );
};