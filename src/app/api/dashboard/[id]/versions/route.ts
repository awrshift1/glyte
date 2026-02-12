import { NextRequest, NextResponse } from "next/server";
import { loadDashboard } from "@/lib/dashboard-loader";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const config = await loadDashboard(id);

    // Build version list: current + previous
    const currentVersion = {
      version: config.version ?? 1,
      rowCount: config.rowCount,
      columnCount: config.columnCount,
      csvPath: config.csvPath,
      createdAt: config.updatedAt ?? config.createdAt,
      current: true,
    };

    const previous = (config.previousVersions ?? []).map((v) => ({
      ...v,
      current: false,
    }));

    return NextResponse.json({
      versions: [currentVersion, ...previous.reverse()],
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
