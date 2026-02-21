import { query } from "./duckdb";
import path from "path";
import type { DiffSummary, DashboardConfig } from "@/types/dashboard";
import { readFile } from "fs/promises";
import fs from "fs";
import { quoteIdent, quoteLiteral, safeCsvPath } from "./sql-utils";
import { DASHBOARDS_DIR } from "./paths";

/**
 * Diff a new CSV against an existing table in DuckDB.
 * Uses a temp table to avoid touching the real data.
 */
export async function diffCsvAgainstTable(
  csvPath: string,
  existingTableName: string,
  dashboard: DashboardConfig
): Promise<DiffSummary> {
  const tempTable = `_diff_temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const safePath = safeCsvPath(csvPath);

  try {
    // Load new CSV into temp table
    await query(`CREATE TEMP TABLE ${quoteIdent(tempTable)} AS SELECT * FROM read_csv_auto(${quoteLiteral(safePath)})`);

    // Get columns of both tables
    const existingCols = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = ${quoteLiteral(existingTableName)} ORDER BY ordinal_position`
    );
    const newCols = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = ${quoteLiteral(tempTable)} ORDER BY ordinal_position`
    );

    const existingSet = new Set(existingCols.map((r) => r.column_name));
    const newSet = new Set(newCols.map((r) => r.column_name));

    const commonColumns = [...existingSet].filter((c) => newSet.has(c));
    const addedColumns = [...newSet].filter((c) => !existingSet.has(c));
    const removedColumns = [...existingSet].filter((c) => !newSet.has(c));

    // Row counts
    const oldCount = await query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM ${quoteIdent(existingTableName)}`);
    const newCount = await query<{ cnt: number }>(`SELECT COUNT(*) as cnt FROM ${quoteIdent(tempTable)}`);

    const oldRowCount = oldCount[0].cnt;
    const newRowCount = newCount[0].cnt;

    return {
      matchedDashboard: dashboard.title,
      matchedDashboardId: dashboard.id,
      rowDelta: newRowCount - oldRowCount,
      oldRowCount,
      newRowCount,
      addedColumns,
      removedColumns,
      commonColumns,
      overlapPercent: existingSet.size > 0 ? Math.round((commonColumns.length / existingSet.size) * 100) : 0,
    };
  } finally {
    await query(`DROP TABLE IF EXISTS ${quoteIdent(tempTable)}`).catch(() => {});
  }
}

/**
 * Find best matching dashboard by column overlap with a new CSV file.
 * Returns null if no match > 80% overlap.
 */
export async function findMatchingDashboard(
  csvPath: string
): Promise<{ dashboard: DashboardConfig; diff: DiffSummary } | null> {
  // List all dashboard configs
  const dashboardDir = DASHBOARDS_DIR;
  if (!fs.existsSync(dashboardDir)) return null;

  const files = fs.readdirSync(dashboardDir).filter((f) => f.endsWith(".json"));
  if (files.length === 0) return null;

  // Get columns from new CSV via temp table
  const tempTable = `_match_temp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const safePath = safeCsvPath(csvPath);
  await query(`CREATE TEMP TABLE ${quoteIdent(tempTable)} AS SELECT * FROM read_csv_auto(${quoteLiteral(safePath)})`);
  const newCols = await query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = ${quoteLiteral(tempTable)} ORDER BY ordinal_position`
  );
  await query(`DROP TABLE IF EXISTS ${quoteIdent(tempTable)}`).catch(() => {});
  const newColSet = new Set(newCols.map((r) => r.column_name));

  let bestMatch: { dashboard: DashboardConfig; overlap: number } | null = null;

  for (const file of files) {
    const configJson = await readFile(path.join(dashboardDir, file), "utf-8");
    const config: DashboardConfig = JSON.parse(configJson);

    // Get columns from profile or from DB
    const existingCols = config.profile?.columns.map((c) => c.name) ?? [];
    if (existingCols.length === 0) continue;

    const existingSet = new Set(existingCols);
    const common = [...existingSet].filter((c) => newColSet.has(c));
    const overlap = common.length / existingSet.size;

    if (overlap > 0.8 && (!bestMatch || overlap > bestMatch.overlap)) {
      bestMatch = { dashboard: config, overlap };
    }
  }

  if (!bestMatch) return null;

  const diff = await diffCsvAgainstTable(csvPath, bestMatch.dashboard.tableName, bestMatch.dashboard);
  return { dashboard: bestMatch.dashboard, diff };
}
