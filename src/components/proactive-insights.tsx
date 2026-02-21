"use client";

import { useState, useCallback } from "react";
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  GitBranch,
  RefreshCw,
  MessageSquare,
} from "lucide-react";
import type { Insight, InsightType } from "@/types/dashboard";

interface ProactiveInsightsProps {
  dashboardId: string;
  cachedInsights?: Insight[];
  onAskAi: (question: string) => void;
}

const ICON_MAP: Record<InsightType, { icon: typeof TrendingUp; color: string }> = {
  trend: { icon: TrendingUp, color: "text-blue-400" },
  anomaly: { icon: AlertTriangle, color: "text-amber-400" },
  distribution: { icon: BarChart3, color: "text-green-400" },
  correlation: { icon: GitBranch, color: "text-purple-400" },
};

export function ProactiveInsights({ dashboardId, cachedInsights, onAskAi }: ProactiveInsightsProps) {
  const [insights, setInsights] = useState<Insight[] | null>(cachedInsights ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard/${dashboardId}/insights`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInsights(data.insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [dashboardId]);

  const handleRefresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Clear cache first
      await fetch(`/api/dashboard/${dashboardId}/insights`, { method: "DELETE" });
      // Regenerate
      const res = await fetch(`/api/dashboard/${dashboardId}/insights`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setInsights(data.insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [dashboardId]);

  // Not generated yet — show generate button
  if (!insights && !loading && !error) {
    return (
      <div className="mb-6">
        <button
          onClick={fetchInsights}
          className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#334155] bg-[#1e293b] hover:bg-[#334155] text-sm text-[#94a3b8] hover:text-white transition-colors"
        >
          <Sparkles className="h-4 w-4" />
          Generate Insights
        </button>
      </div>
    );
  }

  // Loading skeleton
  if (loading) {
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="h-4 w-4 text-[#2563eb]" />
          <span className="text-sm font-medium text-white">Insights</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-lg border border-[#334155] bg-[#1e293b] p-3 animate-pulse">
              <div className="h-4 bg-[#334155] rounded w-3/4 mb-2" />
              <div className="h-3 bg-[#334155] rounded w-full mb-1" />
              <div className="h-3 bg-[#334155] rounded w-2/3" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="mb-6">
        <div className="rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 px-4 py-3 text-sm text-[#ef4444] flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={fetchInsights}
            className="text-xs underline hover:no-underline ml-3"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Empty results
  if (insights && insights.length === 0) {
    return (
      <div className="mb-6">
        <div className="rounded-lg border border-[#334155] bg-[#1e293b] px-4 py-3 text-sm text-[#94a3b8]">
          No significant patterns found in this dataset.
        </div>
      </div>
    );
  }

  // Insights loaded — render cards
  const hasAiNarrative = insights?.some((i) => i.narrativeGenerated);

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#2563eb]" />
          <span className="text-sm font-medium text-white">Insights</span>
          {hasAiNarrative && (
            <span className="text-[10px] bg-[#2563eb]/20 text-[#2563eb] rounded-full px-1.5 py-0.5">
              AI
            </span>
          )}
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-1 text-xs text-[#94a3b8] hover:text-white transition-colors"
          title="Regenerate insights"
        >
          <RefreshCw className="h-3 w-3" />
          Refresh
        </button>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {insights?.map((insight) => {
          const { icon: Icon, color } = ICON_MAP[insight.type] ?? ICON_MAP.distribution;
          return (
            <div
              key={insight.id}
              className="rounded-lg border border-[#334155] bg-[#1e293b] p-3 flex flex-col gap-2"
            >
              <div className="flex items-start gap-2">
                <Icon className={`h-4 w-4 mt-0.5 flex-shrink-0 ${color}`} />
                <span className="text-sm font-medium text-white leading-tight">
                  {insight.title}
                </span>
              </div>
              <p className="text-xs text-[#94a3b8] leading-relaxed">
                {insight.description}
              </p>
              {/* Confidence bar */}
              <div className="w-full h-1 bg-[#334155] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#2563eb] rounded-full transition-all"
                  style={{ width: `${Math.round(insight.confidence * 100)}%` }}
                />
              </div>
              {/* Ask AI button */}
              <button
                onClick={() => onAskAi(insight.suggestedQuestion)}
                className="flex items-center gap-1 text-[11px] text-[#2563eb] hover:text-[#60a5fa] transition-colors self-start mt-auto"
              >
                <MessageSquare className="h-3 w-3" />
                Ask AI
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
