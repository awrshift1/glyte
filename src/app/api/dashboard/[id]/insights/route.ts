import { NextRequest, NextResponse } from "next/server";
import { loadDashboard, sanitizeDashboardId } from "@/lib/dashboard-loader";
import { safeErrorMessage } from "@/lib/sql-utils";
import { computeInsightsHash, generateInsights } from "@/lib/insight-generator";
import { writeFile } from "fs/promises";
import path from "path";
import { DASHBOARDS_DIR } from "@/lib/paths";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const config = await loadDashboard(id);

    if (!config.profile) {
      return NextResponse.json(
        { error: "Dashboard has no profile yet" },
        { status: 400 }
      );
    }

    const hash = computeInsightsHash(config.profile);

    // Return cached if hash matches
    if (config.insightsHash === hash && config.insights?.length) {
      return NextResponse.json({ insights: config.insights, cached: true });
    }

    // Generate fresh insights
    const insights = await generateInsights(config.tableName, config.profile);
    config.insights = insights;
    config.insightsHash = hash;

    // Save to config file
    const safeId = sanitizeDashboardId(id);
    await writeFile(
      path.join(DASHBOARDS_DIR, `${safeId}.json`),
      JSON.stringify(config, null, 2)
    );

    return NextResponse.json({ insights, cached: false });
  } catch (error) {
    const status = error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json(
      { error: safeErrorMessage(error) },
      { status }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const config = await loadDashboard(id);

    delete config.insights;
    delete config.insightsHash;

    const safeId = sanitizeDashboardId(id);
    await writeFile(
      path.join(DASHBOARDS_DIR, `${safeId}.json`),
      JSON.stringify(config, null, 2)
    );

    return NextResponse.json({ cleared: true });
  } catch (error) {
    const status = error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "NOT_FOUND" ? 404 : 500;
    return NextResponse.json(
      { error: safeErrorMessage(error) },
      { status }
    );
  }
}
