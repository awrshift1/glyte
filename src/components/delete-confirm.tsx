"use client";

import { useState } from "react";
import { AlertTriangle, X, Trash2 } from "lucide-react";

interface DeleteConfirmProps {
  dashboardTitle: string;
  chartCount: number;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

export function DeleteConfirm({ dashboardTitle, chartCount, onConfirm, onCancel, loading }: DeleteConfirmProps) {
  const [typed, setTyped] = useState("");
  const canDelete = typed === dashboardTitle;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl w-full max-w-md mx-4 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-[#ef4444]" />
            <h2 className="text-white font-semibold">Delete Dashboard</h2>
          </div>
          <button onClick={onCancel} className="text-[#94a3b8] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          <p className="text-sm text-[#94a3b8]">
            This will permanently delete <span className="text-white font-medium">{dashboardTitle}</span> and all its data.
          </p>

          <div className="bg-[#ef4444]/10 border border-[#ef4444]/20 rounded-lg p-3">
            <p className="text-xs text-[#ef4444]">
              {chartCount} chart{chartCount !== 1 ? "s" : ""} will be removed. The underlying DuckDB table will be dropped.
            </p>
          </div>

          <div>
            <label className="block text-xs text-[#94a3b8] mb-1.5">
              Type <span className="text-white font-medium">{dashboardTitle}</span> to confirm
            </label>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={dashboardTitle}
              className="w-full bg-[#0f1729] border border-[#334155] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#94a3b8]/40 outline-none focus:border-[#ef4444] transition-colors"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3 border-t border-[#334155] px-6 py-4">
          <button
            onClick={onConfirm}
            disabled={!canDelete || loading}
            className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#ef4444] px-4 py-2.5 text-sm font-medium text-white hover:bg-[#dc2626] disabled:opacity-30 transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete Dashboard
          </button>
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 rounded-lg border border-[#334155] px-4 py-2.5 text-sm text-[#94a3b8] hover:text-white disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
