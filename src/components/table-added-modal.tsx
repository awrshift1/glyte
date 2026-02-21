"use client";

import { useState } from "react";
import { Plus, X, Layers } from "lucide-react";
import type { SuggestedRelationship } from "@/lib/relationship-detector";
import type { SchemaCompatibility } from "@/types/dashboard";

export interface SuggestionWithId extends SuggestedRelationship {
  relationshipId?: string;
}

interface TableAddedModalProps {
  dashboardId: string;
  tableName: string;
  rowCount: number;
  columnCount: number;
  columns: string[];
  suggestions: SuggestionWithId[];
  onDone: (excludedColumns: string[], acceptedRelationshipIds: string[]) => void;
  onClose: () => void;
  schemaMatch?: SchemaCompatibility;
  primaryTableName?: string;
  onAppend?: () => void;
}

export function TableAddedModal({
  tableName,
  rowCount,
  columnCount,
  columns,
  suggestions,
  onDone,
  onClose,
  schemaMatch,
  primaryTableName,
  onAppend,
}: TableAddedModalProps) {
  const [includedCols, setIncludedCols] = useState<Set<string>>(
    () => new Set(columns)
  );
  const [selectedRels, setSelectedRels] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    suggestions.forEach((s, i) => {
      if (s.confidence >= 0.7) initial.add(i);
    });
    return initial;
  });

  const toggleColumn = (col: string) => {
    setIncludedCols((prev) => {
      const next = new Set(prev);
      if (next.has(col)) next.delete(col);
      else next.add(col);
      return next;
    });
  };

  const toggleRel = (idx: number) => {
    setSelectedRels((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleDone = () => {
    const excluded = columns.filter((c) => !includedCols.has(c));
    const acceptedIds = suggestions
      .filter((s, i) => selectedRels.has(i) && s.relationshipId)
      .map((s) => s.relationshipId!);
    onDone(excluded, acceptedIds);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Plus className="h-5 w-5 text-[#22c55e]" />
            <div>
              <h2 className="text-white font-semibold">Table Added</h2>
              <p className="text-xs text-[#94a3b8]">
                {tableName} &middot; {rowCount} rows &middot; {columnCount} columns
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* Append option */}
          {schemaMatch?.compatible && primaryTableName && onAppend && (
            <div className="bg-[#0f1729] border border-[#2563eb]/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Layers className="h-4 w-4 text-[#2563eb]" />
                <span className="text-sm font-medium text-[#cbd5e1]">
                  {schemaMatch.overlapPercent}% columns match primary table
                </span>
              </div>
              {schemaMatch.columnMapping && Object.keys(schemaMatch.columnMapping).length > 0 && (
                <p className="text-[10px] text-[#22c55e]/70 mb-1">
                  Mapped: {Object.entries(schemaMatch.columnMapping).map(([s, t]) => `${s} \u2192 ${t}`).join(", ")}
                </p>
              )}
              {schemaMatch.missingInTarget.length > 0 && (
                <p className="text-[10px] text-[#64748b] mb-3">
                  Unmapped: {schemaMatch.missingInTarget.join(", ")} (filled with NULL)
                </p>
              )}
              <div className="flex gap-2">
                <button
                  onClick={onAppend}
                  className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] transition-colors"
                >
                  Append to &ldquo;{primaryTableName.length > 25 ? primaryTableName.slice(0, 25) + "..." : primaryTableName}&rdquo;
                </button>
                <button
                  onClick={() => {/* just continue to columns below */}}
                  className="rounded-lg border border-[#334155] px-4 py-2 text-sm font-medium text-[#94a3b8] hover:text-white hover:border-[#475569] transition-colors"
                >
                  Keep separate
                </button>
              </div>
            </div>
          )}

          {/* Columns */}
          <div>
            <h3 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">
              Columns
            </h3>
            <div className="bg-[#0f1729] border border-[#334155] rounded-lg p-3 space-y-1.5 max-h-[200px] overflow-y-auto">
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
              Unchecked columns hidden from AI analysis
            </p>
          </div>

          {/* Relationship suggestions */}
          {suggestions.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider mb-3">
                Matching Columns
              </h3>
              <div className="bg-[#0f1729] border border-[#334155] rounded-lg p-3 space-y-1.5">
                {suggestions.map((s, i) => (
                  <button
                    key={`${s.fromTable}.${s.fromColumn}-${s.toTable}.${s.toColumn}`}
                    onClick={() => toggleRel(i)}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded text-left hover:bg-[#1e293b] transition-colors"
                  >
                    <span
                      className={`flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center text-[10px] ${
                        selectedRels.has(i)
                          ? "border-[#2563eb] bg-[#2563eb] text-white"
                          : "border-[#475569]"
                      }`}
                    >
                      {selectedRels.has(i) && "\u2713"}
                    </span>
                    <div className="flex-1 min-w-0 flex items-center gap-2 text-sm">
                      <span className="font-mono text-[#cbd5e1] truncate">
                        {s.fromColumn}
                      </span>
                      <span className="text-[#475569]">{"\u2194"}</span>
                      <span className="font-mono text-[#cbd5e1] truncate">
                        {s.toColumn}
                      </span>
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        s.confidence >= 0.8
                          ? "text-[#22c55e]"
                          : s.confidence >= 0.6
                            ? "text-[#eab308]"
                            : "text-[#94a3b8]"
                      }`}
                    >
                      {Math.round(s.confidence * 100)}%
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-[#64748b] mt-1.5">
                Linked columns let AI answer across tables
              </p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end border-t border-[#334155] px-6 py-4 flex-shrink-0">
          <button
            onClick={handleDone}
            className="rounded-lg bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1d4ed8] transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
