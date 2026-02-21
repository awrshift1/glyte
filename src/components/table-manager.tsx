"use client";

import { useState, useEffect, useCallback } from "react";
import { Database, Trash2, X, ChevronDown, ChevronRight, Unlink, Plus } from "lucide-react";
import type { DashboardConfig, TableEntry } from "@/types/dashboard";

interface StoredRelationship {
  id: string;
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
  type: string;
  status: string;
}

interface TableManagerProps {
  dashboardId: string;
  config: DashboardConfig;
  onUpdate: () => void;
  onClose: () => void;
}

export function TableManager({ dashboardId, config, onUpdate, onClose }: TableManagerProps) {
  const [expandedTables, setExpandedTables] = useState<Set<string>>(new Set());
  const [tableColumns, setTableColumns] = useState<Record<string, string[]>>({});
  const [relationships, setRelationships] = useState<StoredRelationship[]>([]);
  const [excludedMap, setExcludedMap] = useState<Record<string, Set<string>>>({});
  const [loading, setLoading] = useState(false);
  const [showAddRelationship, setShowAddRelationship] = useState(false);

  const tables = config.tables ?? [];
  const allTableNames = [config.tableName, ...tables.map((t) => t.tableName)];

  // Initialize excludedMap from config (primary + secondary)
  useEffect(() => {
    const map: Record<string, Set<string>> = {};
    map[config.tableName] = new Set(config.excludedColumns ?? []);
    for (const t of tables) {
      map[t.tableName] = new Set(t.excludedColumns ?? []);
    }
    setExcludedMap(map);
  }, [config.tableName, config.excludedColumns, config.tables]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch relationships
  useEffect(() => {
    fetch(`/api/dashboard/${dashboardId}/relationships`)
      .then((r) => r.json())
      .then((d) => {
        if (d.relationships) {
          setRelationships(
            d.relationships.filter((r: StoredRelationship) => r.status === "accepted")
          );
        }
      })
      .catch((e) => { console.error("Failed to fetch relationships:", e); });
  }, [dashboardId]);

  const fetchColumns = useCallback(async (tableName: string) => {
    if (tableColumns[tableName]) return;
    try {
      const res = await fetch(`/api/columns?table=${encodeURIComponent(tableName)}`);
      const d = await res.json();
      if (d.columns) {
        setTableColumns((prev) => ({ ...prev, [tableName]: d.columns }));
      }
    } catch (e) {
      console.error("Failed to fetch columns:", e);
    }
  }, [tableColumns]);

  const toggleExpand = (tableName: string) => {
    setExpandedTables((prev) => {
      const next = new Set(prev);
      if (next.has(tableName)) {
        next.delete(tableName);
      } else {
        next.add(tableName);
        fetchColumns(tableName);
      }
      return next;
    });
  };

  const toggleColumn = async (tableName: string, col: string) => {
    const excluded = new Set(excludedMap[tableName] ?? []);
    if (excluded.has(col)) excluded.delete(col);
    else excluded.add(col);

    setExcludedMap((prev) => ({ ...prev, [tableName]: excluded }));

    try {
      await fetch(`/api/dashboard/${dashboardId}/tables`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName,
          excludedColumns: Array.from(excluded),
        }),
      });
      onUpdate();
    } catch (e) {
      console.error("Failed to toggle column exclusion:", e);
    }
  };

  const handleDeleteTable = async (tableName: string) => {
    setLoading(true);
    try {
      await fetch(`/api/dashboard/${dashboardId}/tables`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tableName }),
      });
      onUpdate();
    } catch (e) {
      console.error("Failed to delete table:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveRelationship = async (relId: string) => {
    try {
      await fetch(`/api/dashboard/${dashboardId}/relationships`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationshipId: relId }),
      });
      setRelationships((prev) => prev.filter((r) => r.id !== relId));
      onUpdate();
    } catch (e) {
      console.error("Failed to remove relationship:", e);
    }
  };

  const handleAddRelationship = async (
    fromTable: string,
    fromColumn: string,
    toTable: string,
    toColumn: string,
  ) => {
    try {
      const res = await fetch(`/api/dashboard/${dashboardId}/relationships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromTable,
          fromColumn,
          toTable,
          toColumn,
          type: "one-to-many",
          confidence: 1.0,
          source: "manual",
          status: "accepted",
        }),
      });
      const d = await res.json();
      if (d.relationship) {
        setRelationships((prev) => [...prev, {
          id: d.relationship.id,
          from_table: fromTable,
          from_column: fromColumn,
          to_table: toTable,
          to_column: toColumn,
          type: "one-to-many",
          status: "accepted",
        }]);
      }
      setShowAddRelationship(false);
      onUpdate();
    } catch (e) {
      console.error("Failed to add relationship:", e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl w-full max-w-2xl mx-4 shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-[#2563eb]" />
            <h2 className="text-white font-semibold">Table Manager</h2>
          </div>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          {/* Primary table — expandable */}
          <ExpandableTable
            tableName={config.tableName}
            label="primary"
            rowCount={config.rowCount}
            columnCount={config.columnCount}
            expanded={expandedTables.has(config.tableName)}
            columns={tableColumns[config.tableName]}
            excluded={excludedMap[config.tableName] ?? new Set()}
            onToggleExpand={() => toggleExpand(config.tableName)}
            onToggleColumn={(col) => toggleColumn(config.tableName, col)}
          />

          {/* Secondary tables */}
          {tables.map((t) => (
            <ExpandableTable
              key={t.tableName}
              tableName={t.tableName}
              rowCount={t.rowCount}
              columnCount={t.columnCount}
              expanded={expandedTables.has(t.tableName)}
              columns={tableColumns[t.tableName]}
              excluded={excludedMap[t.tableName] ?? new Set()}
              loading={loading}
              onToggleExpand={() => toggleExpand(t.tableName)}
              onToggleColumn={(col) => toggleColumn(t.tableName, col)}
              onDelete={() => handleDeleteTable(t.tableName)}
            />
          ))}

          {tables.length === 0 && (
            <p className="text-sm text-[#64748b] text-center py-4">
              No additional tables. Use &quot;Add CSV&quot; to add more.
            </p>
          )}

          {/* Relationships */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
                Linked Columns
              </h3>
              {allTableNames.length >= 2 && (
                <button
                  onClick={() => setShowAddRelationship(true)}
                  className="flex items-center gap-1 text-xs text-[#2563eb] hover:text-[#60a5fa] transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Add link
                </button>
              )}
            </div>

            {relationships.length > 0 ? (
              <div className="space-y-2">
                {relationships.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between bg-[#0f1729] border border-[#334155] rounded-lg px-4 py-2.5"
                  >
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono text-[#cbd5e1]">
                        {r.from_table}.{r.from_column}
                      </span>
                      <span className="text-[#475569]">{"\u2194"}</span>
                      <span className="font-mono text-[#cbd5e1]">
                        {r.to_table}.{r.to_column}
                      </span>
                    </div>
                    <button
                      onClick={() => handleRemoveRelationship(r.id)}
                      className="text-[#94a3b8] hover:text-[#ef4444] transition-colors"
                      title="Remove link"
                    >
                      <Unlink className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#64748b]">
                No linked columns. Links let AI answer questions across tables using JOINs.
              </p>
            )}
          </div>

          {/* Add relationship form */}
          {showAddRelationship && (
            <AddRelationshipForm
              allTableNames={allTableNames}
              tableColumns={tableColumns}
              fetchColumns={fetchColumns}
              onAdd={handleAddRelationship}
              onCancel={() => setShowAddRelationship(false)}
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-end border-t border-[#334155] px-6 py-4 flex-shrink-0">
          <button
            onClick={onClose}
            className="rounded-lg bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#1d4ed8] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Expandable Table Row ─── */

function ExpandableTable({
  tableName,
  label,
  rowCount,
  columnCount,
  expanded,
  columns,
  excluded,
  loading,
  onToggleExpand,
  onToggleColumn,
  onDelete,
}: {
  tableName: string;
  label?: string;
  rowCount: number;
  columnCount: number;
  expanded: boolean;
  columns: string[] | undefined;
  excluded: Set<string>;
  loading?: boolean;
  onToggleExpand: () => void;
  onToggleColumn: (col: string) => void;
  onDelete?: () => void;
}) {
  return (
    <div className="bg-[#0f1729] border border-[#334155] rounded-lg overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <button
          onClick={onToggleExpand}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
        >
          {expanded ? (
            <ChevronDown className="h-3.5 w-3.5 text-[#94a3b8] flex-shrink-0" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-[#94a3b8] flex-shrink-0" />
          )}
          <span className="text-sm font-medium text-[#cbd5e1] truncate">
            {tableName}
          </span>
          {label && (
            <span className="text-[10px] bg-[#2563eb]/20 text-[#2563eb] rounded px-1.5 py-0.5 flex-shrink-0">
              {label}
            </span>
          )}
          <span className="text-xs text-[#64748b] flex-shrink-0">
            {rowCount} rows &middot; {columnCount} col
          </span>
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            disabled={loading}
            className="text-[#94a3b8] hover:text-[#ef4444] transition-colors disabled:opacity-50 ml-2"
            title="Delete table"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {expanded && columns && (
        <div className="border-t border-[#334155] px-4 py-3">
          <div className="flex flex-wrap gap-1.5">
            {columns.map((col) => {
              const isExcluded = excluded.has(col);
              return (
                <button
                  key={col}
                  onClick={() => onToggleColumn(col)}
                  className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors ${
                    isExcluded
                      ? "bg-[#1e293b] text-[#64748b] border border-[#334155]"
                      : "bg-[#2563eb]/10 text-[#93c5fd] border border-[#2563eb]/30"
                  }`}
                >
                  <span
                    className={`w-3 h-3 rounded-sm border flex items-center justify-center text-[8px] ${
                      isExcluded
                        ? "border-[#475569]"
                        : "border-[#2563eb] bg-[#2563eb] text-white"
                    }`}
                  >
                    {!isExcluded && "\u2713"}
                  </span>
                  {col}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-[#64748b] mt-2">
            Click to toggle column visibility for AI
          </p>
        </div>
      )}

      {expanded && !columns && (
        <div className="border-t border-[#334155] px-4 py-3">
          <p className="text-xs text-[#64748b]">Loading columns...</p>
        </div>
      )}
    </div>
  );
}

