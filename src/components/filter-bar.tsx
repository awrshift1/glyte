"use client";

import { X } from "lucide-react";
import { useFilterStore } from "@/store/filters";

export function FilterBar() {
  const { filters, removeFilter, clearAll } = useFilterStore();

  if (filters.length === 0) return null;

  return (
    <div className="flex items-center gap-2 mb-4 flex-wrap">
      <span className="text-xs text-gray-400 uppercase tracking-wide">Filters:</span>
      {filters.map((f) => (
        <button
          key={f.column}
          onClick={() => removeFilter(f.column)}
          className="flex items-center gap-1 px-3 py-1 text-sm bg-[#2563eb]/20 text-[#60a5fa] border border-[#2563eb]/30 rounded-full hover:bg-[#2563eb]/30 transition-colors"
        >
          <span className="text-gray-400">{f.column}:</span>
          <span>{f.value}</span>
          <X className="w-3 h-3 ml-1" />
        </button>
      ))}
      <button
        onClick={clearAll}
        className="text-xs text-gray-400 hover:text-white transition-colors ml-2"
      >
        Clear all
      </button>
    </div>
  );
}
