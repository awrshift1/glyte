"use client";

import { useState, useEffect } from "react";
import { X, Trash2, Link2 } from "lucide-react";
import type { Relationship, DashboardConfig } from "@/types/dashboard";

interface RelationshipEditorProps {
  dashboardId: string;
  config: DashboardConfig;
  open: boolean;
  onClose: () => void;
  onUpdate: () => void;
}

export function RelationshipEditor({ dashboardId, config, open, onClose, onUpdate }: RelationshipEditorProps) {
  const [relationships, setRelationships] = useState<Relationship[]>(config.relationships ?? []);
  const [tableColumns, setTableColumns] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(false);

  // Form state
  const [fromTable, setFromTable] = useState("");
  const [fromColumn, setFromColumn] = useState("");
  const [toTable, setToTable] = useState("");
  const [toColumn, setToColumn] = useState("");

  const allTables = [
    config.tableName,
    ...(config.tables ?? []).map((t) => t.tableName),
  ];

  // Fetch columns for each table
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    const fetchCols = async () => {
      const cols: Record<string, string[]> = {};
      for (const table of allTables) {
        try {
          const res = await fetch(`/api/columns?table=${encodeURIComponent(table)}`, { signal: controller.signal });
          if (res.ok) {
            const data = await res.json();
            cols[table] = data.columns;
          }
        } catch (e) {
          if (e instanceof DOMException && e.name === "AbortError") return;
        }
      }
      // If API doesn't exist, use profile
      if (Object.keys(cols).length === 0 && config.profile) {
        cols[config.tableName] = config.profile.columns.map((c) => c.name);
      }
      setTableColumns(cols);
    };
    fetchCols();
    return () => controller.abort();
  }, [open]);

  // Fetch existing relationships
  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    fetch(`/api/dashboard/${dashboardId}/relationships`, { signal: controller.signal })
      .then((r) => r.json())
      .then((d) => setRelationships(d.relationships ?? []))
      .catch(() => {});
    return () => controller.abort();
  }, [open, dashboardId]);

  const addRelationship = async () => {
    if (!fromTable || !fromColumn || !toTable || !toColumn) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/dashboard/${dashboardId}/relationships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromTable, fromColumn, toTable, toColumn, type: "one-to-many" }),
      });
      const data = await res.json();
      if (data.relationship) {
        setRelationships((prev) => [...prev, data.relationship]);
        setFromTable("");
        setFromColumn("");
        setToTable("");
        setToColumn("");
        onUpdate();
      }
    } finally {
      setLoading(false);
    }
  };

  const removeRelationship = async (relId: string) => {
    try {
      await fetch(`/api/dashboard/${dashboardId}/relationships`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ relationshipId: relId }),
      });
      setRelationships((prev) => prev.filter((r) => r.id !== relId));
      onUpdate();
    } catch {}
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl w-full max-w-xl mx-4 shadow-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4">
          <div className="flex items-center gap-3">
            <Link2 className="h-5 w-5 text-[#2563eb]" />
            <h2 className="text-white font-semibold">Link Tables</h2>
          </div>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Existing relationships */}
          {relationships.length > 0 && (
            <div className="space-y-2">
              {relationships.map((r) => (
                <div key={r.id} className="flex items-center justify-between bg-[#0f1729] border border-[#334155] rounded-lg px-4 py-3">
                  <div className="text-xs text-[#94a3b8]">
                    <span className="text-white">{r.fromTable}</span>.{r.fromColumn}
                    <span className="mx-2 text-[#2563eb]">↔</span>
                    <span className="text-white">{r.toTable}</span>.{r.toColumn}
                  </div>
                  <button onClick={() => removeRelationship(r.id)} className="text-[#94a3b8] hover:text-[#ef4444]">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add relationship form */}
          {allTables.length >= 2 && (
            <div className="bg-[#0f1729] border border-[#334155] rounded-lg p-4 space-y-3">
              <p className="text-xs text-[#94a3b8] font-medium">Link tables by a shared column</p>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#94a3b8] block mb-1">Table</label>
                  <select
                    value={fromTable}
                    onChange={(e) => { setFromTable(e.target.value); setFromColumn(""); }}
                    className="w-full bg-[#1e293b] border border-[#334155] rounded px-2 py-1.5 text-xs text-white"
                  >
                    <option value="">Select...</option>
                    {allTables.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-[#94a3b8] block mb-1">Column</label>
                  <select
                    value={fromColumn}
                    onChange={(e) => setFromColumn(e.target.value)}
                    className="w-full bg-[#1e293b] border border-[#334155] rounded px-2 py-1.5 text-xs text-white"
                    disabled={!fromTable}
                  >
                    <option value="">Select...</option>
                    {(tableColumns[fromTable] ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-center">
                <span className="text-[#2563eb] text-xs font-medium">↔ linked to ↔</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-[#94a3b8] block mb-1">Table</label>
                  <select
                    value={toTable}
                    onChange={(e) => { setToTable(e.target.value); setToColumn(""); }}
                    className="w-full bg-[#1e293b] border border-[#334155] rounded px-2 py-1.5 text-xs text-white"
                  >
                    <option value="">Select...</option>
                    {allTables.filter((t) => t !== fromTable).map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-[#94a3b8] block mb-1">Column</label>
                  <select
                    value={toColumn}
                    onChange={(e) => setToColumn(e.target.value)}
                    className="w-full bg-[#1e293b] border border-[#334155] rounded px-2 py-1.5 text-xs text-white"
                    disabled={!toTable}
                  >
                    <option value="">Select...</option>
                    {(tableColumns[toTable] ?? []).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>

              <button
                onClick={addRelationship}
                disabled={!fromTable || !fromColumn || !toTable || !toColumn || loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white hover:bg-[#1d4ed8] disabled:opacity-40 transition-colors"
              >
                <Link2 className="h-4 w-4" />
                Link Tables
              </button>
            </div>
          )}

          {allTables.length < 2 && (
            <p className="text-xs text-[#94a3b8] text-center py-4">
              Add at least 2 tables to define relationships.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
