"use client";

import { useMemo } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import type { ColumnProfile } from "@/lib/profiler";

// Client-side mirror of isIdentifier from contact-pipeline.ts:18-29
const ID_PATTERN = /^(id|uuid|_id|key)$/i;
const URL_PATTERN = /url|link|linkedin|website|href/i;
const CONTACT_PATTERN = /^(email|name|first.?name|last.?name|full.?name|phone|contact)$/i;
const FREETEXT_PATTERN = /^(description|bio|summary|notes?|comment|about|message|body|text)$/i;

function isDimension(col: ColumnProfile, rowCount: number): boolean {
  if (col.type !== "categorical" && col.type !== "text") return false;
  if (ID_PATTERN.test(col.name)) return false;
  if (URL_PATTERN.test(col.name)) return false;
  if (CONTACT_PATTERN.test(col.name)) return false;
  if (FREETEXT_PATTERN.test(col.name)) return false;
  if (col.distinctCount < 2) return false;
  if (col.distinctCount > rowCount * 0.8) return false;
  const nonNull = col.totalCount - col.nullCount;
  if (nonNull > 0 && nonNull < rowCount * 0.1) return false;
  return true;
}

function formatTitle(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface DimensionPillsProps {
  columns: ColumnProfile[];
  rowCount: number;
}

export function DimensionPills({ columns, rowCount }: DimensionPillsProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const activeDim = searchParams.get("dim");

  const dimensions = useMemo(
    () => columns.filter((c) => isDimension(c, rowCount)),
    [columns, rowCount],
  );

  if (dimensions.length === 0) return null;

  const toggle = (colName: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (activeDim === colName) {
      params.delete("dim");
    } else {
      params.set("dim", colName);
    }
    const qs = params.toString();
    router.replace(`${pathname}${qs ? "?" + qs : ""}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <span className="text-xs text-[#64748b] font-medium mr-1">Explore:</span>
      {dimensions.map((col) => {
        const active = activeDim === col.name;
        const badge = col.distinctCount <= 20
          ? `${col.distinctCount} val`
          : "Top 10";

        return (
          <button
            key={col.name}
            onClick={() => toggle(col.name)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              active
                ? "bg-[#2563eb]/20 text-[#60a5fa] border-[#2563eb]/30"
                : "bg-[#1e293b] text-[#94a3b8] border-[#334155] hover:bg-[#334155] hover:text-[#cbd5e1]"
            }`}
          >
            {formatTitle(col.name)}
            <span className={`text-[10px] ${active ? "text-[#60a5fa]/70" : "text-[#64748b]"}`}>
              {badge}
            </span>
          </button>
        );
      })}
    </div>
  );
}
