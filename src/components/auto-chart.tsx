"use client";

import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import type { ChartData } from "@/types/dashboard";
import { useFilterStore } from "@/store/filters";

const COLORS = ["#2563eb", "#06b6d4", "#22c55e", "#eab308", "#f97316", "#a855f7", "#ef4444", "#ec4899"];

// Stable color map for ICP tier values (design system)
const TIER_COLORS: Record<string, string> = {
  "Tier 1": "#3b82f6",
  "Tier 1.5": "#06b6d4",
  "Tier 2": "#22c55e",
  "Tier 3": "#eab308",
  "Board": "#a855f7",
  "iGaming": "#f97316",
};

function resolveColor(value: unknown, index: number): string {
  const color = TIER_COLORS[String(value)];
  return color ?? COLORS[index % COLORS.length];
}

interface AutoChartProps {
  chart: ChartData;
}

export function AutoChart({ chart }: AutoChartProps) {
  const { type, data, xColumn, yColumns, groupBy } = chart;

  if (!data || data.length === 0) {
    return <EmptyState title={chart.title} />;
  }

  switch (type) {
    case "line":
      return <LineChartWidget data={data} xColumn={xColumn!} yColumns={yColumns!} />;
    case "bar":
      return <BarChartWidget chartId={chart.id} data={data} xColumn={xColumn!} yColumns={yColumns!} groupBy={groupBy} />;
    case "horizontal-bar":
      return <HorizontalBarWidget chartId={chart.id} data={data} xColumn={xColumn!} yColumns={yColumns!} />;
    case "donut":
      return <DonutWidget chartId={chart.id} data={data} xColumn={xColumn!} yColumns={yColumns!} />;
    case "table":
      return <TableWidget data={data} />;
    default:
      return <EmptyState title={`Unknown chart type: ${type}`} />;
  }
}

