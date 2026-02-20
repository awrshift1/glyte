import { NextRequest, NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import path from "path";
import type { DashboardConfig } from "@/types/dashboard";

const DASHBOARDS_DIR = path.join(process.cwd(), "data", "dashboards");

export async function GET(request: NextRequest) {
  try {
    const exclude = request.nextUrl.searchParams.get("exclude") ?? "";

    let files: string[];
    try {
      files = await readdir(DASHBOARDS_DIR);
    } catch {
      return NextResponse.json({ tables: [] });
    }

    const tables: Array<{
      tableName: string;
      csvPath: string;
      rowCount: number;
      columnCount: number;
      dashboardId: string;
      dashboardTitle: string;
      isPrimary: boolean;
    }> = [];

    for (const file of files.filter((f) => f.endsWith(".json"))) {
      const config: DashboardConfig = JSON.parse(
        await readFile(path.join(DASHBOARDS_DIR, file), "utf-8")
      );

      if (config.id === exclude) continue;

      // Primary table
      tables.push({
        tableName: config.tableName,
        csvPath: config.csvPath,
        rowCount: config.rowCount,
        columnCount: config.columnCount,
        dashboardId: config.id,
        dashboardTitle: config.title,
        isPrimary: true,
      });

      // Secondary tables
      for (const t of config.tables ?? []) {
        tables.push({
          tableName: t.tableName,
          csvPath: t.csvPath,
          rowCount: t.rowCount,
          columnCount: t.columnCount,
          dashboardId: config.id,
          dashboardTitle: config.title,
          isPrimary: false,
        });
      }
    }

    return NextResponse.json({ tables });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
