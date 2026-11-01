"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import {
  ShieldAlert,
  Users,
  History,
  AlertTriangle,
  CheckCircle2,
  Lock,
  Search,
} from "lucide-react";

interface AdminStats {
  totalUsers: number;
  totalVolume: number;
  openFraudFlags: number;
  excludedUsers: number;
  cooldownUsers: number;
}

export default function AdminDashboardPage() {
  const { user, accessToken, apiUrl, isLoading } = useAuth();
  const router = useRouter();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [activeTab, setActiveTab] = useState<"users" | "transactions" | "fraud">("fraud");

  const [usersList, setUsersList] = useState<any[]>([]);
  const [transactionsList, setTransactionsList] = useState<any[]>([]);
  const [fraudFlags, setFraudFlags] = useState<any[]>([]);

  const [loadingData, setLoadingData] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const fetchAdminData = useCallback(async () => {
    if (!accessToken) return;
    setLoadingData(true);

    try {
      // 1. Fetch overview stats
      const statsRes = await fetch(`${apiUrl}/api/admin/overview`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData.stats);
      }

      // 2. Fetch Users
      const usersRes = await fetch(`${apiUrl}/api/admin/users?limit=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (usersRes.ok) {
        setUsersList(await usersRes.json());
      }

      // 3. Fetch Transactions
      const txRes = await fetch(`${apiUrl}/api/admin/transactions?limit=50`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (txRes.ok) {
        setTransactionsList(await txRes.json());
      }

      // 4. Fetch Fraud Flags
      const fraudRes = await fetch(`${apiUrl}/api/admin/fraud-flags`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (fraudRes.ok) {
        setFraudFlags(await fraudRes.json());
      }
    } catch {
      // Ignore
    } finally {
      setLoadingData(false);
    }
  }, [accessToken, apiUrl]);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push("/login");
      } else if (user.role !== "admin") {
        router.push("/dashboard");
      } else {
        fetchAdminData();
      }
    }
  }, [user, isLoading, router, fetchAdminData]);

  const handleMarkReviewed = async (flagId: string) => {
    if (!accessToken) return;
    try {
      const res = await fetch(`${apiUrl}/api/admin/fraud-flags/${flagId}/review`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (res.ok) {
        setFeedback("Fraud flag marked as reviewed.");
        fetchAdminData();
      }
    } catch (err: any) {
      setFeedback(err.message || "Action failed");
    }
  };

  if (isLoading || !user || user.role !== "admin") {
    return <div className="text-center py-20 text-slate-400">Verifying admin credentials...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-extrabold text-white flex items-center gap-3">
            <Lock className="w-8 h-8 text-red-400" />
            <span>System Administration & Risk Center</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Role-gated administrative suite • Isolation Forest anomaly auditing • Ledger monitoring
          </p>
        </div>
      </div>

      {feedback && (
        <div className="mb-6 p-4 rounded-xl bg-green-950/40 border border-green-800 text-green-300 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400">Total Users</span>
          <div className="text-2xl font-black text-white font-mono mt-1">
            {stats ? stats.totalUsers : "..."}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400">Total Volume</span>
          <div className="text-2xl font-black text-amber-400 font-mono mt-1">
            {stats ? stats.totalVolume.toLocaleString() : "..."} <span className="text-xs text-slate-400 font-normal">Credits</span>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400">Open Fraud Flags</span>
          <div className="text-2xl font-black text-red-400 font-mono mt-1">
            {stats ? stats.openFraudFlags : "..."}
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400">Restricted Accounts</span>
          <div className="text-2xl font-black text-blue-400 font-mono mt-1">
            {stats ? stats.excludedUsers + stats.cooldownUsers : "..."}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-800 mb-6 gap-2">
        <button
          onClick={() => setActiveTab("fraud")}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === "fraud"
              ? "border-red-500 text-red-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          Anomaly & Bot Detection ({fraudFlags.length})
        </button>
        <button
          onClick={() => setActiveTab("users")}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === "users"
              ? "border-blue-500 text-blue-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          User Accounts Directory ({usersList.length})
        </button>
        <button
          onClick={() => setActiveTab("transactions")}
          className={`py-2 px-4 text-xs font-bold border-b-2 transition ${
            activeTab === "transactions"
              ? "border-amber-500 text-amber-400"
              : "border-transparent text-slate-400 hover:text-white"
          }`}
        >
          Global Transactions ({transactionsList.length})
        </button>
      </div>

      {/* Tab 1: Fraud Flags */}
      {activeTab === "fraud" && (
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span>Flagged Accounts (Isolation Forest Model)</span>
          </h2>

          {fraudFlags.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No anomalies or bot accounts flagged. The machine learning pipeline is clean.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/60">
                  <tr>
                    <th className="py-3 px-4">Account ID / Email</th>
                    <th className="py-3 px-4">Anomaly Score</th>
                    <th className="py-3 px-4">Automated Reason</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {fraudFlags.map((flag) => (
                    <tr key={flag.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-mono text-slate-300">
                        {flag.user?.email || flag.user_id}
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-red-400">
                        {flag.anomaly_score}
                      </td>
                      <td className="py-3 px-4 text-slate-300 max-w-xs">{flag.reason}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            flag.status === "open"
                              ? "bg-red-950 text-red-400 border border-red-800"
                              : "bg-green-950 text-green-400 border border-green-800"
                          }`}
                        >
                          {flag.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        {flag.status === "open" && (
                          <button
                            onClick={() => handleMarkReviewed(flag.id)}
                            className="px-3 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold"
                          >
                            Mark Reviewed
                          </button>
                        )}
                        {flag.status === "reviewed" && (
                          <span className="text-[11px] text-slate-500 font-mono">
                            Reviewed
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Users */}
      {activeTab === "users" && (
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-400" />
            <span>Platform User Directory</span>
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-800/60 text-slate-400 uppercase tracking-wider font-semibold border-b border-slate-700/60">
                <tr>
                  <th className="py-3 px-4">Email</th>
                  <th className="py-3 px-4">Role</th>
                  <th className="py-3 px-4 text-right">Balance</th>
                  <th className="py-3 px-4">Joined</th>
                  <th className="py-3 px-4">Safety Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {usersList.map((u) => {
                  const isExcluded = u.self_excluded_until && new Date(u.self_excluded_until) > new Date();
                  const isCooldown = u.cooldown_until && new Date(u.cooldown_until) > new Date();

                  return (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 font-medium text-white">{u.email}</td>
                      <td className="py-3 px-4 uppercase text-[10px] font-bold">
                        <span className={u.role === "admin" ? "text-red-400" : "text-slate-400"}>
                          {u.role}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                        {u.balance ?? 0}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        {isExcluded ? (
                          <span className="px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-800 text-[10px] font-bold">
                            Self-Excluded
                          </span>
                        ) : isCooldown ? (
                          <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-bold">
                            In Cooldown
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[10px]">Active (Normal)</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Transactions */}
      {activeTab === "transactions" && (
        <div className="p-6 rounded-2xl bg-slate-900/70 border border-slate-800 shadow-xl">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <History className="w-5 h-5 text-amber-400" />
            <span>Global Immutable Ledger Log</span>
          </h2>

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
                {transactionsList.map((tx) => (
                  <tr key={tx.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4 font-mono text-slate-400">
                      {new Date(tx.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 uppercase text-[10px] font-bold text-slate-300">
                      {tx.type}
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-mono font-bold ${
                        tx.amount > 0 ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-400 truncate max-w-[150px]">
                      {tx.reference}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-500 truncate max-w-[150px]">
                      {tx.idempotency_key}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

