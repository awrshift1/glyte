"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { CanvasView } from "@/components/canvas/canvas-view";
import { CanvasAiSidebar } from "@/components/canvas/canvas-ai-sidebar";
import { ArrowLeft, GitBranch, Sparkles, Wand2, Loader2 } from "lucide-react";
import type { DashboardConfig } from "@/types/dashboard";
import type { SuggestedRelationship } from "@/lib/relationship-detector";

export default function CanvasPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [config, setConfig] = useState<DashboardConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedRelationship[]>([]);
  const [detecting, setDetecting] = useState(false);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch(`/api/dashboard/${id}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      // Load relationships from DuckDB (source of truth)
      const relRes = await fetch(`/api/dashboard/${id}/relationships`);
      const relData = await relRes.json();
      const dbRels = (relData.relationships ?? [])
        .filter((r: Record<string, string>) => r.status !== "rejected")
        .map((r: Record<string, string>) => ({
          id: r.id,
          fromTable: r.from_table,
          fromColumn: r.from_column,
          toTable: r.to_table,
          toColumn: r.to_column,
          type: r.type,
        }));

      setConfig({ ...data.config, relationships: dbRels });
      setError(null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleAutoDetect = useCallback(async () => {
    setDetecting(true);
    try {
      const res = await fetch(`/api/dashboard/${id}/detect-relationships`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setSuggestions(data.suggestions ?? []);
    } catch {
      // silently fail — button shows state
    } finally {
      setDetecting(false);
    }
  }, [id]);

  const handleAcceptSuggestion = useCallback(
    async (suggestion: SuggestedRelationship) => {
      try {
        const res = await fetch(`/api/dashboard/${id}/relationships`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fromTable: suggestion.fromTable,
            fromColumn: suggestion.fromColumn,
            toTable: suggestion.toTable,
            toColumn: suggestion.toColumn,
            type: suggestion.cardinality,
          }),
        });
        const data = await res.json();
        if (data.relationship) {
          // Remove from suggestions
          setSuggestions((prev) =>
            prev.filter(
              (s) =>
                !(
                  s.fromTable === suggestion.fromTable &&
                  s.fromColumn === suggestion.fromColumn &&
                  s.toTable === suggestion.toTable &&
                  s.toColumn === suggestion.toColumn
                )
            )
          );
          // Optimistic update: add relationship to config without full refetch
          setConfig((prev) => prev ? {
            ...prev,
            relationships: [...(prev.relationships ?? []), data.relationship],
          } : prev);
        }
      } catch {
        // ignore
      }
    },
    [id]
  );

  const handleRejectSuggestion = useCallback(
    (suggestion: SuggestedRelationship) => {
      setSuggestions((prev) =>
        prev.filter(
          (s) =>
            !(
              s.fromTable === suggestion.fromTable &&
              s.fromColumn === suggestion.fromColumn &&
              s.toTable === suggestion.toTable &&
              s.toColumn === suggestion.toColumn
            )
        )
      );
    },
    []
  );

  const handleSuggestionsFromChat = useCallback(
    (newSuggestions: SuggestedRelationship[]) => {
      setSuggestions(newSuggestions);
    },
    []
  );

  const handleRelationshipCreatedFromChat = useCallback(() => {
    fetchConfig();
  }, [fetchConfig]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f1729]">
        <p className="text-slate-400">Loading canvas...</p>
      </div>
    );
  }

  if (error || !config) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0f1729]">
        <p className="text-red-400">{error ?? "Dashboard not found"}</p>
      </div>
    );
  }

  const tableCount = 1 + (config.tables?.length ?? 0);

  return (
    <div className="flex flex-col h-screen bg-[#0f1729]">
      {/* Toolbar */}
      <header className="flex items-center justify-between px-4 py-3 bg-[#0f1729]/80 backdrop-blur-sm border-b border-[#1e293b]/50 z-50 shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push(`/dashboard/${id}`)}
            className="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-[#1e293b] text-slate-300 transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="h-5 w-px bg-[#334155] mx-1" />
          <div>
            <h1 className="text-white text-sm font-bold leading-tight">
              {config.title} — Canvas
            </h1>
            <p className="text-[10px] text-slate-500">
              {tableCount} table{tableCount !== 1 ? "s" : ""} ·{" "}
              {config.relationships?.length ?? 0} connection
              {(config.relationships?.length ?? 0) !== 1 ? "s" : ""}
              {suggestions.length > 0 &&
                ` · ${suggestions.length} suggestion${suggestions.length !== 1 ? "s" : ""}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Auto-detect button */}
          <button
            onClick={handleAutoDetect}
            disabled={detecting || tableCount < 2}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#2563eb]/10 border border-[#2563eb]/30 text-xs text-[#2563eb] hover:bg-[#2563eb]/20 transition-colors disabled:opacity-40"
          >
            {detecting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Wand2 className="h-3.5 w-3.5" />
            )}
            <span>{detecting ? "Detecting..." : "Auto-detect"}</span>
          </button>

          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1e293b] border border-[#334155] text-xs text-slate-400">
            <GitBranch className="h-3.5 w-3.5" />
            <span>{config.relationships?.length ?? 0} connections</span>
          </div>

          {/* AI sidebar toggle */}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={`flex items-center justify-center w-9 h-9 rounded-lg transition-colors ${
              sidebarOpen
                ? "bg-[#2563eb] text-white"
                : "hover:bg-[#1e293b] text-slate-300"
            }`}
          >
            <Sparkles className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Canvas + Sidebar */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 min-h-0">
          {tableCount < 2 ? (
            <div className="flex h-full items-center justify-center">
              <div className="text-center space-y-3">
                <GitBranch className="h-12 w-12 text-slate-600 mx-auto" />
                <p className="text-slate-400 text-sm">
                  Add at least 2 tables to use Canvas
                </p>
                <button
                  onClick={() => router.push(`/dashboard/${id}`)}
                  className="text-[#2563eb] text-sm hover:underline"
                >
                  Back to dashboard
                </button>
              </div>
            </div>
          ) : (
            <CanvasView
              dashboardId={id}
              config={config}
              onRelationshipChange={fetchConfig}
              suggestedRelationships={suggestions}
              onAcceptSuggestion={handleAcceptSuggestion}
              onRejectSuggestion={handleRejectSuggestion}
            />
          )}
        </div>

        {/* AI Sidebar */}
        <CanvasAiSidebar
          dashboardId={id}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onSuggestionsReceived={handleSuggestionsFromChat}
          onRelationshipCreated={handleRelationshipCreatedFromChat}
        />
      </div>
    </div>
  );
}
