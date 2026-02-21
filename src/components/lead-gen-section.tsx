"use client";

import { useState, useEffect, useCallback } from "react";
import { LeadGenToggle } from "@/components/lead-gen-toggle";
import { FunnelChart } from "@/components/funnel-chart";
import type { FunnelStage } from "@/components/funnel-chart";
import { EnrichmentBoard } from "@/components/enrichment-board";
import type { EnrichmentStatus } from "@/components/enrichment-board";
import { ExportPanel } from "@/components/export-panel";
import type { TableProfile } from "@/lib/profiler";
import { detectContactCsv } from "@/lib/contact-detector";

interface LeadGenSectionProps {
  dashboardId: string;
  tableName: string;
  profile: TableProfile | undefined;
  leadGenMode: boolean;
  onModeChange: (mode: boolean) => void;
  onError: (error: string) => void;
  onRefresh: () => void;
}

export function LeadGenSection({
  dashboardId,
  tableName,
  profile,
  leadGenMode,
  onModeChange,
  onError,
  onRefresh,
}: LeadGenSectionProps) {
  const [classifying, setClassifying] = useState(false);
  const [classifyProgress, setClassifyProgress] = useState(0);
  const [funnelData, setFunnelData] = useState<FunnelStage[]>([]);
  const [enrichmentData, setEnrichmentData] = useState<EnrichmentStatus[]>([]);
  const [tierData, setTierData] = useState<{ tier: string; count: number }[]>(
    [],
  );
  const [contactDetection, setContactDetection] = useState<{
    confidence: number;
    titleColumn?: string;
  } | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return false;
    return (
      localStorage.getItem(`glyte-leadgen-dismissed-${dashboardId}`) === "1"
    );
  });

  // Detect contact CSV
  useEffect(() => {
    if (!profile || leadGenMode || dismissed || contactDetection) return;
    const columns = profile.columns.map((c) => c.name);
    const detection = detectContactCsv(columns);
    if (detection.isContact) {
      setContactDetection({
        confidence: detection.confidence,
        titleColumn: detection.titleColumn ?? undefined,
      });
    }
  }, [profile, leadGenMode, dismissed, contactDetection]);

  // Fetch lead gen stats
  useEffect(() => {
    if (!leadGenMode || !tableName) return;
    fetch(`/api/lead-gen-stats?table=${encodeURIComponent(tableName)}`)
      .then((res) => res.json())
      .then((stats) => {
        if (stats.funnel) setFunnelData(stats.funnel);
        if (stats.enrichment) setEnrichmentData(stats.enrichment);
        if (stats.tiers) setTierData(stats.tiers);
      })
      .catch((e) => console.error("Failed to fetch lead-gen stats:", e));
  }, [leadGenMode, tableName]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
    setContactDetection(null);
    localStorage.setItem(`glyte-leadgen-dismissed-${dashboardId}`, "1");
  }, [dashboardId]);

  const handleEnable = useCallback(async () => {
    if (!contactDetection?.titleColumn) return;
    setClassifying(true);
    setClassifyProgress(0);

    try {
      const companyCol = profile?.columns.find(
        (c) =>
          /company|org|employer/i.test(c.name) &&
          !/url|link|website/i.test(c.name),
      );

      const res = await fetch("/api/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tableName,
          titleColumn: contactDetection.titleColumn,
          companyColumn: companyCol?.name,
        }),
      });

      if (!res.ok) throw new Error("Classification failed");

      const reader = res.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop() || "";

        for (const part of parts) {
          if (!part.startsWith("data: ")) continue;
          let event;
          try {
            event = JSON.parse(part.slice(6));
          } catch (e) {
            console.error("Failed to parse SSE event:", e);
            continue;
          }
          if (event.type === "progress" && event.total) {
            setClassifyProgress(
              Math.round((event.processed / event.total) * 100),
            );
          }
          if (event.type === "complete") {
            completed = true;
            onModeChange(true);
            setContactDetection(null);
          }
          if (event.type === "error") {
            throw new Error(event.error || "Classification failed");
          }
        }
      }

      if (completed) {
        await fetch(`/api/dashboard/${dashboardId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            leadGenMode: true,
            classificationVersion: "v1.0",
          }),
        }).catch((e) =>
          console.error("Failed to persist leadGenMode:", e),
        );
      }

      onRefresh();
    } catch (err) {
      onError(String(err));
    } finally {
      setClassifying(false);
    }
  }, [
    contactDetection,
    profile,
    tableName,
    dashboardId,
    onModeChange,
    onError,
    onRefresh,
  ]);

  return (
    <>
      {/* Lead Gen Toggle */}
      {contactDetection && !leadGenMode && !classifying && (
        <LeadGenToggle
          confidence={contactDetection.confidence}
          titleColumn={contactDetection.titleColumn}
          onEnable={handleEnable}
          onDismiss={handleDismiss}
        />
      )}

      {/* Classification Progress */}
      {classifying && (
        <div className="mb-6 bg-[#1e293b] border border-[#334155] rounded-lg px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-[#cbd5e1]">Classifying contacts...</p>
            <span className="text-xs text-[#94a3b8]">
              {classifyProgress}%
            </span>
          </div>
          <div className="h-1.5 bg-[#0f1729] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2563eb] rounded-full transition-all duration-300"
              style={{ width: `${classifyProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Funnel */}
      {leadGenMode && funnelData.length > 0 && (
        <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-5 mb-6">
          <FunnelChart stages={funnelData} title="Lead Gen Funnel" />
        </div>
      )}

      {/* Data Health */}
      {leadGenMode && enrichmentData.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-gray-300 mb-3">
            Data Health
          </h3>
          <EnrichmentBoard
            statuses={enrichmentData}
            total={enrichmentData.reduce((sum, s) => sum + s.count, 0)}
            tableName={`${tableName}_enriched`}
          />
        </div>
      )}

      {/* Export */}
      {leadGenMode && (
        <ExportPanel
          tableName={`${tableName}_enriched`}
          tiers={tierData}
        />
      )}
    </>
  );
}
