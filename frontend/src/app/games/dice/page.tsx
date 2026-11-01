"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../context/AuthContext";
import {
  Dice5,
  Shield,
  ShieldCheck,
  Coins,
  History,
  AlertCircle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";

interface PastRoll {
  roundId: string;
  roll: number;
  target: number;
  won: boolean;
  betAmount: number;
  payoutAmount: number;
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export default function DiceGamePage() {
  const { user, accessToken, apiUrl, isLoading } = useAuth();
  const router = useRouter();

  // Balance & Wallet
  const [balance, setBalance] = useState<number | null>(null);

  // Game Parameters
  const [betAmount, setBetAmount] = useState<number>(10);
  const [target, setTarget] = useState<number>(50.0);
  const [clientSeed, setClientSeed] = useState<string>("");

  // Provably Fair Commitment
  const [currentRoundId, setCurrentRoundId] = useState<string | null>(null);
  const [serverSeedHash, setServerSeedHash] = useState<string>("");
  const [currentNonce, setCurrentNonce] = useState<number>(1);

  // Gameplay State
  const [isRolling, setIsRolling] = useState(false);
  const [lastRoll, setLastRoll] = useState<PastRoll | null>(null);
  const [history, setHistory] = useState<PastRoll[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Computed Game Math
  // Multiplier = (100 - 1% house edge) / target = 99 / target
  const winChance = target;
  const multiplier = Math.round((99 / target) * 100) / 100;
  const potentialProfit = Math.floor(betAmount * multiplier) - betAmount;

  // Initialize Client Seed
  useEffect(() => {
    setClientSeed(Math.random().toString(36).substring(2, 12));
  }, []);

  // Fetch Balance & Active Commitment
  const fetchBalanceAndCommitment = useCallback(async () => {
    if (!accessToken) return;
    try {
      // 1. Fetch balance
      const balRes = await fetch(`${apiUrl}/api/wallet/balance`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (balRes.ok) {
        const balData = await balRes.json();
        setBalance(balData.balance);
      }

      // 2. Fetch commitment for next round
      const startRes = await fetch(`${apiUrl}/api/games/dice/start`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ clientSeed }),
      });
      if (startRes.ok) {
        const startData = await startRes.json();
        setCurrentRoundId(startData.roundId);
        setServerSeedHash(startData.serverSeedHash);
        setCurrentNonce(startData.nonce);
      }
    } catch {
      // Ignore
    }
  }, [accessToken, apiUrl, clientSeed]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (accessToken) {
      fetchBalanceAndCommitment();
    }
  }, [user, isLoading, accessToken, router, fetchBalanceAndCommitment]);

  // Roll Dice Handler
  const handleRoll = async () => {
    if (!accessToken || !currentRoundId || isRolling) return;
    setError(null);
    setIsRolling(true);

    const idempotencyKey = `dice_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await fetch(`${apiUrl}/api/games/dice/play`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          roundId: currentRoundId,
          clientSeed,
          target,
          betAmount,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to execute roll");
      } else {
        const rollRecord: PastRoll = {
          roundId: data.roundId,
          roll: data.roll,
          target: data.target,
          won: data.won,
          betAmount: data.betAmount,
          payoutAmount: data.payoutAmount,
          serverSeed: data.serverSeed,
          serverSeedHash: data.serverSeedHash,
          clientSeed: data.clientSeed,
          nonce: data.nonce,
        };

        setLastRoll(rollRecord);
        setHistory((prev) => [rollRecord, ...prev.slice(0, 9)]);
        setBalance(data.balance);

        // Fetch fresh commitment for the next round
        await fetchBalanceAndCommitment();
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setIsRolling(false);
    }
  };

  if (isLoading || !user) {
    return <div className="text-center py-20 text-slate-400">Loading game...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Dice5 className="w-8 h-8 text-blue-400" />
            <span>Classic Dice (Provably Fair)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Roll from 0.00 to 99.99 • 1.00% Documented House Edge • HMAC-SHA256 Commit-Reveal Engine
          </p>
        </div>

        <div className="flex items-center gap-3 bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl">
          <Coins className="w-5 h-5 text-amber-400" />
          <div>
            <div className="text-[10px] uppercase font-bold text-slate-400">Virtual Credits</div>
            <div className="text-base font-extrabold text-white font-mono">
              {balance !== null ? balance.toLocaleString() : "..."}
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/40 border border-red-800 text-red-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Game Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* Left: Interactive Game Board */}
        <div className="lg:col-span-2 p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col justify-between">
          {/* Outcome Display Box */}
          <div className="py-12 px-6 rounded-2xl bg-slate-950/70 border border-slate-800/80 text-center mb-8 relative overflow-hidden">
            <div className="text-xs uppercase font-extrabold tracking-widest text-slate-500 mb-2">
              {lastRoll ? (lastRoll.won ? "WINNER!" : "HOUSE WINS") : "READY TO ROLL"}
            </div>

            <div
              className={`text-6xl md:text-7xl font-black font-mono tracking-tight transition duration-300 ${
                lastRoll
                  ? lastRoll.won
                    ? "text-green-400 drop-shadow-[0_0_25px_rgba(74,222,128,0.3)]"
                    : "text-red-400"
                  : "text-white"
              }`}
            >
              {lastRoll ? lastRoll.roll.toFixed(2) : "50.00"}
            </div>

            {lastRoll && (
              <div className="mt-4 text-xs font-semibold text-slate-300">
                Rolled <span className="font-mono">{lastRoll.roll.toFixed(2)}</span> with target under{" "}
                <span className="font-mono text-amber-400">{lastRoll.target.toFixed(2)}</span>. Payout:{" "}
                <span className={lastRoll.won ? "text-green-400 font-bold" : "text-slate-500"}>
                  {lastRoll.payoutAmount} Credits
                </span>
              </div>
            )}
          </div>

          {/* Slider & Target Picker */}
          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center text-xs font-bold text-slate-300 mb-2">
                <span>Roll Under Target: <span className="text-amber-400 text-sm font-mono">{target.toFixed(2)}</span></span>
                <span className="text-slate-400">Range: 1.00 – 98.00</span>
              </div>
              <input
                type="range"
                min="1.0"
                max="98.0"
                step="0.5"
                value={target}
                onChange={(e) => setTarget(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
            </div>

            {/* Odds & Multipliers */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Win Chance</span>
                <span className="text-base font-extrabold text-blue-400 font-mono">
                  {winChance.toFixed(2)}%
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Multiplier</span>
                <span className="text-base font-extrabold text-amber-400 font-mono">
                  {multiplier.toFixed(2)}x
                </span>
              </div>
              <div className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 text-center">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Net Profit</span>
                <span className="text-base font-extrabold text-green-400 font-mono">
                  +{potentialProfit > 0 ? potentialProfit : 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Bet Controls & Seed Panel */}
        <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-sm uppercase tracking-wider font-extrabold text-slate-300">
              Wager Settings
            </h2>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Bet Amount (Credits)
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={betAmount}
                  onChange={(e) => setBetAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setBetAmount((b) => Math.max(1, Math.floor(b / 2)))}
                  className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                >
                  ½
                </button>
                <button
                  type="button"
                  onClick={() => setBetAmount((b) => b * 2)}
                  className="px-2.5 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                >
                  2×
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 mb-1">
                Client Seed (Customizable)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clientSeed}
                  onChange={(e) => setClientSeed(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setClientSeed(Math.random().toString(36).substring(2, 12))}
                  className="p-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                  title="Generate Random Seed"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Current Commitment Details */}
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-[11px] space-y-1">
              <div className="text-slate-400 font-semibold flex items-center gap-1">
                <Shield className="w-3 h-3 text-blue-400" />
                Active Commitment (Next Round)
              </div>
              <div className="text-slate-500 truncate font-mono">
                Hash: <span className="text-slate-300">{serverSeedHash || "Generating..."}</span>
              </div>
              <div className="text-slate-500 font-mono">
                Nonce: <span className="text-slate-300">{currentNonce}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleRoll}
            disabled={isRolling || !balance || balance < betAmount}
            className="w-full mt-6 py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white font-extrabold text-sm transition shadow-lg shadow-blue-600/20"
          >
            {isRolling ? "Rolling..." : `Roll Dice (${betAmount} Credits)`}
          </button>
        </div>
      </div>

      {/* Provably Fair Audit Trail */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" />
            <span>Recent Rolls & Revealed Commitments</span>
          </h2>
          <Link
            href="/verify"
            className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
          >
            <span>Open Independent Verifier</span>
            <ExternalLink className="w-3 h-3" />
          </Link>
        </div>

        {history.length === 0 ? (
          <div className="text-center py-8 text-slate-500 text-xs">
            No rounds played in this session yet. Take a roll to inspect revealed seeds.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/60">
                <tr>
                  <th className="py-2.5 px-4">Nonce</th>
                  <th className="py-2.5 px-4">Roll</th>
                  <th className="py-2.5 px-4">Target</th>
                  <th className="py-2.5 px-4">Payout</th>
                  <th className="py-2.5 px-4">Revealed Server Seed</th>
                  <th className="py-2.5 px-4 text-right">Audit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {history.map((h) => (
                  <tr key={h.roundId} className="hover:bg-slate-800/30 transition">
                    <td className="py-2.5 px-4 font-mono text-slate-400">#{h.nonce}</td>
                    <td
                      className={`py-2.5 px-4 font-mono font-bold ${
                        h.won ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {h.roll.toFixed(2)}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-300">{h.target.toFixed(2)}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-300">
                      {h.won ? `+${h.payoutAmount}` : "0"}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-slate-400 truncate max-w-[180px]">
                      {h.serverSeed}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <Link
                        href={`/verify?serverSeed=${h.serverSeed}&serverSeedHash=${h.serverSeedHash}&clientSeed=${h.clientSeed}&nonce=${h.nonce}`}
                        className="inline-flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
                      >
                        <ShieldCheck className="w-3 h-3" />
                        Verify
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

