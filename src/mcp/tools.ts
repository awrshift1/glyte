import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { DashboardConfig } from "../types/dashboard";

export const GLYTE_TOOLS = [
  {
    name: "list_dashboards",
    description: "List all available dashboards with their IDs, titles, row counts, and column info.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "get_dashboard",
    description: "Get detailed info about a dashboard including its schema, column profiles, and chart configurations.",
    inputSchema: {
      type: "object" as const,
      properties: {
        dashboardId: {
          type: "string",
          description: "The dashboard ID (e.g., 'dash-1738900000000')",
        },
      },
      required: ["dashboardId"],
    },
  },
  {
    name: "query_dashboard",
    description: "Execute a SELECT SQL query against a dashboard's data. Only SELECT statements are allowed.",
    inputSchema: {
      type: "object" as const,
      properties: {
        dashboardId: {
          type: "string",
          description: "The dashboard ID to query",
        },
        sql: {
          type: "string",
          description: "DuckDB-compatible SELECT SQL query",
        },
      },
      required: ["dashboardId", "sql"],
    },
  },
  {
    name: "ask_dashboard",
    description: "Ask a natural language question about a dashboard's data. Uses AI to generate and execute SQL.",
    inputSchema: {
      type: "object" as const,
      properties: {
        dashboardId: {
          type: "string",
          description: "The dashboard ID to query",
        },
        question: {
          type: "string",
          description: "Natural language question about the data",
        },
      },
      required: ["dashboardId", "question"],
    },
  },
];

export function formatResult(data: unknown): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

export function formatError(message: string): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message }) }],
    isError: true,
  };
}

export function formatDashboardSummary(config: DashboardConfig): Record<string, unknown> {
  return {
    id: config.id,
    title: config.title,
    tableName: config.tableName,
    rowCount: config.rowCount,
    columnCount: config.columnCount,
    chartCount: config.charts.length,
    createdAt: config.createdAt,
  };
}

export function formatDashboardDetails(config: DashboardConfig): Record<string, unknown> {
  return {
    ...formatDashboardSummary(config),
    columns: config.profile?.columns.map((col) => ({
      name: col.name,
      type: col.type,
      distinctCount: col.distinctCount,
      sampleValues: col.sampleValues,
      ...(col.type === "numeric" ? { min: col.min, max: col.max, mean: col.mean } : {}),
      ...(col.type === "temporal" ? { min: col.min, max: col.max } : {}),
    })),
    charts: config.charts.map((c) => ({
      type: c.type,
      title: c.title,
    })),
  };
}
