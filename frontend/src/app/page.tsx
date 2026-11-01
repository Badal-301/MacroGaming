import Link from "next/link";
import { Shield, Lock, Scale, Zap, CheckCircle2 } from "lucide-react";

export default function Home() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-16 flex flex-col items-center text-center">
      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold mb-6">
        <Shield className="w-3.5 h-3.5" />
        College Project • Virtual Currency Only • Academic Research
      </div>

      <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight text-white max-w-3xl leading-tight">
        High-Concurrency <span className="text-amber-400">Ledger & Provably Fair</span> Gaming Engine
      </h1>

      <p className="mt-6 text-lg text-slate-300 max-w-2xl">
        A full-stack transaction simulation demonstrating strict ACID ledger entries, row-level concurrency locking, HMAC-SHA256 commit-reveal fairness, and real-time event distribution.
      </p>

      <div className="mt-8 flex flex-wrap gap-4 justify-center">
        <Link
          href="/register"
          className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold px-6 py-3 rounded-lg shadow-lg hover:shadow-amber-500/20 transition"
        >
          Get Started (Free Test Account)
        </Link>
        <Link
          href="/login"
          className="bg-slate-800 hover:bg-slate-700 text-white font-medium px-6 py-3 rounded-lg border border-slate-700 transition"
        >
          Sign In
        </Link>
      </div>

      {/* Architecture Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-20 text-left w-full">
        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Pessimistic Row Locking</h3>
          <p className="text-sm text-slate-400">
            Balances are never stored as mutable columns. Every operation is an immutable ledger entry guarded by <code className="text-amber-300">SELECT ... FOR UPDATE</code>.
          </p>
        </div>

        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="w-10 h-10 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-4">
            <Scale className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Commit-Reveal Fairness</h3>
          <p className="text-sm text-slate-400">
            Outcomes are cryptographically locked using SHA-256 seed commitments before bets are accepted, verifiable by players post-round.
          </p>
        </div>

        <div className="p-6 rounded-xl bg-slate-900/60 border border-slate-800">
          <div className="w-10 h-10 rounded-lg bg-green-500/10 border border-green-500/20 flex items-center justify-center text-green-400 mb-4">
            <Zap className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-white mb-2">Socket.io Live Sync</h3>
          <p className="text-sm text-slate-400">
            Real-time balance notifications and round resolutions synchronized instantly across browser tabs and devices.
          </p>
        </div>
      </div>
    </div>
  );
}

