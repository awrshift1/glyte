"use client";

import { useState, type ReactNode } from "react";
import { Check, X, Pencil, ChevronDown, ChevronRight } from "lucide-react";
import { ConfidenceBadge } from "./confidence-badge";
import type { GlassBoxDecision } from "@/types/dashboard";

interface GlassBoxCardProps {
  decision: GlassBoxDecision;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onEdit?: (id: string, changes: Partial<GlassBoxDecision>) => void;
  children: ReactNode;
}

export function GlassBoxCard(props: GlassBoxCardProps) {
  const { decision, onAccept, onReject, onEdit } = props;
  const childContent: ReactNode = props.children;
  const [expanded, setExpanded] = useState(false);
  const [detailLevel, setDetailLevel] = useState(0); // L0=collapsed, L1=explanation, L2=SQL, L3=raw

  const isResolved = decision.status !== "pending";

  return (
    <div className={`rounded-lg border transition-colors ${
      isResolved
        ? decision.status === "accepted"
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-red-500/30 bg-red-500/5 opacity-60"
        : "border-[#334155] bg-[#1e293b]"
    }`}>
      {/* L0: Header — always visible */}
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-slate-400 hover:text-white shrink-0"
          >
            {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <ConfidenceBadge confidence={decision.confidence} />
          <span className="text-xs text-slate-300 truncate">{decision.reason}</span>
        </div>

        {!isResolved && (
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              onClick={() => onAccept(decision.id)}
              className="p-1 rounded hover:bg-emerald-500/20 text-emerald-400 transition-colors"
              title="Accept"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onReject(decision.id)}
              className="p-1 rounded hover:bg-red-500/20 text-red-400 transition-colors"
              title="Reject"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            {onEdit && (
              <button
                onClick={() => setExpanded(true)}
                className="p-1 rounded hover:bg-[#2563eb]/20 text-[#2563eb] transition-colors"
                title="Edit"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        )}

        {isResolved && (
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            decision.status === "accepted" ? "bg-emerald-500/20 text-emerald-400" : "bg-red-500/20 text-red-400"
          }`}>
            {decision.status === "accepted" ? "Accepted" : "Rejected"}
          </span>
        )}
      </div>

      {/* L1+: Expanded content */}
      {expanded && (
        <div className="px-3 pb-3 border-t border-[#334155]/50">
          {/* Detail level tabs */}
          <div className="flex items-center gap-1 py-2">
            {["Details", "SQL", "Raw Data"].map((label, i) => (
              <button
                key={label}
                onClick={() => setDetailLevel(i + 1)}
                className={`text-[10px] px-2 py-0.5 rounded ${
                  detailLevel === i + 1
                    ? "bg-[#2563eb]/20 text-[#2563eb]"
                    : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Render children (card-specific content based on detailLevel) */}
          {childContent as any}

          {/* L1: Details — shown in children */}
          {detailLevel >= 2 && decision.details?.sql && (
            <div className="mt-2">
              <p className="text-[10px] text-slate-500 mb-1">Detection Query</p>
              <pre className="text-[10px] bg-[#0f1729] rounded p-2 text-slate-400 overflow-x-auto">
                {decision.details.sql}
              </pre>
            </div>
          )}

          {detailLevel >= 3 && decision.details?.rawData && (
            <div className="mt-2">
              <p className="text-[10px] text-slate-500 mb-1">Sample Values</p>
              <pre className="text-[10px] bg-[#0f1729] rounded p-2 text-slate-400 overflow-x-auto max-h-32 overflow-y-auto">
                {JSON.stringify(decision.details.rawData, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
