"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import {
  ShieldCheck,
  CheckCircle,
  XCircle,
  Hash,
  Scale,
  Binary,
  Code2,
} from "lucide-react";

function VerifierContent() {
  const searchParams = useSearchParams();
  const { apiUrl } = useAuth();

  const [serverSeed, setServerSeed] = useState("");
  const [serverSeedHash, setServerSeedHash] = useState("");
  const [clientSeed, setClientSeed] = useState("");
  const [nonce, setNonce] = useState<number>(1);

  const [verificationResult, setVerificationResult] = useState<{
    isValidCommitment: boolean;
    recomputedHash: string;
    roll: number;
  } | null>(null);

  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-populate from URL query params if present
  useEffect(() => {
    const sSeed = searchParams.get("serverSeed");
    const sHash = searchParams.get("serverSeedHash");
    const cSeed = searchParams.get("clientSeed");
    const n = searchParams.get("nonce");

    if (sSeed) setServerSeed(sSeed);
    if (sHash) setServerSeedHash(sHash);
    if (cSeed) setClientSeed(cSeed);
    if (n) setNonce(parseInt(n, 10) || 1);
  }, [searchParams]);

  const handleVerify = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!serverSeed || !serverSeedHash || !clientSeed) return;

    setError(null);
    setIsVerifying(true);

    try {
      const res = await fetch(`${apiUrl}/api/games/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serverSeed: serverSeed.trim(),
          serverSeedHash: serverSeedHash.trim(),
          clientSeed: clientSeed.trim(),
          nonce: Number(nonce),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Verification failed");
      } else {
        setVerificationResult(data);
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-green-500/10 border border-green-500/20 text-green-400 text-xs font-semibold mb-3">
          <ShieldCheck className="w-3.5 h-3.5" />
          Zero-Trust Auditing Protocol
        </div>
        <h1 className="text-3xl font-extrabold text-white">Cryptographic Fairness Verifier</h1>
        <p className="text-xs text-slate-400 mt-2 max-w-xl mx-auto">
          Audit server seed commitments and independently recompute rolls. The platform uses SHA-256 for commitment locking and HMAC-SHA256 for deterministic outcome generation.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Input Form */}
      <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl mb-8">
        <form onSubmit={handleVerify} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Revealed Server Seed (32 Bytes Hex)
            </label>
            <input
              type="text"
              required
              value={serverSeed}
              onChange={(e) => setServerSeed(e.target.value)}
              placeholder="e.g. 4a8f9c2d..."
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-green-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
              Published Server Seed Hash (SHA-256 Commitment)
            </label>
            <input
              type="text"
              required
              value={serverSeedHash}
              onChange={(e) => setServerSeedHash(e.target.value)}
              placeholder="e.g. 7f9a1b3c..."
              className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-green-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Client Seed
              </label>
              <input
                type="text"
                required
                value={clientSeed}
                onChange={(e) => setClientSeed(e.target.value)}
                placeholder="Client Seed"
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-green-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Nonce
              </label>
              <input
                type="number"
                min="1"
                required
                value={nonce}
                onChange={(e) => setNonce(parseInt(e.target.value, 10) || 1)}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-green-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full py-3 px-4 rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white font-bold text-sm transition mt-2 shadow-lg shadow-green-600/20"
          >
            {isVerifying ? "Verifying..." : "Verify Cryptographic Commitment & Outcome"}
          </button>
        </form>
      </div>

      {/* Verification Result Card */}
      {verificationResult && (
        <div className="p-8 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-2xl space-y-6">
          <div className="flex items-center gap-3">
            {verificationResult.isValidCommitment ? (
              <div className="p-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400">
                <CheckCircle className="w-6 h-6" />
              </div>
            ) : (
              <div className="p-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400">
                <XCircle className="w-6 h-6" />
              </div>
            )}
            <div>
              <h2 className="text-xl font-bold text-white">
                {verificationResult.isValidCommitment
                  ? "Commitment Verified: 100% Honest & Untampered"
                  : "Commitment Verification FAILED!"}
              </h2>
              <p className="text-xs text-slate-400">
                {verificationResult.isValidCommitment
                  ? "The revealed server seed exactly matches the SHA-256 hash published before the round started."
                  : "The revealed server seed hash does not match the commitment!"}
              </p>
            </div>
          </div>

          {/* Mathematical Proof Walkthrough */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-slate-800">
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                <Hash className="w-3.5 h-3.5 text-blue-400" />
                Step 1: Hash Comparison
              </span>
              <div className="text-xs font-mono text-slate-300 break-all space-y-1">
                <div>Published: {serverSeedHash}</div>
                <div>Computed:  {verificationResult.recomputedHash}</div>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-1">
                <Scale className="w-3.5 h-3.5 text-amber-400" />
                Step 2: Deterministic Roll
              </span>
              <div className="text-3xl font-black text-amber-400 font-mono">
                {verificationResult.roll.toFixed(2)}
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Formula: <code className="text-slate-300">floor((first4BytesInt / 2^32) * 10000) / 100</code>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function VerifyPage() {
  return (
    <Suspense fallback={<div className="text-center py-20 text-slate-400">Loading verifier...</div>}>
      <VerifierContent />
    </Suspense>
  );
}

