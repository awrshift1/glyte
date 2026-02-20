"use client";

import { Download } from "lucide-react";

export interface EnrichmentStatus {
  label: string;
  count: number;
  color: string;
  filterQuery?: string;
}

interface EnrichmentBoardProps {
  statuses: EnrichmentStatus[];
  total: number;
  tableName: string;
}

export function EnrichmentBoard({
  statuses,
  total,
  tableName,
}: EnrichmentBoardProps) {
  if (!statuses || statuses.length === 0) return null;

  return (
    <div className="grid grid-cols-4 gap-3">
      {statuses.map((status) => {
        const percentage =
          total > 0 ? ((status.count / total) * 100).toFixed(1) : "0";
        return (
          <div
            key={status.label}
            className="bg-[#1e293b] border border-[#334155] rounded-lg p-4 flex flex-col items-center gap-2"
          >
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: status.color }}
            />
            <span className="text-xs text-[#94a3b8] font-medium">
              {status.label}
            </span>
            <span className="text-2xl font-bold text-white">
              {status.count.toLocaleString()}
            </span>
            <span className="text-[11px] text-[#64748b]">{percentage}%</span>
            {status.filterQuery && (
              <a
                href={`/api/export?table=${encodeURIComponent(tableName)}&filter=${encodeURIComponent(status.filterQuery)}`}
                download
                className="flex items-center gap-1 mt-1 text-[10px] text-[#2563eb] hover:text-[#3b82f6] transition-colors"
              >
                <Download className="h-3 w-3" />
                Export
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
