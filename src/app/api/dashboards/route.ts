import { NextResponse } from "next/server";
import { readdir, readFile } from "fs/promises";
import path from "path";
import type { DashboardConfig } from "@/types/dashboard";

export async function GET() {
  try {
    const configDir = path.join(process.cwd(), "data", "dashboards");
    let files: string[];
    try {
      files = await readdir(configDir);
    } catch {
      return NextResponse.json({ dashboards: [] });
    }

    const dashboards: DashboardConfig[] = [];
    for (const file of files.filter((f) => f.endsWith(".json"))) {
      const content = await readFile(path.join(configDir, file), "utf-8");
      dashboards.push(JSON.parse(content));
    }

    dashboards.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ dashboards });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
