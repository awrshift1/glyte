"use client";

import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const COLORS = ["#2563eb", "#22c55e", "#06b6d4", "#eab308", "#a855f7"];

interface SidebarChartProps {
  data: Record<string, unknown>[];
  chartType: string;
  chartConfig: {
    type: string;
    xKey?: string;
    yKeys?: string[];
  };
}

export function SidebarChart({ data, chartType, chartConfig }: SidebarChartProps) {
  const { xKey, yKeys = [] } = chartConfig;

  if (chartType === "kpi" && data.length === 1) {
    const [key, val] = Object.entries(data[0])[0];
    return (
      <div className="rounded-lg border border-[#334155] bg-[#1e293b] p-4 text-center">
        <p className="text-xs text-[#94a3b8]">{key}</p>
        <p className="mt-1 text-2xl font-bold text-[#f8fafc]">
          {typeof val === "number" ? val.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(val)}
        </p>
      </div>
    );
  }

  if (chartType === "kpi-row" && data.length === 1) {
    return (
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(data[0]).map(([key, val]) => (
          <div key={key} className="rounded-lg border border-[#334155] bg-[#1e293b] p-3">
            <p className="text-[10px] text-[#94a3b8]">{key}</p>
            <p className="mt-0.5 text-lg font-bold text-[#f8fafc]">
              {typeof val === "number" ? val.toLocaleString("en-US", { maximumFractionDigits: 2 }) : String(val)}
            </p>
          </div>
        ))}
      </div>
    );
  }

  if (chartType === "bar" && xKey) {
    return (
      <ResponsiveContainer width="100%" height={Math.min(200, Math.max(120, data.length * 30))}>
        <BarChart data={data} layout="vertical" margin={{ left: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" horizontal={false} />
          <XAxis type="number" stroke="#94a3b8" fontSize={10} />
          <YAxis type="category" dataKey={xKey} stroke="#94a3b8" fontSize={9} width={90} />
          <Tooltip
            wrapperStyle={{ pointerEvents: 'none' }}
            contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f8fafc", fontSize: 11 }}
            labelStyle={{ color: "#cbd5e1" }}
            cursor={{ fill: "rgba(148, 163, 184, 0.08)" }}
          />
          {yKeys.map((key, i) => (
            <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[0, 4, 4, 0]} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === "line" && xKey) {
    return (
      <ResponsiveContainer width="100%" height={180}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
          <XAxis dataKey={xKey} stroke="#94a3b8" fontSize={10} />
          <YAxis stroke="#94a3b8" fontSize={10} />
          <Tooltip
            wrapperStyle={{ pointerEvents: 'none' }}
            contentStyle={{ backgroundColor: "#1e293b", border: "1px solid #334155", borderRadius: 8, color: "#f8fafc", fontSize: 11 }}
            labelStyle={{ color: "#cbd5e1" }}
            cursor={{ stroke: "rgba(148, 163, 184, 0.2)", strokeWidth: 1 }}
          />
          {yKeys.map((key, i) => (
            <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  return null;
}
