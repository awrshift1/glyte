import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/duckdb";

export async function GET(request: NextRequest) {
  try {
    const tableName = request.nextUrl.searchParams.get("table");
    if (!tableName) {
      return NextResponse.json({ error: "table param required" }, { status: 400 });
    }

    // Validate table name format
    if (!/^[a-zA-Z0-9_]+$/.test(tableName)) {
      return NextResponse.json({ error: "Invalid table name" }, { status: 400 });
    }

    const rows = await query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns WHERE table_name = '${tableName.replace(/'/g, "''")}' ORDER BY ordinal_position`
    );

    return NextResponse.json({ columns: rows.map((r) => r.column_name) });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
