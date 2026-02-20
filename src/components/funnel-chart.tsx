"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer,
} from "recharts";

export interface FunnelStage {
  label: string;
  value: number;
  color: string;
}

interface FunnelChartProps {
  stages: FunnelStage[];
  title?: string;
}

export function FunnelChart({ stages, title }: FunnelChartProps) {
  if (!stages || stages.length === 0) {
    return (
      <div className="flex items-center justify-center h-[280px] text-gray-400">
        No funnel data
      </div>
    );
  }

  const total = stages[0]?.value || 1;
  const data = stages.map((stage) => ({
    name: stage.label,
    value: stage.value,
    percentage: Math.round((stage.value / total) * 100),
    color: stage.color,
  }));

  return (
    <div>
      {title && (
        <h3 className="text-sm font-medium text-gray-300 mb-4">{title}</h3>
      )}
      <ResponsiveContainer width="100%" height={stages.length * 52 + 20}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ left: 120, right: 80 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#334155"
            horizontal={false}
          />
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fill: "#94a3b8", fontSize: 12 }}
            width={110}
          />
          <Tooltip
            contentStyle={{
              background: "#1e293b",
              border: "1px solid #334155",
              borderRadius: 8,
              color: "#cbd5e1",
            }}
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            formatter={((value: number, _name: string, props: any) => [
              `${value.toLocaleString()} (${props.payload.percentage}%)`,
              "Count",
            ]) as any}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={28}>
            {data.map((entry, index) => (
              <Cell key={index} fill={entry.color} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 mt-3 px-2">
        {data.slice(1).map((stage) => (
          <span key={stage.name} className="text-[11px] text-[#94a3b8]">
            {stage.name}:{" "}
            <span className="text-white font-medium">
              {stage.percentage}%
            </span>{" "}
            of total
          </span>
        ))}
      </div>
    </div>
  );
}
