import { readFile, writeFile } from "fs/promises";
import path from "path";
import { ensureTable, query, ingestCsv, appendCsv, backfillSource, dropTable } from "./duckdb";
import { quoteLiteral } from "./sql-utils";
import { profileTable } from "./profiler";
import fs from "fs";
import { recommendCharts } from "./chart-recommender";
import type { DashboardConfig } from "@/types/dashboard";

const DASHBOARDS_DIR = path.join(process.cwd(), "data", "dashboards");

/**
 * Task #10: Sanitize dashboard ID to prevent path traversal.
 * Only allows: dash-{digits} format.
 */
export function sanitizeDashboardId(id: string): string {
  if (!/^dash-\d+$/.test(id)) {
    throw new Error("Invalid dashboard ID");
  }
  return id;
}

/**
 * Task #12: Generate safe filename for uploads (no path traversal).
 */
export function safeUploadFilename(originalName: string): string {
  const ext = path.extname(originalName).toLowerCase();
  const safeName = `upload-${Date.now()}${ext}`;
  return safeName;
}

/**
 * Task #11: Build WHERE clause with column whitelist validation.
 * Only allows columns that exist in the dashboard profile.
 */
export function buildSafeWhereClause(
  filterParams: string[],
  config: DashboardConfig,
  dateRange?: { col: string; from?: string; to?: string }
): { clause: string; valid: boolean } {
  const validColumns = new Set(
    config.profile?.columns.map((c) => c.name) ?? []
  );

  const conditions: string[] = [];
  for (const f of filterParams) {
    const [col, ...valueParts] = f.split(":");
    if (!validColumns.has(col)) continue; // skip invalid columns silently
    const value = valueParts.join(":").replace(/'/g, "''").replace(/\\/g, "\\\\");
    // Column name is validated against whitelist, safe to use in quotes
    conditions.push(`"${col}" = '${value}'`);
  }

  // Date range filter
  if (dateRange?.col && validColumns.has(dateRange.col)) {
    const col = dateRange.col;
    if (dateRange.from) {
      const from = dateRange.from.replace(/'/g, "''");
      conditions.push(`"${col}" >= '${from}'`);
    }
    if (dateRange.to) {
      const to = dateRange.to.replace(/'/g, "''");
      conditions.push(`"${col}" <= '${to}'`);
    }
  }

  if (conditions.length === 0) return { clause: "", valid: true };
  return { clause: conditions.join(" AND "), valid: true };
}

/**
 * Task #19: Shared dashboard loading logic (DRY).
 * Loads config, ensures DuckDB table, auto-generates profile & charts.
 */
export async function loadDashboard(id: string): Promise<DashboardConfig> {
  const safeId = sanitizeDashboardId(id);
  const configPath = path.join(DASHBOARDS_DIR, `${safeId}.json`);
  const configJson = await readFile(configPath, "utf-8");
  const config: DashboardConfig = JSON.parse(configJson);

  // Ensure primary table
  await ensureTable(config.tableName, config.csvPath);

  // Ensure additional tables (multi-table dashboards) — parallel
  if (config.tables && config.tables.length > 0) {
    await Promise.all(config.tables.map((t) => ensureTable(t.tableName, t.csvPath)));
  }

  // Recovery: re-append sources if table was re-ingested from CSV (lost _source + appended rows)
  if (config.appendedSources && config.appendedSources.length > 0) {
    const hasSource = await query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM information_schema.columns WHERE table_schema = 'main' AND table_name = ${quoteLiteral(config.tableName)} AND column_name = '_source'`
    );
    if (Number(hasSource[0].cnt) === 0) {
      for (const src of config.appendedSources) {
        if (!fs.existsSync(src.csvPath)) continue;
        const tempName = `_reappend_${Date.now()}`;
        await ingestCsv(src.csvPath, tempName);
        await appendCsv(config.tableName, tempName, src.label);
        await dropTable(tempName);
      }
      await backfillSource(config.tableName, config.title);
      config.profile = await profileTable(config.tableName);
      await writeFile(configPath, JSON.stringify(config, null, 2));
    }
  }

  let configChanged = false;

  if (!config.profile) {
    config.profile = await profileTable(config.tableName);
    configChanged = true;
  }

  if (config.profile && config.charts.length <= 1) {
    config.charts = recommendCharts(config.profile);
    configChanged = true;
  }

  if (configChanged) {
    await writeFile(configPath, JSON.stringify(config, null, 2));
  }

  return config;
}
