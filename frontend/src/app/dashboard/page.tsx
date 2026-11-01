"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "../../context/AuthContext";
import { Coins, Dice5, ShieldCheck, UserCheck, AlertTriangle, ArrowRight } from "lucide-react";

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push("/login");
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 text-center text-slate-400">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Welcome & Role Card */}
      <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold text-white">Simulator Dashboard</h1>
            <span
              className={`text-xs uppercase font-extrabold px-2.5 py-0.5 rounded ${
                user.role === "admin"
                  ? "bg-red-950 text-red-400 border border-red-800"
                  : "bg-amber-950 text-amber-400 border border-amber-800"
              }`}
            >
              {user.role}
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Authenticated as <span className="text-slate-200 font-medium">{user.email}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-4 py-2 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs">
            <span className="text-slate-400 block">Wallet ID</span>
            <span className="font-mono text-slate-300 font-semibold">{user.walletId || "Created"}</span>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Wallet & Balance */}
        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Virtual Balance
              </span>
              <Coins className="w-5 h-5 text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold text-white font-mono">
              0 <span className="text-amber-400 text-lg font-normal">Credits</span>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Sum of immutable ledger entries. No mutable balance field.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <Link
              href="/wallet"
              className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center justify-between"
            >
              <span>Manage Deposit / Withdrawal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Dice Game */}
        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Provably Fair Game
              </span>
              <Dice5 className="w-5 h-5 text-blue-400" />
            </div>
            <div className="text-xl font-bold text-white">Classic Dice Roll</div>
            <p className="mt-2 text-xs text-slate-400">
              Roll 0.00 – 99.99 with HMAC-SHA256 outcome computation and 1% house edge.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <Link
              href="/games/dice"
              className="text-xs font-bold text-blue-400 hover:text-blue-300 flex items-center justify-between"
            >
              <span>Launch Simulator</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Verifier */}
        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Verification Engine
              </span>
              <ShieldCheck className="w-5 h-5 text-green-400" />
            </div>
            <div className="text-xl font-bold text-white">Cryptographic Verifier</div>
            <p className="mt-2 text-xs text-slate-400">
              Audit server seed commitments and independently re-calculate past rolls.
            </p>
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800">
            <Link
              href="/verify"
              className="text-xs font-bold text-green-400 hover:text-green-300 flex items-center justify-between"
            >
              <span>Audit Round Results</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

