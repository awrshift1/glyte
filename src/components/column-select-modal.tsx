"use client";

import { useState } from "react";
import { Columns3, X } from "lucide-react";

interface ColumnSelectModalProps {
  tableName: string;
  rowCount: number;
  columns: string[];
  onDone: (excludedColumns: string[]) => void;
  onSkip: () => void;
  loading?: boolean;
}

export function ColumnSelectModal({
  tableName,
  rowCount,
  columns,
  onDone,
  onSkip,
  loading,
}: ColumnSelectModalProps) {
  const [includedCols, setIncludedCols] = useState<Set<string>>(
    () => new Set(columns)
  );

  const toggleColumn = (col: string) => {
    setIncludedCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  const selectAll = () => setIncludedCols(new Set(columns));
  const deselectAll = () => setIncludedCols(new Set());

  const excluded = columns.filter((c) => !includedCols.has(c));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Columns3 className="h-5 w-5 text-[#2563eb]" />
            <div>
              <h2 className="text-white font-semibold">Select Columns</h2>
              <p className="text-xs text-[#94a3b8]">
                {tableName} &middot; {rowCount.toLocaleString()} rows &middot;{" "}
                {columns.length} columns
              </p>
            </div>
          </div>
          <button onClick={onSkip} className="text-[#94a3b8] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
              Columns ({includedCols.size}/{columns.length} selected)
            </h3>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-[10px] text-[#2563eb] hover:underline"
              >
                Select all
              </button>
              <span className="text-[10px] text-[#475569]">/</span>
              <button
                onClick={deselectAll}
                className="text-[10px] text-[#2563eb] hover:underline"
              >
                Deselect all
              </button>
            </div>
          </div>
          <div className="bg-[#0f1729] border border-[#334155] rounded-lg p-3 space-y-1.5 max-h-[320px] overflow-y-auto">
            {columns.map((col) => (
              <button
                key={col}
                onClick={() => toggleColumn(col)}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-left hover:bg-[#1e293b] transition-colors"
              >
                <span
                  className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                    includedCols.has(col)
                      ? "border-[#2563eb] bg-[#2563eb] text-white"
                      : "border-[#475569]"
                  }`}
                >
                  {includedCols.has(col) && "\u2713"}
                </span>
                <span className="font-mono text-sm text-[#cbd5e1]">{col}</span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-[#64748b] mt-1.5">
            Unchecked columns are hidden from AI analysis and charts
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between border-t border-[#334155] px-6 py-4 flex-shrink-0">
          <button
            onClick={onSkip}
            className="text-sm text-[#94a3b8] hover:text-white transition-colors"
          >
            Skip (include all)
          </button>
          <button
            onClick={() => onDone(excluded)}
            disabled={loading || includedCols.size === 0}
            className="rounded-lg bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1d4ed8] transition-colors disabled:opacity-50"
          >
            {loading ? "Saving..." : `Continue with ${includedCols.size} columns`}
          </button>
        </div>
      </div>
    </div>
  );
}
