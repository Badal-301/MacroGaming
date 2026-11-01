"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import { Shield, Coins, Dice5, LogOut, User, LayoutDashboard } from "lucide-react";

export const Navbar: React.FC = () => {
  const { user, logout } = useAuth();

  return (
    <nav className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg text-amber-400 hover:text-amber-300 transition">
          <Shield className="w-5 h-5" />
          <span>ProvablyFair<span className="text-white text-xs ml-1 px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700">Edu Sim</span></span>
        </Link>

        {user && (
          <div className="hidden md:flex items-center gap-4 text-sm font-medium text-slate-300">
            <Link href="/dashboard" className="hover:text-amber-400 transition flex items-center gap-1.5">
              <LayoutDashboard className="w-4 h-4" />
              Dashboard
            </Link>
            <Link href="/wallet" className="hover:text-amber-400 transition flex items-center gap-1.5">
              <Coins className="w-4 h-4" />
              Wallet
            </Link>
            <Link href="/games/dice" className="hover:text-amber-400 transition flex items-center gap-1.5">
              <Dice5 className="w-4 h-4" />
              Dice
            </Link>
            <Link href="/games/blackjack" className="hover:text-amber-400 transition flex items-center gap-1.5">
              <Coins className="w-4 h-4" />
              Blackjack
            </Link>
            <Link href="/verify" className="hover:text-amber-400 transition">
              Verify Fairness
            </Link>
            {user.role === "admin" && (
              <Link href="/admin" className="text-red-400 hover:text-red-300 font-semibold px-2 py-0.5 rounded bg-red-950/40 border border-red-800/40">
                Admin Panel
              </Link>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3">
        {user ? (
          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <div className="text-xs text-slate-400">{user.email}</div>
              <div className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                {user.role}
              </div>
            </div>
            <button
              onClick={logout}
              className="flex items-center gap-1 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-1.5 rounded border border-slate-700 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="text-sm text-slate-300 hover:text-white px-3 py-1.5 rounded transition"
            >
              Login
            </Link>
            <Link
              href="/register"
              className="text-sm bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold px-4 py-1.5 rounded transition shadow-sm"
            >
              Register
            </Link>
          </div>
        )}
      </div>
    </nav>
  );
};

