import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir, readFile } from "fs/promises";
import path from "path";
import fs from "fs";
import { ingestCsv } from "@/lib/duckdb";
import { profileTable } from "@/lib/profiler";
import { safeUploadFilename, sanitizeDashboardId } from "@/lib/dashboard-loader";
import { safeCsvPath, safeErrorMessage } from "@/lib/sql-utils";
import { selectTemplate } from "@/lib/templates";
import type { DashboardConfig, VersionEntry } from "@/types/dashboard";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const replaceId = formData.get("replaceId") as string | null;
    const tempPath = formData.get("tempPath") as string | null;

    // Determine file path — either from pre-uploaded temp or new upload
    let filePath: string;

    if (tempPath) {
      // Validate tempPath is within allowed directory (prevent path traversal)
      filePath = safeCsvPath(tempPath);
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: "Temp file not found" }, { status: 400 });
      }
    } else if (file) {
      const uploadDir = path.join(process.cwd(), "data", "uploads");
      await mkdir(uploadDir, { recursive: true });
      const safeFilename = safeUploadFilename(file.name);
      filePath = path.join(uploadDir, safeFilename);
      const bytes = await file.arrayBuffer();
      await writeFile(filePath, Buffer.from(bytes));
    } else {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const originalName = file?.name ?? path.basename(filePath);

    // Derive table name
    const tableName = originalName
      .replace(/\.(csv|tsv|xlsx?)$/i, "")
      .replace(/[^a-zA-Z0-9_]/g, "_")
      .toLowerCase();

    // Ingest into DuckDB
    const { rows, columns } = await ingestCsv(filePath, tableName);

    // Profile the table
    const profile = await profileTable(tableName);

    // Select best template and generate charts
    const selection = selectTemplate(profile);
    const charts = selection.template.generate(profile);

    // Replace flow: update existing dashboard config
    if (replaceId) {
      const safeId = sanitizeDashboardId(replaceId);
      const configDir = path.join(process.cwd(), "data", "dashboards");
      const configPath = path.join(configDir, `${safeId}.json`);

      if (fs.existsSync(configPath)) {
        const existingConfig: DashboardConfig = JSON.parse(
          await readFile(configPath, "utf-8")
        );

        // Push current state to previousVersions
        const versionEntry: VersionEntry = {
          version: existingConfig.version ?? 1,
          rowCount: existingConfig.rowCount,
          columnCount: existingConfig.columnCount,
          csvPath: existingConfig.csvPath,
          createdAt: existingConfig.updatedAt ?? existingConfig.createdAt,
        };

        const previousVersions = [...(existingConfig.previousVersions ?? []), versionEntry];

        const updatedConfig: DashboardConfig = {
          ...existingConfig,
          tableName,
          csvPath: filePath,
          rowCount: rows,
          columnCount: columns.length,
          charts,
          profile,
          templateId: selection.template.id,
          updatedAt: new Date().toISOString(),
          version: (existingConfig.version ?? 1) + 1,
          previousVersions,
        };

        await writeFile(configPath, JSON.stringify(updatedConfig, null, 2));

        return NextResponse.json({
          dashboardId: existingConfig.id,
          title: existingConfig.title,
          rowCount: rows,
          columnCount: columns.length,
          chartCount: charts.length,
          profile,
          replaced: true,
          version: updatedConfig.version,
        });
      }
    }

    // New dashboard flow
    const config: DashboardConfig = {
      id: `dash-${Date.now()}`,
      title: formatDashboardTitle(originalName),
      tableName,
      csvPath: filePath,
      rowCount: rows,
      columnCount: columns.length,
      charts,
      profile,
      createdAt: new Date().toISOString(),
      version: 1,
      templateId: selection.template.id,
    };

    const configDir = path.join(process.cwd(), "data", "dashboards");
    await mkdir(configDir, { recursive: true });
    await writeFile(
      path.join(configDir, `${config.id}.json`),
      JSON.stringify(config, null, 2)
    );

    return NextResponse.json({
      dashboardId: config.id,
      title: config.title,
      rowCount: rows,
      columnCount: columns.length,
      chartCount: charts.length,
      profile,
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: safeErrorMessage(error) },
      { status: 500 }
    );
  }
}

function formatDashboardTitle(filename: string): string {
  return filename
    .replace(/\.(csv|tsv|xlsx?)$/i, "")
    .replace(/[-_]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
