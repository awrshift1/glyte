"use client";

import { useState, useCallback, useMemo } from "react";
import { Download, ChevronDown, ChevronUp } from "lucide-react";

interface ExportPreset {
  id: string;
  label: string;
  description: string;
  count?: number;
}

interface TierInfo {
  tier: string;
  count: number;
}

interface ExportPanelProps {
  tableName: string;
  tiers?: TierInfo[];
}

// Tier name → preset ID mapping
const TIER_PRESET_MAP: Record<string, string> = {
  "Tier 1": "tier1",
  "Tier 1.5": "tier1.5",
  "Tier 2": "tier2",
  "Tier 3": "tier3",
  iGaming: "igaming",
  Board: "board",
};

// Fixed functional presets (always shown)
const FUNCTIONAL_PRESETS: ExportPreset[] = [
  {
    id: "icp",
    label: "All ICP Contacts",
    description: "All classified contacts with ICP tier",
  },
  {
    id: "icp-email",
    label: "ICP with Email",
    description: "Ready for Clay email campaigns",
  },
  {
    id: "icp-needs-linkedin",
    label: "ICP needs LinkedIn",
    description: "Needs LinkedIn enrichment",
  },
];

export function ExportPanel({ tableName, tiers = [] }: ExportPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);

  const presets = useMemo(() => {
    const result: ExportPreset[] = [...FUNCTIONAL_PRESETS];

    // Add "Tier 1 + 1.5" combo if both exist
    const hasTier1 = tiers.some((t) => t.tier === "Tier 1");
    const hasTier15 = tiers.some((t) => t.tier === "Tier 1.5");
    if (hasTier1 && hasTier15) {
      const combo =
        (tiers.find((t) => t.tier === "Tier 1")?.count ?? 0) +
        (tiers.find((t) => t.tier === "Tier 1.5")?.count ?? 0);
      result.push({
        id: "tier1+1.5",
        label: "Tier 1 + 1.5",
        description: "Decision makers + Payment/Finance owners",
        count: combo,
      });
    }

    // Add individual tier presets for each tier in the data
    for (const t of tiers) {
      const presetId = TIER_PRESET_MAP[t.tier];
      if (!presetId) continue;
      result.push({
        id: presetId,
        label: t.tier,
        description: `${t.count.toLocaleString()} contacts`,
        count: t.count,
      });
    }

    return result;
  }, [tiers]);

  const handleExport = useCallback(
    async (presetId: string) => {
      setDownloading(presetId);
      try {
        const res = await fetch("/api/export", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ table: tableName, preset: presetId }),
        });
        if (!res.ok) {
          const err = await res
            .json()
            .catch(() => ({ error: "Export failed" }));
          throw new Error(err.error || "Export failed");
        }
        const blob = await res.blob();
        const filename =
          res.headers.get("X-Filename") || `${tableName}_export.csv`;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } catch (e) {
        console.error("Export failed:", e);
      } finally {
        setDownloading(null);
      }
    },
    [tableName],
  );

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg overflow-hidden mb-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#334155]/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Download className="h-4 w-4 text-[#2563eb]" />
          <span className="text-sm font-medium text-[#cbd5e1]">
            Export Segments
          </span>
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-[#64748b]" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#64748b]" />
        )}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-[#334155]">
          {/* Functional presets */}
          <p className="text-[10px] text-[#64748b] uppercase tracking-wider mt-3 mb-2">
            By enrichment
          </p>
          <div className="flex flex-wrap gap-2">
            {presets
              .filter((p) => FUNCTIONAL_PRESETS.some((fp) => fp.id === p.id))
              .map((preset) => (
                <PresetButton
                  key={preset.id}
                  preset={preset}
                  downloading={downloading}
                  onExport={handleExport}
                />
              ))}
          </div>

          {/* Tier presets */}
          {presets.some(
            (p) => !FUNCTIONAL_PRESETS.some((fp) => fp.id === p.id),
          ) && (
            <>
              <p className="text-[10px] text-[#64748b] uppercase tracking-wider mt-4 mb-2">
                By tier
              </p>
              <div className="flex flex-wrap gap-2">
                {presets
                  .filter(
                    (p) => !FUNCTIONAL_PRESETS.some((fp) => fp.id === p.id),
                  )
                  .map((preset) => (
                    <PresetButton
                      key={preset.id}
                      preset={preset}
                      downloading={downloading}
                      onExport={handleExport}
                    />
                  ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function PresetButton({
  preset,
  downloading,
  onExport,
}: {
  preset: ExportPreset;
  downloading: string | null;
  onExport: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onExport(preset.id)}
      disabled={downloading === preset.id}
      className="group flex items-center gap-1.5 px-3 py-1.5 bg-[#0f1729] border border-[#334155] rounded-md text-xs text-[#cbd5e1] hover:border-[#2563eb] hover:text-white transition-colors disabled:opacity-50"
      title={preset.description}
    >
      <Download className="h-3 w-3 text-[#64748b] group-hover:text-[#2563eb]" />
      {downloading === preset.id ? "..." : preset.label}
      {preset.count !== undefined && (
        <span className="text-[10px] text-[#64748b]">
          ({preset.count.toLocaleString()})
        </span>
      )}
    </button>
  );
}
