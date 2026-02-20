"use client";

import { useEffect, useState } from "react";
import { Database, X, Table2 } from "lucide-react";

interface TableInfo {
  tableName: string;
  csvPath: string;
  rowCount: number;
  columnCount: number;
  dashboardId: string;
  dashboardTitle: string;
  isPrimary: boolean;
}

interface ExistingTablePickerProps {
  dashboardId: string;
  onSelect: (csvPath: string, tableName: string) => void;
  onClose: () => void;
}

export function ExistingTablePicker({ dashboardId, onSelect, onClose }: ExistingTablePickerProps) {
  const [tables, setTables] = useState<TableInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/dashboards/tables?exclude=${dashboardId}`)
      .then((r) => r.json())
      .then((d) => setTables(d.tables ?? []))
      .finally(() => setLoading(false));
  }, [dashboardId]);

  // Group by dashboard
  const grouped = tables.reduce<Record<string, { title: string; tables: TableInfo[] }>>((acc, t) => {
    if (!acc[t.dashboardId]) {
      acc[t.dashboardId] = { title: t.dashboardTitle, tables: [] };
    }
    acc[t.dashboardId].tables.push(t);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-[#1e293b] border border-[#334155] rounded-xl w-full max-w-lg mx-4 shadow-2xl max-h-[70vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#334155] px-6 py-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-[#2563eb]" />
            <h2 className="text-white font-semibold">Add from existing dashboard</h2>
          </div>
          <button onClick={onClose} className="text-[#94a3b8] hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {loading ? (
            <p className="text-sm text-[#94a3b8]">Loading tables...</p>
          ) : Object.keys(grouped).length === 0 ? (
            <p className="text-sm text-[#94a3b8]">No tables found in other dashboards.</p>
          ) : (
            <div className="space-y-4">
              {Object.entries(grouped).map(([dId, group]) => (
                <div key={dId}>
                  <p className="text-xs text-[#94a3b8] mb-2 font-medium uppercase tracking-wide">{group.title}</p>
                  <div className="space-y-1.5">
                    {group.tables.map((t) => (
                      <button
                        key={`${dId}-${t.tableName}`}
                        onClick={() => onSelect(t.csvPath, t.tableName)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-[#334155] bg-[#0f1729] hover:border-[#2563eb] hover:bg-[#2563eb]/5 transition-colors text-left"
                      >
                        <Table2 className="h-4 w-4 text-[#94a3b8] flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-white truncate">{t.tableName}</p>
                          <p className="text-[11px] text-[#94a3b8]">
                            {t.rowCount.toLocaleString()} rows · {t.columnCount} columns
                            {t.isPrimary && " · primary"}
                          </p>
                        </div>
                      </button>
                    ))}
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
