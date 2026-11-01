"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../../context/AuthContext";
import {
  ShieldCheck,
  Coins,
  History,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Trophy,
} from "lucide-react";

interface Card {
  suit: "H" | "D" | "C" | "S";
  rank: string;
  value: number;
}

export default function BlackjackPage() {
  const { user, accessToken, apiUrl, balance, refreshBalance, isLoading } = useAuth();
  const router = useRouter();

  // Betting & Seeds
  const [betAmount, setBetAmount] = useState<number>(25);
  const [clientSeed, setClientSeed] = useState<string>("");

  // Game Hand State
  const [roundId, setRoundId] = useState<string | null>(null);
  const [playerHand, setPlayerHand] = useState<Card[]>([]);
  const [dealerHand, setDealerHand] = useState<Card[]>([]);
  const [playerScore, setPlayerScore] = useState<number>(0);
  const [dealerScore, setDealerScore] = useState<number | null>(null);

  // Status: "idle" | "in_progress" | "completed"
  const [gameStatus, setGameStatus] = useState<string>("idle");
  const [resultText, setResultText] = useState<string | null>(null);
  const [payoutAmount, setPayoutAmount] = useState<number>(0);

  // Provably Fair Revealed Data
  const [serverSeed, setServerSeed] = useState<string | null>(null);
  const [serverSeedHash, setServerSeedHash] = useState<string | null>(null);
  const [nonce, setNonce] = useState<number>(1);

  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setClientSeed(Math.random().toString(36).substring(2, 12));
  }, []);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  // Deal
  const handleDeal = async () => {
    if (!accessToken || isProcessing) return;
    setError(null);
    setIsProcessing(true);
    setResultText(null);
    setServerSeed(null);

    const idempotencyKey = `bj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await fetch(`${apiUrl}/api/games/blackjack/deal`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          betAmount,
          clientSeed,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to deal hand");
      } else {
        setRoundId(data.roundId);
        setPlayerHand(data.playerHand || []);
        setDealerHand(data.dealerHand || []);
        setPlayerScore(data.playerScore);
        setGameStatus(data.status);
        setServerSeedHash(data.serverSeedHash);
        setNonce(data.nonce);

        if (data.status === "completed") {
          setDealerScore(data.dealerScore);
          setResultText(data.result.toUpperCase());
          setPayoutAmount(data.payoutAmount);
          setServerSeed(data.serverSeed);
        } else {
          setDealerScore(null);
        }

        refreshBalance();
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Hit
  const handleHit = async () => {
    if (!accessToken || !roundId || isProcessing) return;
    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch(`${apiUrl}/api/games/blackjack/hit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ roundId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Hit action failed");
      } else {
        setPlayerHand(data.playerHand);
        setDealerHand(data.dealerHand);
        setPlayerScore(data.playerScore);
        setGameStatus(data.status);

        if (data.status === "completed") {
          setDealerScore(data.dealerScore);
          setResultText(data.result.toUpperCase());
          setPayoutAmount(data.payoutAmount);
          setServerSeed(data.serverSeed);
        }

        refreshBalance();
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Stand
  const handleStand = async () => {
    if (!accessToken || !roundId || isProcessing) return;
    setIsProcessing(true);
    setError(null);

    try {
      const res = await fetch(`${apiUrl}/api/games/blackjack/stand`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ roundId }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Stand action failed");
      } else {
        setPlayerHand(data.playerHand);
        setDealerHand(data.dealerHand);
        setPlayerScore(data.playerScore);
        setDealerScore(data.dealerScore);
        setGameStatus("completed");
        setResultText(data.result.toUpperCase());
        setPayoutAmount(data.payoutAmount);
        setServerSeed(data.serverSeed);

        refreshBalance();
      }
    } catch (err: any) {
      setError(err.message || "Network error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Helper to render card visual
  const renderCard = (card: Card, isHidden: boolean = false) => {
    if (isHidden) {
      return (
        <div className="w-16 h-24 rounded-lg bg-gradient-to-br from-blue-900 to-indigo-950 border-2 border-indigo-700/80 shadow-md flex items-center justify-center">
          <div className="w-10 h-16 rounded border border-indigo-600/40 flex items-center justify-center text-xs text-indigo-400 font-bold font-mono">
            ?
          </div>
        </div>
      );
    }

    const isRed = card.suit === "H" || card.suit === "D";
    const suitSymbol =
      card.suit === "H" ? "♥" : card.suit === "D" ? "♦" : card.suit === "C" ? "♣" : "♠";

    return (
      <div className="w-16 h-24 rounded-lg bg-white border border-slate-300 shadow-lg p-1.5 flex flex-col justify-between text-slate-900 select-none">
        <div className={`text-xs font-bold leading-none ${isRed ? "text-red-600" : "text-slate-900"}`}>
          {card.rank}
        </div>
        <div className={`text-2xl text-center leading-none ${isRed ? "text-red-600" : "text-slate-900"}`}>
          {suitSymbol}
        </div>
        <div className={`text-xs font-bold leading-none self-end ${isRed ? "text-red-600" : "text-slate-900"}`}>
          {card.rank}
        </div>
      </div>
    );
  };

  if (isLoading || !user) {
    return <div className="text-center py-20 text-slate-400">Loading blackjack...</div>;
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Trophy className="w-8 h-8 text-amber-400" />
            <span>Blackjack 21 (Provably Fair)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Fisher-Yates HMAC-SHA256 Deck Shuffling • 3:2 Natural Payout • Real-Time Socket Updates
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

      {/* Main Table Felt */}
      <div className="p-8 rounded-3xl bg-gradient-to-b from-emerald-950/80 via-emerald-900/60 to-slate-950/90 border-4 border-amber-900/40 shadow-2xl mb-8 min-h-[460px] flex flex-col justify-between relative overflow-hidden">
        {/* Result Overlay */}
        {gameStatus === "completed" && resultText && (
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-center p-6 animate-fade-in">
            <div
              className={`text-4xl md:text-5xl font-black mb-2 ${
                resultText.includes("WIN") || resultText.includes("BLACKJACK")
                  ? "text-green-400 drop-shadow-[0_0_20px_rgba(74,222,128,0.4)]"
                  : resultText.includes("PUSH")
                  ? "text-amber-400"
                  : "text-red-400"
              }`}
            >
              {resultText === "BLACKJACK"
                ? "BLACKJACK! (3:2 PAYOUT)"
                : resultText === "WIN"
                ? "YOU WIN!"
                : resultText === "PUSH"
                ? "PUSH (BET RETURNED)"
                : "DEALER WINS"}
            </div>
            <div className="text-sm font-semibold text-slate-200 font-mono mb-6">
              Payout: <span className="text-green-400 font-bold">{payoutAmount}</span> Credits
            </div>
            <button
              onClick={handleDeal}
              className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-sm shadow-lg transition"
            >
              Play Another Hand
            </button>
          </div>
        )}

        {/* Dealer Area */}
        <div className="flex flex-col items-center">
          <div className="text-xs uppercase font-extrabold tracking-wider text-emerald-300/80 mb-2">
            Dealer Hand {dealerScore !== null ? `(${dealerScore})` : ""}
          </div>
          <div className="flex gap-3 min-h-[96px]">
            {dealerHand.length > 0 ? (
              <>
                {dealerHand.map((c, i) => (
                  <React.Fragment key={i}>
                    {renderCard(c, false)}
                  </React.Fragment>
                ))}
                {/* Face down hole card when in progress */}
                {gameStatus === "in_progress" && renderCard(dealerHand[0], true)}
              </>
            ) : (
              <div className="text-xs text-emerald-400/40 italic py-8">Dealer waiting for deal...</div>
            )}
          </div>
        </div>

        {/* Divider table mark */}
        <div className="border-b border-emerald-500/20 w-full my-6 text-center">
          <span className="bg-emerald-950/60 px-4 py-1 rounded-full text-[10px] uppercase font-bold text-emerald-400/60 tracking-widest border border-emerald-500/20">
            Blackjack pays 3 to 2 • Dealer stands on 17
          </span>
        </div>

        {/* Player Area */}
        <div className="flex flex-col items-center">
          <div className="flex gap-3 min-h-[96px] mb-2">
            {playerHand.length > 0 ? (
              playerHand.map((c, i) => (
                <React.Fragment key={i}>
                  {renderCard(c, false)}
                </React.Fragment>
              ))
            ) : (
              <div className="text-xs text-emerald-400/40 italic py-8">Place your bet and click Deal</div>
            )}
          </div>
          <div className="text-xs uppercase font-extrabold tracking-wider text-emerald-300/80">
            Your Hand {playerScore > 0 ? `(${playerScore})` : ""}
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Bet Selector */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 mb-1">
            Wager (Credits)
          </label>
          <div className="flex gap-2">
            {[10, 25, 50, 100].map((amt) => (
              <button
                key={amt}
                type="button"
                disabled={gameStatus === "in_progress"}
                onClick={() => setBetAmount(amt)}
                className={`flex-1 py-1.5 text-xs font-bold rounded-lg border transition ${
                  betAmount === amt
                    ? "bg-amber-500 text-slate-950 border-amber-400"
                    : "bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700"
                }`}
              >
                {amt}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="md:col-span-2 flex gap-3">
          {gameStatus === "in_progress" ? (
            <>
              <button
                onClick={handleHit}
                disabled={isProcessing}
                className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-black text-sm shadow-lg shadow-blue-600/20 transition disabled:opacity-40"
              >
                HIT
              </button>
              <button
                onClick={handleStand}
                disabled={isProcessing}
                className="flex-1 py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition disabled:opacity-40"
              >
                STAND
              </button>
            </>
          ) : (
            <button
              onClick={handleDeal}
              disabled={isProcessing || !balance || balance < betAmount}
              className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg shadow-emerald-600/20 transition disabled:opacity-40"
            >
              DEAL ({betAmount} Credits)
            </button>
          )}
        </div>
      </div>

      {/* Provably Fair Reveal Card */}
      {serverSeed && (
        <div className="mt-6 p-4 rounded-xl bg-slate-900/60 border border-slate-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-slate-400 font-mono truncate max-w-xl">
            Revealed Seed: <span className="text-slate-200">{serverSeed}</span>
          </div>
          <Link
            href={`/verify?serverSeed=${serverSeed}&serverSeedHash=${serverSeedHash}&clientSeed=${clientSeed}&nonce=${nonce}`}
            className="inline-flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-semibold flex-shrink-0"
          >
            <ShieldCheck className="w-4 h-4" />
            Audit Seed Commitment
          </Link>
        </div>
      )}
    </div>
  );
}

