"use client";

import { useState, useEffect } from "react";
import { Clock, X } from "lucide-react";
import type { VersionEntry } from "@/types/dashboard";

interface VersionHistoryProps {
  dashboardId: string;
  open: boolean;
  onClose: () => void;
}

interface VersionItem extends VersionEntry {
  current?: boolean;
}

export function VersionHistory({ dashboardId, open, onClose }: VersionHistoryProps) {
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch(`/api/dashboard/${dashboardId}/versions`)
      .then((r) => r.json())
      .then((d) => setVersions(d.versions ?? []))
      .finally(() => setLoading(false));
  }, [open, dashboardId]);

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1" onClick={onClose} />

      {/* Panel */}
      <div className="w-80 bg-[#1e293b] border-l border-[#334155] shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] px-4 py-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-[#2563eb]" />
            <span className="text-sm font-semibold text-white">Version History</span>
          </div>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <p className="text-xs text-[#94a3b8] text-center pt-8">Loading...</p>
          ) : versions.length === 0 ? (
            <p className="text-xs text-[#94a3b8] text-center pt-8">No version history yet</p>
          ) : (
            <div className="space-y-0">
              {versions.map((v, i) => (
                <div key={i} className="relative pl-6 pb-6">
                  {/* Timeline line */}
                  {i < versions.length - 1 && (
                    <div className="absolute left-[9px] top-4 bottom-0 w-px bg-[#334155]" />
                  )}
                  {/* Timeline dot */}
                  <div className={`absolute left-0 top-1 w-[18px] h-[18px] rounded-full border-2 ${
                    v.current
                      ? "bg-[#2563eb] border-[#2563eb]"
                      : "bg-[#0f1729] border-[#334155]"
                  }`} />

                  <div className="bg-[#0f1729] border border-[#334155] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-white">
                        v{v.version}{v.current ? " (current)" : ""}
                      </span>
                      <span className="text-[10px] text-[#94a3b8]">
                        {new Date(v.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex gap-3 text-[10px] text-[#94a3b8]">
                      <span>{v.rowCount.toLocaleString()} rows</span>
                      <span>{v.columnCount} cols</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
