"use client";

import { useState } from "react";
import { Download, ChevronDown, ChevronUp } from "lucide-react";

interface ExportPreset {
  label: string;
  description: string;
  filter: string;
}

interface ExportPanelProps {
  tableName: string;
}

const PRESETS: ExportPreset[] = [
  {
    label: "All ICP Contacts",
    description: "All classified contacts with ICP tier",
    filter: "icp_tier IS NOT NULL",
  },
  {
    label: "ICP with Email",
    description: "Ready for Clay email campaigns",
    filter: "icp_tier IS NOT NULL AND email IS NOT NULL AND email != ''",
  },
  {
    label: "ICP needs LinkedIn",
    description: "Needs LinkedIn enrichment (Apify/manual)",
    filter:
      "icp_tier IS NOT NULL AND (linkedinUrl IS NULL OR linkedinUrl = '')",
  },
  {
    label: "Tier 1 Only",
    description: "Decision makers (CEO, CFO, COO, MD, Founder)",
    filter: "icp_tier = 'Tier 1'",
  },
  {
    label: "Tier 1 + 1.5",
    description: "Decision makers + Payment/Finance owners",
    filter: "icp_tier IN ('Tier 1', 'Tier 1.5')",
  },
];

export function ExportPanel({ tableName }: ExportPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [customFilter, setCustomFilter] = useState("");

  const exportUrl = (filter: string) =>
    `/api/export?table=${encodeURIComponent(tableName)}&filter=${encodeURIComponent(filter)}`;

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
          <div className="flex flex-wrap gap-2 mt-3">
            {PRESETS.map((preset) => (
              <a
                key={preset.label}
                href={exportUrl(preset.filter)}
                download
                className="group flex items-center gap-1.5 px-3 py-1.5 bg-[#0f1729] border border-[#334155] rounded-md text-xs text-[#cbd5e1] hover:border-[#2563eb] hover:text-white transition-colors"
                title={preset.description}
              >
                <Download className="h-3 w-3 text-[#64748b] group-hover:text-[#2563eb]" />
                {preset.label}
              </a>
            ))}
          </div>

          <div className="mt-3 flex gap-2">
            <input
              type="text"
              value={customFilter}
              onChange={(e) => setCustomFilter(e.target.value)}
              placeholder="Custom SQL filter (e.g., icp_tier = 'Tier 1' AND email IS NOT NULL)"
              className="flex-1 bg-[#0f1729] border border-[#334155] rounded-md px-3 py-1.5 text-xs text-[#cbd5e1] placeholder:text-[#475569] focus:border-[#2563eb] focus:outline-none"
            />
            {customFilter && (
              <a
                href={exportUrl(customFilter)}
                download
                className="flex items-center gap-1 px-3 py-1.5 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-md text-xs font-medium transition-colors"
              >
                <Download className="h-3 w-3" />
                Export
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
