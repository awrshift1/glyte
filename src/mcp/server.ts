#!/usr/bin/env npx tsx
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { readdir, readFile } from "fs/promises";
import path from "path";
import type { DashboardConfig } from "../types/dashboard";
import {
  GLYTE_TOOLS,
  formatResult,
  formatError,
  formatDashboardSummary,
  formatDashboardDetails,
} from "./tools";

const BASE_URL = process.env.GLYTE_URL || "http://localhost:3000";
const DATA_DIR = process.env.GLYTE_DATA_DIR || path.join(process.cwd(), "data", "dashboards");

async function loadDashboards(): Promise<DashboardConfig[]> {
  try {
    const files = await readdir(DATA_DIR);
    const dashboards: DashboardConfig[] = [];
    for (const file of files.filter((f) => f.endsWith(".json"))) {
      const content = await readFile(path.join(DATA_DIR, file), "utf-8");
      dashboards.push(JSON.parse(content));
    }
    return dashboards;
  } catch {
    return [];
  }
}

async function loadDashboard(id: string): Promise<DashboardConfig | null> {
  try {
    const content = await readFile(path.join(DATA_DIR, `${id}.json`), "utf-8");
    return JSON.parse(content);
  } catch {
    return null;
  }
}

async function queryViaApi(dashboardId: string, sql: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/api/dashboard/${dashboardId}/query`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sql }),
  });
  return res.json();
}

async function askViaApi(dashboardId: string, question: string): Promise<unknown> {
  const res = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dashboardId, question }),
  });
  return res.json();
}

const server = new Server(
  {
    name: "glyte",
    version: "2.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: GLYTE_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case "list_dashboards": {
      const dashboards = await loadDashboards();
      return formatResult({
        count: dashboards.length,
        dashboards: dashboards.map(formatDashboardSummary),
      });
    }

    case "get_dashboard": {
      const id = (args as { dashboardId: string }).dashboardId;
      const config = await loadDashboard(id);
      if (!config) return formatError(`Dashboard '${id}' not found`);
      return formatResult(formatDashboardDetails(config));
    }

    case "query_dashboard": {
      const { dashboardId, sql } = args as { dashboardId: string; sql: string };
      if (!/^\s*SELECT\b/i.test(sql)) {
        return formatError("Only SELECT queries are allowed");
      }
      try {
        const result = await queryViaApi(dashboardId, sql);
        return formatResult(result);
      } catch (e) {
        return formatError(`Query failed: ${e}`);
      }
    }

    case "ask_dashboard": {
      const { dashboardId, question } = args as { dashboardId: string; question: string };
      try {
        const result = await askViaApi(dashboardId, question);
        return formatResult(result);
      } catch (e) {
        return formatError(`Ask failed: ${e}`);
      }
    }

    default:
      return formatError(`Unknown tool: ${name}`);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Glyte MCP server running on stdio");
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
