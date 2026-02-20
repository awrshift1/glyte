"use client";

import { useState, useCallback } from "react";
import { Download } from "lucide-react";

export interface EnrichmentStatus {
  label: string;
  count: number;
  color: string;
  presetId?: string;
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
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleExport = useCallback(async (presetId: string) => {
    setDownloading(presetId);
    try {
      const res = await fetch("/api/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: tableName, preset: presetId }),
      });
      if (!res.ok) return;
      const blob = await res.blob();
      const filename = res.headers.get("X-Filename") || `${tableName}_export.csv`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Export failed:", e);
    } finally {
      setDownloading(null);
    }
  }, [tableName]);

  if (!statuses || statuses.length === 0) return null;

  return (
    <div className="grid grid-cols-4 gap-3">
      {statuses.map((status) => {
        const percentage =
          total > 0 ? ((status.count / total) * 100).toFixed(1) : "0";
        const isEmpty = status.count === 0;
        return (
          <div
            key={status.label}
            className={`bg-[#1e293b] border border-[#334155] rounded-lg p-4 flex flex-col items-center gap-2 ${isEmpty ? "opacity-50" : ""}`}
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
            {status.presetId && !isEmpty && (
              <button
                onClick={() => handleExport(status.presetId!)}
                disabled={downloading === status.presetId}
                className="flex items-center gap-1 mt-1 text-[10px] text-[#2563eb] hover:text-[#3b82f6] transition-colors disabled:opacity-50"
              >
                <Download className="h-3 w-3" />
                {downloading === status.presetId ? "..." : "Export"}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
