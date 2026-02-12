"use client";

import { Suspense, useEffect, useState, useCallback, useMemo, useRef } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { KpiCard } from "@/components/kpi-card";
import { AutoChart } from "@/components/auto-chart";
import { FilterBar } from "@/components/filter-bar";
import { AiSidebar } from "@/components/ai-sidebar";
import { AiPageContext } from "@/components/ai-page-context";
import { DeleteConfirm } from "@/components/delete-confirm";
import { ChartErrorBoundary } from "@/components/chart-error-boundary";
import { VersionHistory } from "@/components/version-history";
import { TableAddedModal } from "@/components/table-added-modal";
import { TableManager } from "@/components/table-manager";
import type { SuggestionWithId } from "@/components/table-added-modal";
import { GlassBoxPanel } from "@/components/glass-box/glass-box-panel";
import { generateStarterQuestions } from "@/lib/semantic-layer";
import { Calendar, Download, Trash2, Clock, Plus, Database } from "lucide-react";
import type { DashboardConfig, ChartData, KpiData, GlassBoxDecision } from "@/types/dashboard";
interface DashboardResponse {
  config: DashboardConfig;
  charts: (ChartData | KpiData)[];
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen"><Sidebar /><main className="flex-1 flex items-center justify-center"><div className="text-gray-400">Loading dashboard...</div></main></div>}>
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const id = params.id as string;
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDelete, setShowDelete] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tableAddedInfo, setTableAddedInfo] = useState<{
    tableName: string;
    rowCount: number;
    columnCount: number;
    columns: string[];
    suggestions: SuggestionWithId[];
  } | null>(null);
  const [showTableManager, setShowTableManager] = useState(false);
  const [addingTable, setAddingTable] = useState(false);
  const addTableRef = useRef<HTMLInputElement>(null);
  const [glassBoxDecisions, setGlassBoxDecisions] = useState<GlassBoxDecision[]>([]);

  const starterQuestions = useMemo(
    () => data?.config.profile ? generateStarterQuestions(data.config.profile) : undefined,
    [data?.config.profile]
  );

  // Date range from URL
  const temporalCol = data?.config.profile?.columns.find((c) => c.type === "temporal");
  const dateFrom = searchParams.get("dateFrom") ?? "";
  const dateTo = searchParams.get("dateTo") ?? "";

  const setDateParam = useCallback(
    (key: string, value: string) => {
      const p = new URLSearchParams(searchParams.toString());
      if (value) {
        p.set(key, value);
        if (temporalCol) p.set("dateCol", temporalCol.name);
      } else {
        p.delete(key);
        if (!p.get("dateFrom") && !p.get("dateTo")) p.delete("dateCol");
      }
      router.replace(`${pathname}?${p.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname, temporalCol]
  );

  const filterQs = searchParams.toString();

  const fetchDashboard = useCallback(async () => {
    try {
      const url = `/api/dashboard/${id}${filterQs ? "?" + filterQs : ""}`;
      const res = await fetch(url);
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setData(d);
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [id, filterQs]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // Generate Glass Box decisions from chart recommendations
  useEffect(() => {
    if (!data?.config.profile || glassBoxDecisions.length > 0) return;
    const chartDecisions: GlassBoxDecision[] = data.config.charts.map((chart) => ({
      id: `gb-chart-${chart.id}`,
      type: "chart" as const,
      confidence: chart.confidence ?? 0.7,
      reason: chart.reason ?? `${chart.title} (${chart.type} chart)`,
      status: "accepted" as const,
      details: {
        chartType: chart.type,
        columns: [chart.xColumn, ...(chart.yColumns ?? [])].filter(Boolean) as string[],
        sql: chart.query,
      },
    }));
    setGlassBoxDecisions(chartDecisions);
  }, [data?.config.charts, data?.config.profile, glassBoxDecisions.length]);

  const handleGlassBoxAccept = useCallback((decisionId: string) => {
    setGlassBoxDecisions((prev) =>
      prev.map((d) => d.id === decisionId ? { ...d, status: "accepted" as const } : d)
    );
  }, []);

  const handleGlassBoxReject = useCallback((decisionId: string) => {
    setGlassBoxDecisions((prev) =>
      prev.map((d) => d.id === decisionId ? { ...d, status: "rejected" as const } : d)
    );
  }, []);

  const handleGlassBoxAcceptAllHigh = useCallback(() => {
    setGlassBoxDecisions((prev) =>
      prev.map((d) => d.status === "pending" && d.confidence >= 0.7 ? { ...d, status: "accepted" as const } : d)
    );
  }, []);

  const handleDelete = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/dashboard/${id}`, { method: "DELETE" });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      router.push("/dashboards");
    } catch (err) {
      setError(String(err));
      setDeleting(false);
    }
  }, [id, router]);

  const handleAddTable = useCallback(async (file: File) => {
    setAddingTable(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/dashboard/${id}/tables`, { method: "POST", body: formData });
      const d = await res.json();
      if (d.error) throw new Error(d.error);

      const { table, columns } = d as {
        table: { tableName: string; rowCount: number; columnCount: number };
        columns: string[];
      };

      // Auto-detect relationships
      let suggestions: SuggestionWithId[] = [];
      try {
        const detectRes = await fetch(`/api/dashboard/${id}/detect-relationships`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const detectData = await detectRes.json();
        if (detectData.suggestions?.length > 0) {
          suggestions = detectData.suggestions;
        }
      } catch {
        // Detection failed silently — non-blocking
      }

      // Always show Table Added modal
      setTableAddedInfo({
        tableName: table.tableName,
        rowCount: table.rowCount,
        columnCount: table.columnCount,
        columns,
        suggestions,
      });

      fetchDashboard();
    } catch (err) {
      setError(String(err));
    } finally {
      setAddingTable(false);
    }
  }, [id, fetchDashboard]);

  const handleTableAddedDone = useCallback(async (excludedColumns: string[], acceptedRelIds: string[]) => {
    const info = tableAddedInfo;
    if (!info) return;

    try {
      // Save excluded columns
      if (excludedColumns.length > 0) {
        await fetch(`/api/dashboard/${id}/tables`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableName: info.tableName,
            excludedColumns,
          }),
        });
      }

      // Accept selected relationships
      if (acceptedRelIds.length > 0) {
        await Promise.all(
          acceptedRelIds.map((relId) =>
            fetch(`/api/dashboard/${id}/relationships`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ relationshipId: relId, status: "accepted" }),
            })
          )
        );
      }

      fetchDashboard();
    } catch {
      // Non-blocking
    } finally {
      setTableAddedInfo(null);
    }
  }, [id, tableAddedInfo, fetchDashboard]);

  if (loading && !data) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-gray-400">Loading dashboard...</div>
        </main>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="flex-1 flex items-center justify-center">
          <div className="text-red-400">{error}</div>
        </main>
      </div>
    );
  }

  if (!data) return null;

  const { config, charts } = data;
  const kpis = charts.filter((c): c is KpiData => "value" in c);
  const visualCharts = charts.filter((c): c is ChartData => "data" in c);
  const tableCount = 1 + (config.tables?.length ?? 0);

  return (
    <div className="flex min-h-screen">
      <AiPageContext mode="analyst" page="dashboard" />
      <Sidebar />

      <main className="flex-1 p-6 min-w-0 overflow-hidden">
        {/* Header */}
        <header className="flex flex-col gap-3 mb-6">
          {/* Row 1: Breadcrumb + Toolbar */}
          <div className="flex items-center justify-between">
            <nav className="flex items-center text-sm text-[#94a3b8]">
              <Link href="/dashboards" className="hover:text-white transition-colors">Dashboards</Link>
              <span className="mx-2 text-[#475569]">/</span>
              <span className="text-[#cbd5e1] truncate max-w-[300px]">{config.title}</span>
            </nav>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => addTableRef.current?.click()}
                disabled={addingTable}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#334155] bg-[#1e293b] hover:bg-[#334155] text-xs font-medium text-[#cbd5e1] transition-colors disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                {addingTable ? "Adding..." : "Add CSV"}
              </button>
              <input
                ref={addTableRef}
                type="file"
                accept=".csv,.tsv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAddTable(file);
                  e.target.value = "";
                }}
              />
              <div className="h-5 w-px bg-[#334155] mx-1" />
              {config.previousVersions && config.previousVersions.length > 0 && (
                <button
                  onClick={() => setShowVersions(true)}
                  className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#334155] bg-[#1e293b] hover:bg-[#334155] text-[#cbd5e1] transition-colors"
                  title={`Version ${config.version ?? 1}`}
                >
                  <Clock className="h-3.5 w-3.5" />
                </button>
              )}
              <a
                href={`/api/dashboard/${id}/export`}
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#334155] bg-[#1e293b] hover:bg-[#334155] text-[#cbd5e1] transition-colors"
                title="Export CSV"
                download
              >
                <Download className="h-3.5 w-3.5" />
              </a>
              <button
                onClick={() => setShowDelete(true)}
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-[#334155] bg-[#1e293b] hover:bg-[#334155] text-[#94a3b8] hover:text-[#ef4444] hover:border-[#ef4444]/50 transition-colors"
                title="Delete dashboard"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Row 2: Title + Meta badge */}
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-white tracking-tight truncate max-w-[500px]" title={config.title}>
              {config.title}
            </h1>
            <span className="flex-shrink-0 text-[11px] bg-[#1e293b] border border-[#334155] rounded-full px-3 py-1 text-[#94a3b8]">
              {config.rowCount.toLocaleString()} rows &middot; {config.columnCount} col
              {config.version && config.version > 1 ? ` \u00b7 v${config.version}` : ""}
              {config.templateId ? ` \u00b7 ${config.templateId.replace(/-/g, " ")}` : ""}
            </span>
            {tableCount > 1 && (
              <button
                onClick={() => setShowTableManager(true)}
                className="flex-shrink-0 flex items-center gap-1 text-[11px] bg-[#2563eb]/10 border border-[#2563eb]/30 rounded-full px-2.5 py-1 text-[#2563eb] hover:bg-[#2563eb]/20 transition-colors"
              >
                <Database className="h-3 w-3" />
                {tableCount} tables
              </button>
            )}
          </div>

          {/* Date filter (only for temporal data) */}
          {temporalCol && (
            <div className="flex items-center gap-2">
              <Calendar className="h-3.5 w-3.5 text-[#94a3b8]" />
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateParam("dateFrom", e.target.value)}
                className="bg-[#1e293b] border border-[#334155] rounded-lg px-2 py-1 text-xs text-[#cbd5e1] [color-scheme:dark]"
              />
              <span className="text-[#94a3b8] text-xs">to</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateParam("dateTo", e.target.value)}
                className="bg-[#1e293b] border border-[#334155] rounded-lg px-2 py-1 text-xs text-[#cbd5e1] [color-scheme:dark]"
              />
            </div>
          )}
        </header>

        {/* Active Filters */}
        <FilterBar />

        {/* Glass Box */}
        <GlassBoxPanel
          decisions={glassBoxDecisions}
          onAccept={handleGlassBoxAccept}
          onReject={handleGlassBoxReject}
          onAcceptAllHigh={handleGlassBoxAcceptAllHigh}
        />

        {/* KPI Row */}
        {kpis.length > 0 && (
          <div className="grid grid-cols-4 gap-4 mb-6">
            {kpis.map((kpi) => (
              <KpiCard key={kpi.id} title={kpi.title} value={kpi.value} />
            ))}
          </div>
        )}

        {/* Chart Grid */}
        <div className="grid grid-cols-12 gap-4">
          {visualCharts.map((chart) => (
            <div
              key={chart.id}
              className="bg-[#1e293b] border border-[#334155] rounded-lg p-5 overflow-hidden"
              style={{ gridColumn: `span ${chart.width} / span ${chart.width}` }}
            >
              <div className="mb-4">
                <h3 className="text-sm font-medium text-gray-300">
                  {chart.title}
                </h3>
                {chart.reason && (
                  <p className="text-[10px] text-gray-500 mt-0.5">{chart.reason}</p>
                )}
              </div>
              <ChartErrorBoundary chartTitle={chart.title}>
                <AutoChart chart={chart} />
              </ChartErrorBoundary>
            </div>
          ))}
        </div>
      </main>

      <AiSidebar
        dashboardId={id}
        starterQuestions={starterQuestions}
      />

      {/* Delete Confirmation */}
      {showDelete && (
        <DeleteConfirm
          dashboardTitle={config.title}
          chartCount={config.charts.length}
          onConfirm={handleDelete}
          onCancel={() => setShowDelete(false)}
          loading={deleting}
        />
      )}

      {/* Version History */}
      <VersionHistory
        dashboardId={id}
        open={showVersions}
        onClose={() => setShowVersions(false)}
      />

      {/* Table Added Modal */}
      {tableAddedInfo && (
        <TableAddedModal
          dashboardId={id}
          tableName={tableAddedInfo.tableName}
          rowCount={tableAddedInfo.rowCount}
          columnCount={tableAddedInfo.columnCount}
          columns={tableAddedInfo.columns}
          suggestions={tableAddedInfo.suggestions}
          onDone={handleTableAddedDone}
          onClose={() => setTableAddedInfo(null)}
        />
      )}

      {/* Table Manager */}
      {showTableManager && data && (
        <TableManager
          dashboardId={id}
          config={data.config}
          onUpdate={fetchDashboard}
          onClose={() => setShowTableManager(false)}
        />
      )}
    </div>
  );
}
