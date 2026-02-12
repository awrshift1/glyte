import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import { ingestCsv, dropTable } from "@/lib/duckdb";
import { sanitizeDashboardId, safeUploadFilename } from "@/lib/dashboard-loader";
import type { DashboardConfig, TableEntry } from "@/types/dashboard";

const DASHBOARDS_DIR = path.join(process.cwd(), "data", "dashboards");

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const safeId = sanitizeDashboardId(id);
    const configPath = path.join(DASHBOARDS_DIR, `${safeId}.json`);
    const config: DashboardConfig = JSON.parse(await readFile(configPath, "utf-8"));

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Save file
    const uploadDir = path.join(process.cwd(), "data", "uploads");
    await mkdir(uploadDir, { recursive: true });
    const safeFilename = safeUploadFilename(file.name);
    const filePath = path.join(uploadDir, safeFilename);
    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // Derive table name
    const tableName = file.name
      .replace(/\.(csv|tsv|xlsx?)$/i, "")
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .toLowerCase();

    // Ingest
    const { rows, columns } = await ingestCsv(filePath, tableName);

    // Add to dashboard config
    const tableEntry: TableEntry = {
      tableName,
      csvPath: filePath,
      rowCount: rows,
      columnCount: columns.length,
      addedAt: new Date().toISOString(),
    };

    config.tables = config.tables ?? [];
    config.tables.push(tableEntry);
    config.updatedAt = new Date().toISOString();

    await writeFile(configPath, JSON.stringify(config, null, 2));

    return NextResponse.json({
      table: tableEntry,
      columns,
      totalTables: config.tables.length,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const safeId = sanitizeDashboardId(id);
    const configPath = path.join(DASHBOARDS_DIR, `${safeId}.json`);
    const config: DashboardConfig = JSON.parse(await readFile(configPath, "utf-8"));

    const { tableName, excludedColumns } = (await request.json()) as {
      tableName: string;
      excludedColumns: string[];
    };

    if (!tableName) {
      return NextResponse.json({ error: "tableName required" }, { status: 400 });
    }

    // Primary table
    if (tableName === config.tableName) {
      config.excludedColumns = excludedColumns.length > 0 ? excludedColumns : undefined;
      config.updatedAt = new Date().toISOString();
      await writeFile(configPath, JSON.stringify(config, null, 2));
      return NextResponse.json({ updated: tableName, excludedColumns: config.excludedColumns ?? [] });
    }

    const table = (config.tables ?? []).find((t) => t.tableName === tableName);
    if (!table) {
      return NextResponse.json({ error: "Table not found" }, { status: 404 });
    }

    table.excludedColumns = excludedColumns.length > 0 ? excludedColumns : undefined;
    config.updatedAt = new Date().toISOString();

    await writeFile(configPath, JSON.stringify(config, null, 2));

    return NextResponse.json({ updated: tableName, excludedColumns: table.excludedColumns ?? [] });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

export async function DELETE(
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

    // Remove from config
    config.tables = (config.tables ?? []).filter((t) => t.tableName !== tableName);
    // Also remove any relationships involving this table
    config.relationships = (config.relationships ?? []).filter(
      (r) => r.fromTable !== tableName && r.toTable !== tableName
    );
    config.updatedAt = new Date().toISOString();

    // Drop DuckDB table
    await dropTable(tableName);

    await writeFile(configPath, JSON.stringify(config, null, 2));

    return NextResponse.json({ deleted: tableName, totalTables: config.tables.length });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
