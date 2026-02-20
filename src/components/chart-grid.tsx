"use client";

import { useState, useCallback, useEffect, memo } from "react";
import { AutoChart } from "@/components/auto-chart";
import { ChartErrorBoundary } from "@/components/chart-error-boundary";
import { X, ChevronDown, ChevronRight } from "lucide-react";
import type { ChartData } from "@/types/dashboard";

interface ChartGridProps {
  dashboardId: string;
  charts: ChartData[];
  initialHiddenIds?: string[];
}

export const ChartGrid = memo(function ChartGrid({
  dashboardId,
  charts,
  initialHiddenIds,
}: ChartGridProps) {
  const [hiddenChartIds, setHiddenChartIds] = useState<Set<string>>(
    new Set(initialHiddenIds ?? []),
  );
  const [showMoreInsights, setShowMoreInsights] = useState(false);

  // Sync from parent config (initial load)
  useEffect(() => {
    if (initialHiddenIds) {
      setHiddenChartIds(new Set(initialHiddenIds));
    }
  }, [initialHiddenIds]);

  const handleHideChart = useCallback(
    (chartId: string) => {
      const next = new Set(hiddenChartIds);
      next.add(chartId);
      setHiddenChartIds(next);
      fetch(`/api/dashboard/${dashboardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hiddenChartIds: [...next] }),
      }).catch((e) => console.error("Failed to persist hiddenChartIds:", e));
    },
    [dashboardId, hiddenChartIds],
  );

  const handleRestoreAll = useCallback(() => {
    setHiddenChartIds(new Set());
    fetch(`/api/dashboard/${dashboardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ hiddenChartIds: [] }),
    }).catch((e) => console.error("Failed to persist hiddenChartIds:", e));
  }, [dashboardId]);

  const visibleCharts = charts
    .filter((c) => !hiddenChartIds.has(c.id))
    .sort((a, b) => (b.confidence ?? 0.7) - (a.confidence ?? 0.7));
  const primaryCharts = visibleCharts.slice(0, 8);
  const overflowCharts = visibleCharts.slice(8);
  const hiddenCount = charts.length - visibleCharts.length;

  return (
    <>
      {hiddenCount > 0 && (
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs text-[#94a3b8]">
            {hiddenCount} chart{hiddenCount > 1 ? "s" : ""} hidden
          </span>
          <button
            onClick={handleRestoreAll}
            className="text-xs text-[#2563eb] hover:text-[#3b82f6] transition-colors"
          >
            Show all
          </button>
        </div>
      )}
      <div className="grid grid-cols-12 gap-4">
        {primaryCharts.map((chart) => (
          <ChartCard
            key={chart.id}
            chart={chart}
            onHide={handleHideChart}
          />
        ))}
      </div>
      {overflowCharts.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setShowMoreInsights((v) => !v)}
            className="flex items-center gap-1.5 text-sm text-[#94a3b8] hover:text-white transition-colors mb-3"
          >
            {showMoreInsights ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            More insights ({overflowCharts.length})
          </button>
          {showMoreInsights && (
            <div className="grid grid-cols-12 gap-4">
              {overflowCharts.map((chart) => (
                <ChartCard
                  key={chart.id}
                  chart={chart}
                  onHide={handleHideChart}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
});

const ChartCard = memo(function ChartCard({
  chart,
  onHide,
}: {
  chart: ChartData;
  onHide: (id: string) => void;
}) {
  return (
    <div
      className="relative group bg-[#1e293b] border border-[#334155] rounded-lg p-5 overflow-hidden"
      style={{ gridColumn: `span ${chart.width} / span ${chart.width}` }}
    >
      <button
        onClick={() => onHide(chart.id)}
        className="absolute top-2 right-2 z-10 p-1 rounded-md bg-[#0f1729]/80 border border-[#334155] text-[#94a3b8] hover:text-white hover:border-[#ef4444]/50 hover:bg-[#ef4444]/10 opacity-0 group-hover:opacity-100 transition-all"
        title="Hide chart"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <div className="mb-4">
        <h3 className="text-sm font-medium text-gray-300">{chart.title}</h3>
        {chart.reason && (
          <p className="text-[10px] text-gray-500 mt-0.5">{chart.reason}</p>
        )}
      </div>
      <ChartErrorBoundary chartTitle={chart.title}>
        <AutoChart chart={chart} />
      </ChartErrorBoundary>
    </div>
  );
});
