"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AutoChart } from "@/components/auto-chart";
import { useFilterStore } from "@/store/filters";
import { formatTitle } from "@/lib/format-utils";
import type { ColumnProfile } from "@/lib/profiler";
import type { ChartData } from "@/types/dashboard";

// Inline SQL escaping (sql-utils.ts uses path — server only)
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

interface DimensionChartProps {
  dashboardId: string;
  tableName: string;
  columns: ColumnProfile[];
  rowCount: number;
}

export function DimensionChart({ dashboardId, tableName, columns, rowCount }: DimensionChartProps) {
  const searchParams = useSearchParams();
  const dimName = searchParams.get("dim");
  const { filters } = useFilterStore();
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const col = dimName ? columns.find((c) => c.name === dimName) : null;

  useEffect(() => {
    if (!dimName || !col) {
      setChartData(null);
      return;
    }

    // Abort previous request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const isHighCard = col.distinctCount > 20;
    const colRef = quoteIdent(dimName);
    const tableRef = quoteIdent(tableName);

    // Build WHERE: exclude self-referencing filter + exclude nulls/empties
    const whereParts = [`${colRef} IS NOT NULL`, `${colRef} != ''`];
    for (const f of filters) {
      if (f.column !== dimName) {
        whereParts.push(`${quoteIdent(f.column)} = ${quoteLiteral(f.value)}`);
      }
    }
    const where = whereParts.join(" AND ");

    const sql = `SELECT ${colRef}, COUNT(*) as "Count" FROM ${tableRef} WHERE ${where} GROUP BY ${colRef} ORDER BY "Count" DESC${isHighCard ? " LIMIT 10" : ""}`;

    setLoading(true);
    setError(null);

    fetch(`/api/dashboard/${dashboardId}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sql }),
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((data) => {
        if (controller.signal.aborted) return;
        if (data.error) {
          setError(data.error);
          setChartData(null);
        } else {
          setChartData({
            id: `dim-${dimName}`,
            type: "horizontal-bar",
            title: `${formatTitle(dimName)} Distribution${isHighCard ? " (Top 10)" : ""}`,
            width: 12,
            xColumn: dimName,
            yColumns: ["Count"],
            data: data.results ?? [],
          });
        }
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(String(err));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [dimName, col, filters, tableName, dashboardId]);

  if (!dimName || !col) return null;

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-5 mb-6">
      {loading && (
        <div className="flex items-center justify-center h-[120px] text-sm text-[#94a3b8]">
          Loading...
        </div>
      )}
      {error && (
        <div className="flex items-center justify-center h-[120px] text-sm text-[#ef4444]">
          {error}
        </div>
      )}
      {!loading && !error && chartData && (
        <>
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-300">{chartData.title}</h3>
          </div>
          <AutoChart chart={chartData} />
        </>
      )}
    </div>
  );
}