/* ─── Add Relationship Form ─── */

function AddRelationshipForm({
  allTableNames,
  tableColumns,
  fetchColumns,
  onAdd,
  onCancel,
}: {
  allTableNames: string[];
  tableColumns: Record<string, string[]>;
  fetchColumns: (name: string) => void;
  onAdd: (fromTable: string, fromColumn: string, toTable: string, toColumn: string) => void;
  onCancel: () => void;
}) {
  const [fromTable, setFromTable] = useState(allTableNames[0] ?? "");
  const [toTable, setToTable] = useState(allTableNames[1] ?? "");
  const [fromColumn, setFromColumn] = useState("");
  const [toColumn, setToColumn] = useState("");

  useEffect(() => {
    if (fromTable) fetchColumns(fromTable);
  }, [fromTable, fetchColumns]);

  useEffect(() => {
    if (toTable) fetchColumns(toTable);
  }, [toTable, fetchColumns]);

  const fromCols = tableColumns[fromTable] ?? [];
  const toCols = tableColumns[toTable] ?? [];
  const canSubmit = fromTable && toTable && fromColumn && toColumn && fromTable !== toTable;

  const selectClass =
    "bg-[#0f1729] border border-[#334155] rounded-lg px-3 py-2 text-sm text-[#cbd5e1] w-full focus:outline-none focus:border-[#2563eb]";

  return (
    <div className="bg-[#0f1729] border border-[#2563eb]/30 rounded-lg p-4 space-y-3">
      <h4 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wider">
        Add Link
      </h4>

      <div className="grid grid-cols-2 gap-3">
        {/* From */}
        <div className="space-y-2">
          <label className="text-[10px] text-[#64748b] uppercase">From table</label>
          <select
            value={fromTable}
            onChange={(e) => { setFromTable(e.target.value); setFromColumn(""); }}
            className={selectClass}
          >
            {allTableNames.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label className="text-[10px] text-[#64748b] uppercase">Column</label>
          <select
            value={fromColumn}
            onChange={(e) => setFromColumn(e.target.value)}
            className={selectClass}
          >
            <option value="">Select column...</option>
            {fromCols.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* To */}
        <div className="space-y-2">
          <label className="text-[10px] text-[#64748b] uppercase">To table</label>
          <select
            value={toTable}
            onChange={(e) => { setToTable(e.target.value); setToColumn(""); }}
            className={selectClass}
          >
            {allTableNames.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <label className="text-[10px] text-[#64748b] uppercase">Column</label>
          <select
            value={toColumn}
            onChange={(e) => setToColumn(e.target.value)}
            className={selectClass}
          >
            <option value="">Select column...</option>
            {toCols.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex gap-2 justify-end pt-1">
        <button
          onClick={onCancel}
          className="rounded-lg border border-[#334155] px-3 py-1.5 text-xs text-[#94a3b8] hover:text-white transition-colors"
        >
          Cancel
        </button>
        <button
          onClick={() => canSubmit && onAdd(fromTable, fromColumn, toTable, toColumn)}
          disabled={!canSubmit}
          className="rounded-lg bg-[#2563eb] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-40 transition-colors"
        >
          Add Link
        </button>
      </div>
    </div>
  );
}
