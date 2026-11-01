"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import {
  Coins,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  History,
  AlertCircle,
  CheckCircle,
  ShieldAlert,
} from "lucide-react";

interface LedgerEntry {
  id: string;
  type: "deposit" | "withdrawal" | "bet" | "payout";
  amount: number;
  reference: string;
  idempotency_key: string;
  created_at: string;
}

export default function WalletPage() {
  const { user, accessToken, apiUrl, isLoading } = useAuth();
  const router = useRouter();

  const [balance, setBalance] = useState<number | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [totalEntries, setTotalEntries] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 10;

  const [depositAmount, setDepositAmount] = useState<number>(100);
  const [withdrawAmount, setWithdrawAmount] = useState<number>(50);

  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchWalletData = useCallback(async () => {
    if (!accessToken) return;
    setIsRefreshing(true);
    try {
      // 1. Fetch live balance
      const balRes = await fetch(`${apiUrl}/api/wallet/balance`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (balRes.ok) {
        const balData = await balRes.json();
        setBalance(balData.balance);
      }

      // 2. Fetch transaction history
      const txRes = await fetch(`${apiUrl}/api/wallet/transactions?page=${page}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (txRes.ok) {
        const txData = await txRes.json();
        setEntries(txData.entries || []);
        setTotalEntries(txData.total || 0);
        setTotalPages(txData.totalPages || 1);
      }
    } catch {
      // Ignore network errors on refresh
    } finally {
      setIsRefreshing(false);
    }
  }, [accessToken, apiUrl, page, limit]);

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
      return;
    }
    if (accessToken) {
      fetchWalletData();
    }
  }, [user, isLoading, accessToken, router, fetchWalletData]);

  const handleDeposit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setFeedback(null);
    setIsSubmitting(true);

    const idempotencyKey = `dep_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await fetch(`${apiUrl}/api/wallet/deposit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          amount: Math.floor(depositAmount),
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Deposit failed" });
      } else {
        setFeedback({
          type: "success",
          text: `Successfully deposited ${depositAmount} virtual credits via Mock Gateway (Test Mode).`,
        });
        await fetchWalletData();
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Network error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    setFeedback(null);
    setIsSubmitting(true);

    const idempotencyKey = `wth_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    try {
      const res = await fetch(`${apiUrl}/api/wallet/withdraw`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          amount: Math.floor(withdrawAmount),
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setFeedback({ type: "error", text: data.error || "Withdrawal failed" });
      } else {
        setFeedback({
          type: "success",
          text: `Successfully withdrew ${withdrawAmount} virtual credits via Mock Gateway (Test Mode).`,
        });
        await fetchWalletData();
      }
    } catch (err: any) {
      setFeedback({ type: "error", text: err.message || "Network error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center text-slate-400">
        Loading wallet...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Coins className="w-8 h-8 text-amber-400" />
            <span>Virtual Wallet & Ledger</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            ACID transaction system • Dynamic sum of immutable ledger entries • Row-level lock protection
          </p>
        </div>

        <button
          onClick={fetchWalletData}
          disabled={isRefreshing}
          className="self-start sm:self-auto flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-amber-400" : ""}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Notice Banner */}
      <div className="mb-6 p-4 rounded-xl bg-amber-950/30 border border-amber-800/50 flex items-start gap-3">
        <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-200 leading-relaxed">
          <strong>Test Mode Gateway Active:</strong> All deposits and withdrawals pass through an internal mock payment gateway. No real payment methods, bank accounts, or real funds are ever involved. Balance cannot go negative.
        </div>
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
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* Balance Card */}
      <div className="p-8 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="text-xs uppercase tracking-wider font-bold text-slate-400">
            Available Virtual Balance
          </span>
          <div className="text-4xl md:text-5xl font-black text-white font-mono mt-1">
            {balance !== null ? balance.toLocaleString() : "..."}
            <span className="text-amber-400 text-xl font-normal ml-2">Credits</span>
          </div>
          <p className="text-xs text-slate-500 mt-2">
            Calculated as <code className="text-amber-300">SUM(ledger_entries.amount)</code>. No mutable balance row.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          {/* Deposit Dialog / Form */}
          <form onSubmit={handleDeposit} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1 mb-2">
              <ArrowDownLeft className="w-4 h-4 text-green-400" />
              Mock Deposit (Credits)
            </span>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                step="1"
                required
                value={depositAmount}
                onChange={(e) => setDepositAmount(parseInt(e.target.value, 10) || 0)}
                className="w-28 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-green-500"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-lg bg-green-600 hover:bg-green-500 text-white text-xs font-bold transition disabled:opacity-50"
              >
                Deposit
              </button>
            </div>
          </form>

          {/* Withdraw Dialog / Form */}
          <form onSubmit={handleWithdraw} className="p-4 rounded-xl bg-slate-800/60 border border-slate-700/60">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1 mb-2">
              <ArrowUpRight className="w-4 h-4 text-amber-400" />
              Mock Withdrawal (Credits)
            </span>
            <div className="flex gap-2">
              <input
                type="number"
                min="1"
                step="1"
                required
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(parseInt(e.target.value, 10) || 0)}
                className="w-28 px-3 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono text-sm focus:outline-none focus:border-amber-500"
              />
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition disabled:opacity-50"
              >
                Withdraw
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Transaction History Section */}
      <div className="p-6 rounded-2xl bg-slate-900/60 border border-slate-800 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <History className="w-5 h-5 text-slate-400" />
            <span>Immutable Ledger History</span>
          </h2>
          <span className="text-xs text-slate-400">Total Entries: {totalEntries}</span>
        </div>

        {entries.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            No ledger entries recorded yet. Make a deposit above to initialize your ledger.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/60">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4">Idempotency Key</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {entries.map((entry) => {
                  const isPositive = entry.amount > 0;
                  return (
                    <tr key={entry.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-mono text-slate-400">
                        {new Date(entry.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            entry.type === "deposit"
                              ? "bg-green-950 text-green-400 border border-green-800"
                              : entry.type === "withdrawal"
                              ? "bg-amber-950 text-amber-400 border border-amber-800"
                              : entry.type === "payout"
                              ? "bg-blue-950 text-blue-400 border border-blue-800"
                              : "bg-purple-950 text-purple-400 border border-purple-800"
                          }`}
                        >
                          {entry.type}
                        </span>
                      </td>
                      <td
                        className={`py-3 px-4 text-right font-mono font-bold ${
                          isPositive ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {isPositive ? `+${entry.amount}` : entry.amount}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-400 truncate max-w-[140px]">
                        {entry.reference}
                      </td>
                      <td className="py-3 px-4 font-mono text-slate-500 truncate max-w-[140px]">
                        {entry.idempotency_key}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400">
            <span>
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white transition"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white transition"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

