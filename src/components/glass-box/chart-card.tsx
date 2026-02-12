"use client";

import { GlassBoxCard } from "./glass-box-card";
import type { GlassBoxDecision } from "@/types/dashboard";

interface ChartCardProps {
  decision: GlassBoxDecision;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

export function ChartCard({ decision, onAccept, onReject }: ChartCardProps) {
  const d = decision.details;

  return (
    <GlassBoxCard decision={decision} onAccept={onAccept} onReject={onReject}>
      {d && (
        <div className="space-y-2 text-xs">
          {/* L1: Chart type + columns used */}
          <div className="flex items-center gap-2 flex-wrap">
            {d.chartType && (
              <span className="bg-[#2563eb]/10 text-[#2563eb] px-2 py-0.5 rounded text-[10px] font-medium">
                {d.chartType}
              </span>
            )}
            {d.columns?.map((col: string) => (
              <span key={col} className="font-mono bg-[#0f1729] px-1.5 py-0.5 rounded text-[10px] text-slate-400">
                {col}
              </span>
            ))}
          </div>

          {/* L1: Column profile */}
          {d.columnProfile && (
            <div className="grid grid-cols-2 gap-2">
              {d.columnProfile.map((cp: { name: string; type: string; distinct: number }) => (
                <div key={cp.name} className="bg-[#0f1729] rounded px-2 py-1.5">
                  <p className="text-[10px] text-slate-500">{cp.name}</p>
                  <p className="text-slate-300 text-[10px]">{cp.type} ({cp.distinct} unique)</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </GlassBoxCard>
  );
}
