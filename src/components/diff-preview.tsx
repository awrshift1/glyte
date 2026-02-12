"use client";

import { ArrowUpDown, Plus, Minus, X, RefreshCw, FileSpreadsheet } from "lucide-react";
import type { DiffSummary } from "@/types/dashboard";

interface DiffPreviewProps {
  diff: DiffSummary;
  originalName: string;
  tempPath: string;
  onReplace: () => void;
  onNew: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function DiffPreview({ diff, originalName, tempPath: _tempPath, onReplace, onNew, onCancel, loading }: DiffPreviewProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl w-full max-w-lg mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4">
          <div className="flex items-center gap-3">
            <ArrowUpDown className="h-5 w-5 text-[#2563eb]" />
            <div>
              <h2 className="text-white font-semibold">Data Match Found</h2>
              <p className="text-xs text-[#94a3b8]">{originalName}</p>
            </div>
          </div>
          <button onClick={onCancel} className="text-[#94a3b8] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <div className="bg-[#0f1729] rounded-lg p-4 border border-[#334155]">
            <p className="text-sm text-[#94a3b8] mb-1">Matches existing dashboard</p>
            <p className="text-white font-medium">{diff.matchedDashboard}</p>
            <p className="text-xs text-[#94a3b8] mt-1">{diff.overlapPercent}% column overlap</p>
          </div>

          {/* Diff stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#0f1729] rounded-lg p-3 border border-[#334155] text-center">
              <p className="text-2xl font-bold text-white">
                {diff.rowDelta >= 0 ? "+" : ""}{diff.rowDelta.toLocaleString()}
              </p>
              <p className="text-xs text-[#94a3b8]">row change</p>
            </div>
            <div className="bg-[#0f1729] rounded-lg p-3 border border-[#334155] text-center">
              <p className="text-2xl font-bold text-[#22c55e]">
                {diff.addedColumns.length > 0 ? `+${diff.addedColumns.length}` : "0"}
              </p>
              <p className="text-xs text-[#94a3b8]">new columns</p>
            </div>
            <div className="bg-[#0f1729] rounded-lg p-3 border border-[#334155] text-center">
              <p className="text-2xl font-bold text-[#ef4444]">
                {diff.removedColumns.length > 0 ? `-${diff.removedColumns.length}` : "0"}
              </p>
              <p className="text-xs text-[#94a3b8]">removed cols</p>
            </div>
          </div>

          {/* Column changes */}
          {diff.addedColumns.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {diff.addedColumns.map((col) => (
                <span key={col} className="flex items-center gap-1 rounded-full bg-[#22c55e]/10 border border-[#22c55e]/30 px-2 py-0.5 text-xs text-[#22c55e]">
                  <Plus className="h-2.5 w-2.5" />{col}
                </span>
              ))}
            </div>
          )}
          {diff.removedColumns.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {diff.removedColumns.map((col) => (
                <span key={col} className="flex items-center gap-1 rounded-full bg-[#ef4444]/10 border border-[#ef4444]/30 px-2 py-0.5 text-xs text-[#ef4444]">
                  <Minus className="h-2.5 w-2.5" />{col}
                </span>
              ))}
            </div>
          )}

          <div className="text-xs text-[#94a3b8]">
            {diff.newRowCount.toLocaleString()} rows &rarr; replaces {diff.oldRowCount.toLocaleString()} rows
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-[#334155] px-6 py-4">
          <button
            onClick={onReplace}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-50 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Replace
          </button>
          <button
            onClick={onNew}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-[#334155] px-4 py-2.5 text-sm font-medium text-[#94a3b8] hover:border-[#2563eb] hover:text-white disabled:opacity-50 transition-colors"
          >
            <FileSpreadsheet className="h-4 w-4" />
            New Dashboard
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-[#334155] px-4 py-2.5 text-sm text-[#94a3b8] hover:text-white disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
