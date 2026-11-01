"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import {
  ShieldAlert,
  Clock,
  Sliders,
  CheckCircle,
  AlertCircle,
  Lock,
} from "lucide-react";

export default function SettingsPage() {
  const { user, accessToken, apiUrl, isLoading } = useAuth();
  const router = useRouter();

  const [sessionBetLimit, setSessionBetLimit] = useState<number>(10000);
  const [depositLimit, setDepositLimit] = useState<number>(50000);
  const [exclusionDays, setExclusionDays] = useState<number>(7);

  const [selfExcludedUntil, setSelfExcludedUntil] = useState<string | null>(null);
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }

    if (accessToken) {
      fetch(`${apiUrl}/api/protection/status`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.limits) {
            setSessionBetLimit(data.limits.session_bet_limit);
            setDepositLimit(data.limits.deposit_limit);
          }
          setSelfExcludedUntil(data.selfExcludedUntil);
          setCooldownUntil(data.cooldownUntil);
        })
        .catch(() => {});
    }
  }, [user, isLoading, accessToken, apiUrl, router]);

  const handleUpdateLimits = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setFeedback(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`${apiUrl}/api/protection/limits`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          sessionBetLimit: Number(sessionBetLimit),
          depositLimit: Number(depositLimit),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", message: data.error || "Failed to update limits" });
      } else {
        setFeedback({ type: "success", message: "Personal betting & deposit limits updated successfully." });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Network error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelfExclude = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    if (!confirm(`Are you sure you want to self-exclude for ${exclusionDays} day(s)? This action CANNOT be reversed or undone early.`)) {
      return;
    }

    setFeedback(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`${apiUrl}/api/protection/self-exclude`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ days: Number(exclusionDays) }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", message: data.error || "Self-exclusion failed" });
      } else {
        setSelfExcludedUntil(data.selfExcludedUntil);
        setFeedback({
          type: "success",
          message: `Account self-excluded until ${new Date(data.selfExcludedUntil).toLocaleDateString()}. Betting and deposits are now locked.`,
        });
      }
    } catch (err: any) {
      setFeedback({ type: "error", message: err.message || "Network error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const isCurrentlyExcluded = selfExcludedUntil && new Date(selfExcludedUntil) > new Date();
  const isCurrentlyCooldown = cooldownUntil && new Date(cooldownUntil) > new Date();

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
          <ShieldAlert className="w-8 h-8 text-amber-400" />
          <span>Responsible Gaming & Safety Controls</span>
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Academic simulation protections: enforce personal limits, track loss cooldowns, or activate account self-exclusion.
        </p>
      </div>

      {feedback && (
        <div
          className={`mb-6 p-4 rounded-xl flex items-start gap-3 text-sm ${
            feedback.type === "success"
              ? "bg-green-950/40 border border-green-800 text-green-300"
              : "bg-red-950/40 border border-red-800 text-red-300"
          }`}
        >
          {feedback.type === "success" ? (
            <CheckCircle className="w-5 h-5 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Active Restriction Status */}
      {(isCurrentlyExcluded || isCurrentlyCooldown) && (
        <div className="mb-8 p-6 rounded-2xl bg-red-950/40 border border-red-800 shadow-xl space-y-2">
          <div className="text-sm font-bold text-red-300 flex items-center gap-2">
            <Lock className="w-4 h-4 text-red-400" />
            Active Account Restrictions
          </div>
          {isCurrentlyExcluded && (
            <p className="text-xs text-red-200">
              • <strong>Self-Exclusion Active:</strong> All wagering and deposit endpoints are strictly locked until{" "}
              {new Date(selfExcludedUntil!).toLocaleString()}.
            </p>
          )}
          {isCurrentlyCooldown && (
            <p className="text-xs text-red-200">
              • <strong>Loss Streak Cooldown:</strong> 5 consecutive losses triggered a cooling-off period until{" "}
              {new Date(cooldownUntil!).toLocaleString()}.
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Set Personal Limits */}
        <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
          <h2 className="text-base font-bold text-white flex items-center gap-2 mb-2">
            <Sliders className="w-5 h-5 text-blue-400" />
            <span>Wager & Deposit Limits</span>
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Configure thresholds enforced on the server for all games and transactions.
          </p>

          <form onSubmit={handleUpdateLimits} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Max Bet Per Round (Credits)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={sessionBetLimit}
                onChange={(e) => setSessionBetLimit(parseInt(e.target.value, 10) || 0)}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Max Single Deposit (Credits)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                required
                value={depositLimit}
                onChange={(e) => setDepositLimit(parseInt(e.target.value, 10) || 0)}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold text-xs transition shadow-md"
            >
              Update Safety Limits
            </button>
          </form>
        </div>

        {/* Self-Exclusion */}
        <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
          <h2 className="text-base font-bold text-white flex items-center gap-2 mb-2">
            <Clock className="w-5 h-5 text-amber-400" />
            <span>Account Self-Exclusion</span>
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Lock yourself out of all betting and deposits for 1 to 365 days. <strong>Cannot be undone early.</strong>
          </p>

          <form onSubmit={handleSelfExclude} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1">
                Exclusion Duration (Days)
              </label>
              <select
                value={exclusionDays}
                onChange={(e) => setExclusionDays(parseInt(e.target.value, 10))}
                disabled={isCurrentlyExcluded || false}
                className="w-full px-4 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-amber-500"
              >
                <option value={1}>1 Day (Cooling-off)</option>
                <option value={7}>7 Days (1 Week)</option>
                <option value={30}>30 Days (1 Month)</option>
                <option value={90}>90 Days (3 Months)</option>
                <option value={365}>365 Days (1 Year)</option>
              </select>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || Boolean(isCurrentlyExcluded)}
              className="w-full py-2.5 px-4 rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white font-bold text-xs transition shadow-md"
            >
              {isCurrentlyExcluded ? "Account Already Self-Excluded" : "Activate Self-Exclusion"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
