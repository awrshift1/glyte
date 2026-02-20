"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sidebar } from "@/components/sidebar";
import { AiSidebar } from "@/components/ai-sidebar";
import { AiPageContext } from "@/components/ai-page-context";
import { DeleteConfirm } from "@/components/delete-confirm";
import { BarChart3, Clock, Trash2 } from "lucide-react";
import type { DashboardConfig } from "@/types/dashboard";

export default function DashboardsPage() {
  const [dashboards, setDashboards] = useState<DashboardConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string; chartCount: number } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/dashboards")
      .then((r) => r.json())
      .then((d) => setDashboards(d.dashboards || []))
      .finally(() => setLoading(false));
  }, []);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      const res = await fetch(`/api/dashboard/${deleteTarget.id}`, { method: "DELETE" });
      const d = await res.json();
      if (d.error) throw new Error(d.error);
      setDashboards((prev) => prev.filter((db) => db.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (err) {
      console.error("Delete failed:", err);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex min-h-screen">
      <AiPageContext mode="salesperson" page="dashboards" />
      <Sidebar />
      <main className="flex-1 p-6">
        <h1 className="text-2xl font-bold text-white mb-6">Dashboards</h1>

        {loading ? (
          <p className="text-gray-400">Loading...</p>
        ) : dashboards.length === 0 ? (
          <div className="text-center py-20">
            <BarChart3 className="h-12 w-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 mb-2">No dashboards yet</p>
            <p className="text-gray-400 text-sm">Upload a CSV from the home page to create one.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dashboards.map((d) => (
              <Link
                key={d.id}
                href={`/dashboard/${d.id}`}
                className="relative block bg-[#1e293b] border border-[#334155] rounded-lg p-5 hover:border-[#2563eb] transition-colors group"
              >
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setDeleteTarget({ id: d.id, title: d.title, chartCount: d.charts.length });
                  }}
                  className="absolute top-3 right-3 flex items-center justify-center w-7 h-7 rounded-md bg-[#0f1729]/60 text-[#94a3b8] opacity-0 group-hover:opacity-100 hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-all"
                  title="Delete dashboard"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
                <h3 className="text-white font-medium mb-2 group-hover:text-[#2563eb] transition-colors pr-8">{d.title}</h3>
                <div className="flex items-center gap-4 text-xs text-gray-400">
                  <span>{d.rowCount.toLocaleString()} rows</span>
                  <span>{d.columnCount} columns</span>
                  <span>{d.charts.length} charts</span>
                </div>
                <div className="flex items-center gap-1 mt-3 text-[10px] text-gray-400">
                  <Clock className="h-3 w-3" />
                  {new Date(d.createdAt).toLocaleDateString()}
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <AiSidebar />

      {deleteTarget && (
        <DeleteConfirm
          dashboardTitle={deleteTarget.title}
          chartCount={deleteTarget.chartCount}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          loading={deletingId === deleteTarget.id}
        />
      )}
    </div>
  );
}
