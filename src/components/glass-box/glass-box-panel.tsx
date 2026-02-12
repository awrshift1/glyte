"use client";

import { useState } from "react";
import { Eye, ChevronDown, ChevronRight } from "lucide-react";
import { ChartCard } from "./chart-card";
import { RelationshipCard } from "./relationship-card";
import type { GlassBoxDecision } from "@/types/dashboard";

interface GlassBoxPanelProps {
  decisions: GlassBoxDecision[];
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onAcceptAllHigh: () => void;
}

export function GlassBoxPanel({ decisions, onAccept, onReject, onAcceptAllHigh }: GlassBoxPanelProps) {
  const [expanded, setExpanded] = useState(false);

  if (decisions.length === 0) return null;

  const pending = decisions.filter((d) => d.status === "pending");
  const chartTypes = decisions.reduce<Record<string, number>>((acc, d) => {
    const t = d.details?.chartType ?? d.type;
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const summary = Object.entries(chartTypes)
    .map(([type, count]) => `${count} ${type}`)
    .join(", ");

  return (
    <div className="mb-4">
      {/* Compact narrative bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#1e293b]/60 border border-[#334155]/50 hover:border-[#334155] transition-colors text-left group"
      >
        <Eye className="h-3.5 w-3.5 text-[#2563eb] flex-shrink-0" />
        <span className="text-xs text-gray-400 flex-1">
          <span className="text-gray-300">AI generated {decisions.length} visualizations</span>
          {" — "}
          {summary}
          {pending.length > 0 && (
            <span className="text-amber-400 ml-1">({pending.length} need review)</span>
          )}
        </span>
        {expanded
          ? <ChevronDown className="h-3.5 w-3.5 text-gray-500" />
          : <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
        }
      </button>

      {/* Expanded detail cards (opt-in) */}
      {expanded && (
        <div className="mt-2 space-y-2">
          {pending.length > 1 && (
            <div className="flex justify-end mb-1">
              <button
                onClick={onAcceptAllHigh}
                className="text-[10px] text-emerald-400 hover:text-emerald-300 transition-colors"
              >
                Accept all pending ({pending.length})
              </button>
            </div>
          )}
          {decisions.map((d) =>
            d.type === "relationship" ? (
              <RelationshipCard key={d.id} decision={d} onAccept={onAccept} onReject={onReject} />
            ) : (
              <ChartCard key={d.id} decision={d} onAccept={onAccept} onReject={onReject} />
            )
          )}
        </div>
      )}
    </div>
  );
}
