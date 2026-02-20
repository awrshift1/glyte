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
  const [showAll, setShowAll] = useState(false);

  if (decisions.length === 0) return null;

  const pending = decisions.filter((d) => d.status === "pending");
  const accepted = decisions.filter((d) => d.status === "accepted");
  const chartDecisions = decisions.filter((d) => d.type !== "relationship");
  const relDecisions = decisions.filter((d) => d.type === "relationship");
  const chartTypes = chartDecisions.reduce<Record<string, number>>((acc, d) => {
    const t = d.details?.chartType ?? d.type;
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {});
  const summary = Object.entries(chartTypes)
    .map(([type, count]) => `${count} ${type}`)
    .join(", ");

  // Show pending items first, then accepted only if showAll toggled
  const visibleDecisions = showAll ? decisions : pending;

  return (
    <div className="mb-4">
      {/* Compact narrative bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#1e293b]/60 border border-[#334155]/50 hover:border-[#334155] transition-colors text-left group"
      >
        <Eye className="h-3.5 w-3.5 text-[#2563eb] flex-shrink-0" />
        <span className="text-xs text-gray-400 flex-1">
          <span className="text-gray-300">AI generated {chartDecisions.length} visualizations</span>
          {relDecisions.length > 0 && <span className="text-gray-300">, {relDecisions.length} relationship{relDecisions.length > 1 ? "s" : ""}</span>}
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

      {/* Expanded detail cards */}
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

          {/* Pending decisions — always visible when expanded */}
          {pending.length > 0 ? (
            visibleDecisions.filter((d) => d.status === "pending").map((d) =>
              d.type === "relationship" ? (
                <RelationshipCard key={d.id} decision={d} onAccept={onAccept} onReject={onReject} />
              ) : (
                <ChartCard key={d.id} decision={d} onAccept={onAccept} onReject={onReject} />
              )
            )
          ) : (
            <p className="text-[11px] text-slate-500 px-1">All decisions accepted</p>
          )}

          {/* Toggle for accepted decisions */}
          {accepted.length > 0 && (
            <button
              onClick={() => setShowAll(!showAll)}
              className="text-[10px] text-slate-500 hover:text-slate-300 transition-colors px-1"
            >
              {showAll ? "Hide" : "Show"} {accepted.length} accepted decision{accepted.length > 1 ? "s" : ""}
            </button>
          )}

          {/* Accepted decisions — only when showAll */}
          {showAll && accepted.map((d) =>
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
