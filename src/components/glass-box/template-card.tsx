"use client";

import { GlassBoxCard } from "./glass-box-card";
import type { GlassBoxDecision } from "@/types/dashboard";

interface TemplateCardProps {
  decision: GlassBoxDecision;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
}

export function TemplateCard({ decision, onAccept, onReject }: TemplateCardProps) {
  return (
    <GlassBoxCard decision={decision} onAccept={onAccept} onReject={onReject}>
      {decision.details?.templateName && (
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[10px] bg-purple-400/10 text-purple-400 border border-purple-400/30 rounded-full px-2 py-0.5">
            Template
          </span>
          <span className="text-xs text-slate-300">{decision.details.templateName}</span>
        </div>
      )}
    </GlassBoxCard>
  );
}
