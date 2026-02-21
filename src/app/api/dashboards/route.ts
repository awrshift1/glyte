import { NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import path from "path";
import { DASHBOARDS_DIR } from "@/lib/paths";
import type { DashboardConfig } from "@/types/dashboard";

export async function GET() {
  try {
    const configDir = DASHBOARDS_DIR;
    let files: string[];
    try {
      files = await readdir(configDir);
    } catch {
      return NextResponse.json({ dashboards: [] });
    }

    const dashboards: DashboardConfig[] = await Promise.all(
      files
        .filter((f) => f.endsWith(".json"))
        .map(async (file) => {
          const content = await readFile(path.join(configDir, file), "utf-8");
          return JSON.parse(content) as DashboardConfig;
        }),
    );

    dashboards.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ dashboards });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
