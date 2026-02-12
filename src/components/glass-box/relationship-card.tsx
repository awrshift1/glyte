"use client";

import { GlassBoxCard } from "./glass-box-card";
import type { GlassBoxDecision } from "@/types/dashboard";

interface RelationshipCardProps {
  decision: GlassBoxDecision;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

export function RelationshipCard({ decision, onAccept, onReject }: RelationshipCardProps) {
  const d = decision.details;

  return (
    <GlassBoxCard decision={decision} onAccept={onAccept} onReject={onReject}>
      {d && (
        <div className="space-y-2 text-xs">
          {/* L1: Source badge + Relationship overview */}
          <div className="flex items-center gap-2 text-slate-300">
            {d.source === "ai-suggested" ? (
              <span className="text-[9px] bg-purple-400/10 text-purple-400 border border-purple-400/30 rounded-full px-1.5 py-0.5">AI</span>
            ) : (
              <span className="text-[9px] bg-slate-400/10 text-slate-400 border border-slate-400/30 rounded-full px-1.5 py-0.5">Auto</span>
            )}
            <span className="font-mono bg-[#0f1729] px-1.5 py-0.5 rounded text-[11px]">
              {d.fromTable}.{d.fromColumn}
            </span>
            <span className="text-slate-500">{d.cardinality === "one-to-many" ? "1→N" : d.cardinality === "one-to-one" ? "1→1" : "N→N"}</span>
            <span className="font-mono bg-[#0f1729] px-1.5 py-0.5 rounded text-[11px]">
              {d.toTable}.{d.toColumn}
            </span>
          </div>

          {/* L1: Stats */}
          <div className="grid grid-cols-3 gap-2">
            {d.nameSimilarity !== undefined && (
              <div className="bg-[#0f1729] rounded px-2 py-1.5">
                <p className="text-[10px] text-slate-500">Name Match</p>
                <p className="text-slate-300 font-medium">{Math.round(d.nameSimilarity * 100)}%</p>
              </div>
            )}
            {d.valueOverlap !== undefined && (
              <div className="bg-[#0f1729] rounded px-2 py-1.5">
                <p className="text-[10px] text-slate-500">Value Overlap</p>
                <p className="text-slate-300 font-medium">{Math.round(d.valueOverlap * 100)}%</p>
              </div>
            )}
            {d.sampleMatches !== undefined && (
              <div className="bg-[#0f1729] rounded px-2 py-1.5">
                <p className="text-[10px] text-slate-500">Samples</p>
                <p className="text-slate-300 font-medium">{d.sampleMatches}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </GlassBoxCard>
  );
}
