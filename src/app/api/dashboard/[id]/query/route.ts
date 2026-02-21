import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/duckdb";
import { loadDashboard } from "@/lib/dashboard-loader";
import { BLOCKED_SQL, BLOCKED_FUNCTIONS, safeErrorMessage } from "@/lib/sql-utils";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { sql } = (await request.json()) as { sql: string };

    if (!sql?.trim()) {
      return NextResponse.json({ error: "SQL query is required" }, { status: 400 });
    }

    if (!/^\s*SELECT\b/i.test(sql)) {
      return NextResponse.json({ error: "Only SELECT queries are allowed" }, { status: 400 });
    }

    if (BLOCKED_SQL.test(sql)) {
      return NextResponse.json({ error: "Query contains blocked keywords" }, { status: 400 });
    }

    if (BLOCKED_FUNCTIONS.test(sql)) {
      return NextResponse.json({ error: "File-access functions are not allowed" }, { status: 400 });
    }

    await loadDashboard(id); // validate dashboard exists

    const results = await query<Record<string, unknown>>(sql);
    const columns = results.length > 0 ? Object.keys(results[0]) : [];

    return NextResponse.json({ results, columns, rowCount: results.length });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
