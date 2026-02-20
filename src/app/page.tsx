"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { DiffPreview } from "@/components/diff-preview";
import { ColumnSelectModal } from "@/components/column-select-modal";
import { AiSidebar } from "@/components/ai-sidebar";
import { AiPageContext } from "@/components/ai-page-context";
import { Upload, FileSpreadsheet, BarChart3, Filter, Share2, Clock } from "lucide-react";
import type { DiffSummary, DashboardConfig } from "@/types/dashboard";

interface DiffState {
  diff: DiffSummary;
  tempPath: string;
  originalName: string;
}

interface ColumnSelectState {
  dashboardId: string;
  tableName: string;
  columns: string[];
  rowCount: number;
}

export default function Home() {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [diffState, setDiffState] = useState<DiffState | null>(null);
  const [columnSelectState, setColumnSelectState] = useState<ColumnSelectState | null>(null);
  const [savingColumns, setSavingColumns] = useState(false);
  const [recentDashboards, setRecentDashboards] = useState<DashboardConfig[]>([]);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/dashboards")
      .then((r) => r.json())
      .then((d) => setRecentDashboards((d.dashboards || []).slice(0, 5)))
      .catch(() => {});
  }, []);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploading(true);
      setError(null);

      try {
        // Step 1: Check for matching dashboard via diff
        const diffFormData = new FormData();
        diffFormData.append("file", file);
        const diffRes = await fetch("/api/upload/diff", { method: "POST", body: diffFormData });
        const diffData = await diffRes.json();

        if (diffData.matched) {
          setDiffState({
            diff: diffData.diff,
            tempPath: diffData.tempPath,
            originalName: diffData.originalName,
          });
          setUploading(false);
          return;
        }

        // No match — proceed with new upload
        const formData = new FormData();
        formData.append("file", file);
        formData.append("tempPath", diffData.tempPath);
        const res = await fetch("/api/upload", { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);

        // Show column selection modal before redirecting
        const columnNames = (data.profile?.columns ?? []).map(
          (c: { name: string }) => c.name
        );
        if (columnNames.length > 0) {
          setColumnSelectState({
            dashboardId: data.dashboardId,
            tableName: data.profile.tableName,
            columns: columnNames,
            rowCount: data.rowCount,
          });
          setUploading(false);
          return;
        }
        router.push(`/dashboard/${data.dashboardId}`);
      } catch (err) {
        setError(String(err));
        setUploading(false);
      }
    },
    [router]
  );

  const handleReplace = useCallback(async () => {
    if (!diffState) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("tempPath", diffState.tempPath);
      formData.append("replaceId", diffState.diff.matchedDashboardId);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDiffState(null);
      router.push(`/dashboard/${data.dashboardId}`);
    } catch (err) {
      setError(String(err));
      setUploading(false);
    }
  }, [diffState, router]);

  const handleNewDashboard = useCallback(async () => {
    if (!diffState) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("tempPath", diffState.tempPath);
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setDiffState(null);
      router.push(`/dashboard/${data.dashboardId}`);
    } catch (err) {
      setError(String(err));
      setUploading(false);
    }
  }, [diffState, router]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
    },
    [handleUpload]
  );

  const handleSampleData = useCallback(async () => {
    setUploading(true);
    setError(null);
    try {
      const res = await fetch("/api/seed", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.push(`/dashboard/${data.dashboardId}`);
    } catch (err) {
      setError(String(err));
      setUploading(false);
    }
  }, [router]);

  const handleColumnsDone = useCallback(
    async (excludedColumns: string[]) => {
      if (!columnSelectState) return;
      setSavingColumns(true);
      try {
        await fetch(`/api/dashboard/${columnSelectState.dashboardId}/tables`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tableName: columnSelectState.tableName,
            excludedColumns,
          }),
        });
        setColumnSelectState(null);
        router.push(`/dashboard/${columnSelectState.dashboardId}`);
      } catch {
        setColumnSelectState(null);
        router.push(`/dashboard/${columnSelectState.dashboardId}`);
      } finally {
        setSavingColumns(false);
      }
    },
    [columnSelectState, router]
  );

  const handleColumnsSkip = useCallback(() => {
    if (!columnSelectState) return;
    const id = columnSelectState.dashboardId;
    setColumnSelectState(null);
    router.push(`/dashboard/${id}`);
  }, [columnSelectState, router]);

  return (
    <div className="flex min-h-screen">
      <AiPageContext mode="salesperson" page="home" />
      <Sidebar />

      <main className="flex-1 p-8">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome back</h1>
          <p className="text-gray-400 mb-8">
            Upload data or open an existing dashboard
          </p>

          <div className="grid grid-cols-5 gap-6 mb-8">
            {/* Upload Zone */}
            <div className="col-span-3 bg-[#1e293b] border border-[#334155] rounded-lg p-8">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileSpreadsheet className="w-5 h-5 text-[#2563eb]" />
                Quick Start
              </h2>
              <div
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                className="border-2 border-dashed border-[#334155] rounded-lg p-12 text-center hover:border-[#2563eb] transition-colors cursor-pointer"
                onClick={() => document.getElementById("file-input")?.click()}
              >
                <Upload className="w-12 h-12 text-[#2563eb] mx-auto mb-4" />
                {uploading ? (
                  <p className="text-white">Processing...</p>
                ) : (
                  <>
                    <p className="text-white mb-1">
                      Drop your CSV or Excel file here
                    </p>
                    <p className="text-gray-400 text-sm">or click to browse</p>
                  </>
                )}
                <input
                  id="file-input"
                  type="file"
                  accept=".csv,.tsv,.xlsx,.xls"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
              <p className="text-gray-500 text-xs mt-3">
                Supported: CSV, TSV, Excel (.xlsx)
              </p>

              <div className="mt-4 flex items-center gap-2">
                <span className="text-gray-400 text-sm">Or try:</span>
                <button
                  onClick={handleSampleData}
                  className="text-[#2563eb] text-sm hover:underline"
                >
                  Sample marketing data
                </button>
              </div>

              {error && (
                <p className="mt-3 text-red-400 text-sm">{error}</p>
              )}
            </div>

            {/* Recent Dashboards */}
            <div className="col-span-2 bg-[#1e293b] border border-[#334155] rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">
                  Recent Dashboards
                </h2>
                {recentDashboards.length > 0 && (
                  <Link href="/dashboards" className="text-xs text-[#2563eb] hover:underline">
                    View all
                  </Link>
                )}
              </div>
              {recentDashboards.length === 0 ? (
                <div className="text-gray-400 text-sm py-8 text-center">
                  No dashboards yet. Upload a file to get started.
                </div>
              ) : (
                <div className="space-y-2">
                  {recentDashboards.map((d) => (
                    <Link
                      key={d.id}
                      href={`/dashboard/${d.id}`}
                      className="flex items-center justify-between p-3 rounded-lg border border-[#334155] hover:border-[#2563eb] bg-[#0f1729] transition-colors group"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-white truncate group-hover:text-[#2563eb] transition-colors">
                          {d.title}
                        </p>
                        <div className="flex items-center gap-3 text-[10px] text-gray-400 mt-0.5">
                          <span>{d.rowCount.toLocaleString()} rows</span>
                          <span>{d.columnCount} cols</span>
                          <span>{d.charts.length} charts</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-gray-500 flex-shrink-0">
                        <Clock className="h-3 w-3" />
                        {new Date(d.createdAt).toLocaleDateString()}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Feature cards */}
          <div className="grid grid-cols-3 gap-4">
            <FeatureCard
              icon={<BarChart3 className="w-8 h-8 text-[#2563eb]" />}
              title="Auto-Dashboard"
              description="Upload → instant charts. Zero configuration."
            />
            <FeatureCard
              icon={<Filter className="w-8 h-8 text-[#06b6d4]" />}
              title="Cross-Filtering"
              description="Click any chart to filter everything."
            />
            <FeatureCard
              icon={<Share2 className="w-8 h-8 text-[#22c55e]" />}
              title="Export & Share"
              description="JSON configs, PNG charts, shareable URLs."
            />
          </div>
        </div>
      </main>

      <AiSidebar />

      {/* Diff Preview Modal */}
      {diffState && (
        <DiffPreview
          diff={diffState.diff}
          originalName={diffState.originalName}
          tempPath={diffState.tempPath}
          onReplace={handleReplace}
          onNew={handleNewDashboard}
          onCancel={() => setDiffState(null)}
          loading={uploading}
        />
      )}

      {/* Column Select Modal */}
      {columnSelectState && (
        <ColumnSelectModal
          tableName={columnSelectState.tableName}
          rowCount={columnSelectState.rowCount}
          columns={columnSelectState.columns}
          onDone={handleColumnsDone}
          onSkip={handleColumnsSkip}
          loading={savingColumns}
        />
      )}
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-5 hover:border-[#2563eb] transition-colors">
      <div className="mb-3">{icon}</div>
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  );
}
