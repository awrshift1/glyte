import { NextRequest, NextResponse } from "next/server";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { DASHBOARDS_DIR } from "@/lib/paths";
import { appendCsv, backfillSource, dropTable } from "@/lib/duckdb";
import { profileTable } from "@/lib/profiler";
import { selectTemplate } from "@/lib/templates";
import { sanitizeDashboardId } from "@/lib/dashboard-loader";
import type { DashboardConfig, AppendedSource } from "@/types/dashboard";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const safeId = sanitizeDashboardId(id);
    const configPath = path.join(DASHBOARDS_DIR, `${safeId}.json`);
    const config: DashboardConfig = JSON.parse(await readFile(configPath, "utf-8"));

    const { tableName } = (await request.json()) as { tableName: string };
    if (!tableName) {
      return NextResponse.json({ error: "tableName required" }, { status: 400 });
    }

    // Find the temp table entry to get its csvPath for the label
    const tempEntry = (config.tables ?? []).find((t) => t.tableName === tableName);
    if (!tempEntry) {
      return NextResponse.json({ error: "Table not found in config" }, { status: 404 });
    }

    // Derive source label from table name (which is cleaned original filename)
    const sourceLabel = tableName
      .replace(/[_-]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

    // Append source rows into primary table (also creates _source column if missing)
    const { newRows, totalRows } = await appendCsv(config.tableName, tableName, sourceLabel);

    // First append: backfill existing rows with primary table label
    const isFirstAppend = !config.appendedSources || config.appendedSources.length === 0;
    if (isFirstAppend) {
      const primaryLabel = config.title;
      await backfillSource(config.tableName, primaryLabel);
    }

    // Drop temp table
    await dropTable(tableName);

    // Remove temp from config.tables
    config.tables = (config.tables ?? []).filter((t) => t.tableName !== tableName);

    // Remove any relationships involving the temp table
    config.relationships = (config.relationships ?? []).filter(
      (r) => r.fromTable !== tableName && r.toTable !== tableName
    );

    // Re-profile primary table
    const prevColumnNames = new Set(config.profile?.columns.map((c) => c.name) ?? []);
    const profile = await profileTable(config.tableName);
    const newColumnNames = new Set(profile.columns.map((c) => c.name));

    // Only regenerate charts if columns changed (new columns added from append)
    const columnsChanged =
      prevColumnNames.size !== newColumnNames.size ||
      [...newColumnNames].some((c) => !prevColumnNames.has(c));

    let charts = config.charts;
    let templateId = config.templateId;
    if (columnsChanged || charts.length <= 1) {
      const selection = selectTemplate(profile);
      charts = selection.template.generate(profile);
      templateId = selection.template.id;
    }

    // Track appended source
    const appendedSource: AppendedSource = {
      label: sourceLabel,
      csvPath: tempEntry.csvPath,
      rowCount: newRows,
      appendedAt: new Date().toISOString(),
    };
    config.appendedSources = config.appendedSources ?? [];
    config.appendedSources.push(appendedSource);

    // Update config
    config.rowCount = totalRows;
    config.columnCount = profile.columns.length;
    config.profile = profile;
    config.charts = charts;
    config.templateId = templateId;
    config.updatedAt = new Date().toISOString();

    await writeFile(configPath, JSON.stringify(config, null, 2));

    return NextResponse.json({
      appended: true,
      sourceLabel,
      newRows,
      totalRows,
      chartCount: charts.length,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
