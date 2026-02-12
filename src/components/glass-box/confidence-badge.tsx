"use client";

interface ConfidenceBadgeProps {
  confidence: number;
  size?: "sm" | "md";
}

function getLevel(confidence: number): { label: string; color: string; bg: string; border: string } {
  if (confidence >= 0.7) return { label: "High", color: "text-emerald-400", bg: "bg-emerald-400/10", border: "border-emerald-400/30" };
  if (confidence >= 0.4) return { label: "Medium", color: "text-amber-400", bg: "bg-amber-400/10", border: "border-amber-400/30" };
  return { label: "Low", color: "text-red-400", bg: "bg-red-400/10", border: "border-red-400/30" };
}

export function ConfidenceBadge({ confidence, size = "sm" }: ConfidenceBadgeProps) {
  const { label, color, bg, border } = getLevel(confidence);
  const pct = Math.round(confidence * 100);

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border ${bg} ${border} ${color} ${
      size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs"
    } font-medium`}>
      <span className={`w-1.5 h-1.5 rounded-full ${
        confidence >= 0.7 ? "bg-emerald-400" : confidence >= 0.4 ? "bg-amber-400" : "bg-red-400"
      }`} />
      {pct}% {label}
    </span>
  );
}
