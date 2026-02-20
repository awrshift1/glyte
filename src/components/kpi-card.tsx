"use client";

interface KpiCardProps {
  title: string;
  value: number;
}

export function KpiCard({ title, value }: KpiCardProps) {
  const formatted = formatValue(title, value);

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-5">
      <p className="text-sm text-gray-400 mb-1">{title}</p>
      <p className="text-2xl font-bold text-white">{formatted}</p>
    </div>
  );
}

function formatValue(title: string, value: number): string {
  const t = title.toLowerCase();
  if (/rate|percent|%|ratio|coverage/.test(t)) {
    return `${value % 1 === 0 ? value : value.toFixed(1)}%`;
  }
  if (/revenue|spend|cost|price|amount|budget/.test(t)) {
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  }
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString();
}
