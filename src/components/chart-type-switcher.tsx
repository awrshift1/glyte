"use client";

import { useState, useRef, useEffect } from "react";
import {
  BarChart3,
  LineChart,
  PieChart,
  Table2,
  LayoutList,
  Check,
} from "lucide-react";
import type { ChartType, ChartData } from "@/types/dashboard";

// Switchable visual types (KPIs excluded — different data shape)
const VISUAL_TYPES: {
  type: ChartType;
  label: string;
  icon: typeof BarChart3;
}[] = [
  { type: "bar", label: "Bar Chart", icon: BarChart3 },
  { type: "line", label: "Line Chart", icon: LineChart },
  { type: "horizontal-bar", label: "Horizontal Bar", icon: LayoutList },
  { type: "donut", label: "Donut Chart", icon: PieChart },
  { type: "table", label: "Table", icon: Table2 },
];

function getCompatibleTypes(chart: ChartData) {
  const { data, xColumn: xCol, yColumns: yCols = [] } = chart;

  if (!data || data.length === 0) {
    return VISUAL_TYPES.map((t) => ({
      ...t,
      compatible: t.type === "table",
      reason: t.type !== "table" ? "No data available" : undefined,
    }));
  }

  const firstRow = data[0];

  // Detect temporal X (ISO date pattern)
  let hasTemporalX = false;
  if (xCol && firstRow[xCol] != null) {
    hasTemporalX = /^\d{4}-\d{2}-\d{2}/.test(String(firstRow[xCol]));
  }

  const hasCategoricalX = !!xCol && !hasTemporalX;
  const hasXAxis = hasTemporalX || hasCategoricalX;

  const hasNumericY = yCols.some((col) => {
    const val = firstRow[col];
    return (
      typeof val === "number" ||
      (typeof val === "string" && !isNaN(Number(val)))
    );
  });

  const categoryCount = xCol
    ? new Set(data.map((row) => String(row[xCol]))).size
    : 0;

  return VISUAL_TYPES.map((t) => {
    switch (t.type) {
      case "line":
      case "bar":
        return {
          ...t,
          compatible: hasXAxis && hasNumericY,
          reason: !hasXAxis
            ? "Requires X axis column"
            : !hasNumericY
              ? "Requires numeric Y axis"
              : undefined,
        };
      case "horizontal-bar":
        return {
          ...t,
          compatible: hasCategoricalX && hasNumericY,
          reason: !hasCategoricalX
            ? "Requires categorical X axis"
            : !hasNumericY
              ? "Requires numeric Y axis"
              : undefined,
        };
      case "donut":
        return {
          ...t,
          compatible:
            hasCategoricalX &&
            hasNumericY &&
            categoryCount >= 2 &&
            categoryCount <= 15,
          reason: !hasCategoricalX
            ? "Requires categorical data"
            : !hasNumericY
              ? "Requires numeric values"
              : categoryCount < 2
                ? "Need at least 2 categories"
                : categoryCount > 15
                  ? "Too many categories (max 15)"
                  : undefined,
        };
      case "table":
        return { ...t, compatible: true, reason: undefined };
      default:
        return { ...t, compatible: false, reason: "Unknown type" };
    }
  });
}

interface ChartTypeSwitcherProps {
  chart: ChartData;
  currentType: ChartType;
  onTypeChange: (newType: ChartType) => void;
}

export function ChartTypeSwitcher({
  chart,
  currentType,
  onTypeChange,
}: ChartTypeSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const compatibleTypes = getCompatibleTypes(chart);
  const currentConfig = VISUAL_TYPES.find((t) => t.type === currentType);
  const CurrentIcon = currentConfig?.icon ?? BarChart3;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1 rounded-md bg-[#0f1729]/80 border border-[#334155] text-[#94a3b8] hover:text-white hover:border-[#2563eb]/50 hover:bg-[#2563eb]/10 transition-all"
        title="Change chart type"
      >
        <CurrentIcon className="h-3.5 w-3.5" />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 z-50 bg-[#1e293b] border border-[#334155] rounded-lg shadow-xl min-w-[180px] py-1">
          {compatibleTypes.map((item) => {
            const Icon = item.icon;
            const isActive = item.type === currentType;
            return (
              <button
                key={item.type}
                onClick={() => {
                  if (item.compatible && !isActive) {
                    onTypeChange(item.type);
                    setIsOpen(false);
                  }
                }}
                disabled={!item.compatible}
                title={item.reason}
                className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left transition-colors ${
                  isActive
                    ? "bg-[#2563eb]/20 text-[#60a5fa]"
                    : item.compatible
                      ? "text-gray-300 hover:bg-[#334155] hover:text-white"
                      : "text-gray-600 cursor-not-allowed"
                }`}
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <Check className="h-3.5 w-3.5 text-[#60a5fa]" />
                )}
                {!item.compatible && item.reason && (
                  <span className="text-[10px] text-gray-600 max-w-[80px] truncate">
                    {item.reason}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