function LineChartWidget({ data, xColumn, yColumns }: { data: Record<string, unknown>[]; xColumn: string; yColumns: string[] }) {
  const formatted = data.map((row) => ({
    ...row,
    [xColumn]: formatDateLabel(String(row[xColumn])),
  }));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={formatted}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey={xColumn} stroke="#94a3b8" fontSize={12} />
        <YAxis stroke="#94a3b8" fontSize={12} />
        <Tooltip wrapperStyle={{ pointerEvents: 'none' }} contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f8fafc" }} labelStyle={{ color: "#cbd5e1" }} itemStyle={{ color: '#e2e8f0' }} cursor={{ stroke: "rgba(148, 163, 184, 0.2)", strokeWidth: 1 }} />
        <Legend formatter={(value: string) => <span style={{ color: '#94a3b8' }}>{value}</span>} />
        {yColumns.map((col, i) => (
          <Line key={col} type="monotone" dataKey={col} stroke={COLORS[i]} strokeWidth={2} dot={false} />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}

 
function getPayload(entry: any): Record<string, unknown> | null {
  if (!entry) return null;
  // Recharts Bar onClick passes the data entry directly
  if (entry.payload) return entry.payload as Record<string, unknown>;
  return entry as Record<string, unknown>;
}

function BarChartWidget({ chartId, data, xColumn, yColumns, groupBy }: { chartId: string; data: Record<string, unknown>[]; xColumn: string; yColumns: string[]; groupBy?: string }) {
  const { addFilter } = useFilterStore();

  if (groupBy) {
    const pivoted = pivotData(data, xColumn, groupBy, yColumns[0]);
    const groups = [...new Set(data.map((r) => String(r[groupBy])))];
    return (
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={pivoted} margin={{ bottom: 60 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey={xColumn} stroke="#94a3b8" fontSize={11} interval={0} angle={-40} textAnchor="end" tickFormatter={(v: string) => v && v.length > 18 ? v.slice(0, 18) + "…" : v} />
          <YAxis stroke="#94a3b8" fontSize={12} />
          <Tooltip wrapperStyle={{ pointerEvents: 'none' }} contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f8fafc" }} labelStyle={{ color: "#cbd5e1" }} itemStyle={{ color: '#e2e8f0' }} cursor={{ fill: "rgba(148, 163, 184, 0.08)" }} />
          <Legend formatter={(value: string) => <span style={{ color: '#94a3b8' }}>{value}</span>} />
          {groups.map((g, i) => (
            <Bar
              key={g}
              dataKey={g}
              fill={COLORS[i % COLORS.length]}
              radius={[4, 4, 0, 0]}
              className="cursor-pointer"
              onClick={(entry) => {
                const p = getPayload(entry);
                if (p?.[xColumn]) addFilter({ column: xColumn, value: String(p[xColumn]), source: chartId });
              }}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={data.length > 8 ? 320 : 280}>
      <BarChart data={data} margin={data.length > 8 ? { bottom: 60 } : undefined}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis dataKey={xColumn} stroke="#94a3b8" fontSize={data.length > 8 ? 11 : 12} interval={0} angle={data.length > 8 ? -40 : 0} textAnchor={data.length > 8 ? "end" : "middle"} tickFormatter={(v: string) => v && v.length > 18 ? v.slice(0, 18) + "…" : v} />
        <YAxis stroke="#94a3b8" fontSize={12} />
        <Tooltip wrapperStyle={{ pointerEvents: 'none' }} contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f8fafc" }} labelStyle={{ color: "#cbd5e1" }} itemStyle={{ color: '#e2e8f0' }} cursor={{ fill: "rgba(148, 163, 184, 0.08)" }} />
        {yColumns.map((col, i) => (
          <Bar
            key={col}
            dataKey={col}
            fill={COLORS[i]}
            radius={[4, 4, 0, 0]}
            maxBarSize={48}
            className="cursor-pointer"
            onClick={(entry) => {
              const p = getPayload(entry);
              if (p?.[xColumn]) addFilter({ column: xColumn, value: String(p[xColumn]), source: chartId });
            }}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function HorizontalBarWidget({ chartId, data, xColumn, yColumns }: { chartId: string; data: Record<string, unknown>[]; xColumn: string; yColumns: string[] }) {
  const { addFilter } = useFilterStore();
  const barHeight = Math.min(280, Math.max(100, data.length * 40 + 40));

  return (
    <ResponsiveContainer width="100%" height={barHeight}>
      <BarChart data={data} layout="vertical" barSize={24} margin={{ right: 45 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
        <XAxis type="number" stroke="#94a3b8" fontSize={12} />
        <YAxis dataKey={xColumn} type="category" stroke="#94a3b8" fontSize={11} width={130} tickFormatter={(v: string) => v && v.length > 20 ? v.slice(0, 20) + "…" : v} />
        <Tooltip wrapperStyle={{ pointerEvents: 'none' }} contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f8fafc" }} labelStyle={{ color: "#cbd5e1" }} itemStyle={{ color: '#e2e8f0' }} cursor={{ fill: "rgba(148, 163, 184, 0.08)" }} />
        {yColumns.map((col) => (
          <Bar
            key={col}
            dataKey={col}
            radius={[0, 4, 4, 0]}
            maxBarSize={28}
            className="cursor-pointer"
            onClick={(entry) => {
              const p = getPayload(entry);
              if (p?.[xColumn]) addFilter({ column: xColumn, value: String(p[xColumn]), source: chartId });
            }}
          >
            {data.map((row, i) => (
              <Cell key={i} fill={resolveColor(row[xColumn], i)} />
            ))}
            <LabelList dataKey={col} position="right" fill="#94a3b8" fontSize={11} formatter={(v) => { const n = Number(v); return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : n; }} />
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

function DonutWidget({ chartId, data, xColumn, yColumns }: { chartId: string; data: Record<string, unknown>[]; xColumn: string; yColumns: string[] }) {
  const { addFilter } = useFilterStore();

  return (
    <ResponsiveContainer width="100%" height={280}>
      <PieChart>
        <Pie
          data={data}
          dataKey={yColumns[0]}
          nameKey={xColumn}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          strokeWidth={0}
          onClick={(entry) => {
            if (entry?.[xColumn]) {
              addFilter({ column: xColumn, value: String(entry[xColumn]), source: chartId });
            }
          }}
          className="cursor-pointer"
        >
          {data.map((row, i) => (
            <Cell key={i} fill={resolveColor(row[xColumn], i)} />
          ))}
        </Pie>
        <Tooltip wrapperStyle={{ pointerEvents: 'none' }} contentStyle={{ background: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f8fafc" }} labelStyle={{ color: "#cbd5e1" }} itemStyle={{ color: '#e2e8f0' }} />
        <Legend formatter={(value: string) => <span style={{ color: '#94a3b8' }}>{value}</span>} />
      </PieChart>
    </ResponsiveContainer>
  );
}

function TableWidget({ data }: { data: Record<string, unknown>[] }) {
  if (data.length === 0) return null;
  const columns = Object.keys(data[0]);

  return (
    <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-[#1e293b]">
          <tr className="border-b border-[#334155]">
            {columns.map((col) => (
              <th key={col} className="text-left py-2 px-3 text-gray-400 font-medium whitespace-nowrap">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.slice(0, 50).map((row, i) => (
            <tr key={i} className={i % 2 === 0 ? "bg-[#1e293b]" : "bg-[#162032]"}>
              {columns.map((col) => (
                <td key={col} className="py-2 px-3 text-gray-300 whitespace-nowrap">
                  {formatCellValue(row[col])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function EmptyState({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-center h-[280px] text-gray-400">
      {title}
    </div>
  );
}

function formatDateLabel(val: string): string {
  if (/^\d{4}-\d{2}-\d{2}/.test(val)) {
    const d = new Date(val);
    return d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
  }
  return val;
}

function formatCellValue(val: unknown): string {
  if (val === null || val === undefined) return "-";
  if (typeof val === "number") return val.toLocaleString();
  return String(val);
}

function pivotData(
  data: Record<string, unknown>[],
  xCol: string,
  groupCol: string,
  valueCol: string
): Record<string, unknown>[] {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of data) {
    const x = String(row[xCol]);
    const g = String(row[groupCol]);
    const v = Number(row[valueCol]);
    if (!map.has(x)) map.set(x, { [xCol]: x });
    map.get(x)![g] = v;
  }
  return Array.from(map.values());
}
