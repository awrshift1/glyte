"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";

export interface ColumnInfo {
  name: string;
  type: string;
}

export interface TableNodeData {
  label: string;
  columns: ColumnInfo[];
  accent?: "blue" | "green";
  connectedColumns?: Set<string>;
}

const TYPE_COLORS: Record<string, string> = {
  integer: "text-emerald-400",
  int: "text-emerald-400",
  bigint: "text-emerald-400",
  varchar: "text-slate-500",
  text: "text-slate-500",
  decimal: "text-slate-500",
  double: "text-slate-500",
  float: "text-slate-500",
  date: "text-slate-500",
  timestamp: "text-slate-500",
  boolean: "text-amber-400",
};

function getTypeColor(type: string): string {
  const lower = type.toLowerCase();
  return TYPE_COLORS[lower] ?? "text-slate-500";
}

function getTypeIcon(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes("int") || lower.includes("bigint")) return "🔑";
  if (lower.includes("date") || lower.includes("timestamp")) return "📅";
  if (lower.includes("decimal") || lower.includes("float") || lower.includes("double")) return "🔢";
  if (lower.includes("bool")) return "✓";
  return "Aa";
}

function TableNodeComponent({ data, selected }: NodeProps & { data: TableNodeData }) {
  const accent = data.accent ?? "green";
  const accentBar = accent === "blue" ? "bg-[#3b82f6]" : "bg-emerald-500";
  const connectedCols = data.connectedColumns ?? new Set<string>();

  return (
    <div
      className={`
        min-w-[260px] max-w-[320px] bg-[#1e293b] rounded-xl border shadow-xl
        ${selected
          ? "border-[#2563eb]/50 ring-1 ring-[#2563eb]/20 shadow-[#2563eb]/10"
          : "border-[#334155] shadow-black/20"
        }
      `}
    >
      {/* Header */}
      <div className={`flex items-center gap-3 p-3 border-b border-[#334155]/50 rounded-t-xl ${selected ? "bg-[#2563eb]/10" : "bg-[#1e293b]"}`}>
        <div className={`w-1.5 h-4 rounded-full ${accentBar}`} />
        <h3 className="text-white font-bold text-sm truncate">{data.label}</h3>
      </div>

      {/* Columns */}
      <div className="flex flex-col py-1">
        {data.columns.map((col) => {
          const isConnected = connectedCols.has(col.name);
          return (
            <div
              key={col.name}
              className={`relative flex items-center justify-between px-3 py-1.5 group/row transition-colors
                ${isConnected ? "bg-[#1e293b]/80" : "hover:bg-[#334155]/30"}
              `}
            >
              {/* Left handle (target) */}
              <Handle
                type="target"
                position={Position.Left}
                id={`${col.name}-target`}
                className={`
                  !w-3 !h-3 !rounded-full !border-2 !border-[#1e293b] !-left-1.5
                  ${isConnected
                    ? "!bg-[#2563eb] !opacity-100 shadow-[0_0_8px_rgba(37,99,235,0.6)]"
                    : "!bg-[#475569] !opacity-0 group-hover/row:!opacity-100"
                  }
                `}
              />

              <div className="flex items-center gap-2 min-w-0">
                <span className="text-[11px] text-slate-600 w-5 text-center shrink-0">{getTypeIcon(col.type)}</span>
                <span className={`text-sm truncate ${isConnected ? "text-slate-200" : "text-slate-300"}`}>{col.name}</span>
              </div>

              <span className={`text-[10px] font-mono uppercase ml-2 shrink-0 ${isConnected ? getTypeColor(col.type) : "text-slate-600"}`}>
                {col.type.split("(")[0]}
              </span>

              {/* Right handle (source) */}
              <Handle
                type="source"
                position={Position.Right}
                id={`${col.name}-source`}
                className={`
                  !w-3 !h-3 !rounded-full !border-2 !border-[#1e293b] !-right-1.5
                  ${isConnected
                    ? "!bg-[#2563eb] !opacity-100 shadow-[0_0_8px_rgba(37,99,235,0.6)]"
                    : "!bg-[#475569] !opacity-0 group-hover/row:!opacity-100"
                  }
                `}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const TableNode = memo(TableNodeComponent);
