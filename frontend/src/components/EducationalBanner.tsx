import React from "react";
import { AlertTriangle, ShieldCheck } from "lucide-react";

export const EducationalBanner: React.FC = () => {
  return (
    <div className="bg-amber-500 text-slate-950 px-4 py-2 text-center text-sm font-semibold tracking-wide flex items-center justify-center gap-2 shadow-md sticky top-0 z-50">
      <AlertTriangle className="w-4 h-4 text-slate-950 flex-shrink-0" />
      <span>
        Educational simulation. No real money is involved.
      </span>
      <span className="hidden md:inline-block opacity-80 text-xs font-normal border-l border-slate-950/30 pl-2">
        Virtual currency & test sandbox only • Server-verified provably fair engine
      </span>
    </div>
  );
};

