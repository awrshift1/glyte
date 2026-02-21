import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/duckdb";
import { loadDashboard } from "@/lib/dashboard-loader";
import { safeErrorMessage } from "@/lib/sql-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const config = await loadDashboard(id);

    // Safety limit to prevent OOM on large datasets
    const MAX_EXPORT_ROWS = 100_000;
    let sql = `SELECT * FROM "${config.tableName}"`;
    if (!/\bLIMIT\b/i.test(sql)) {
      sql = `${sql} LIMIT ${MAX_EXPORT_ROWS}`;
    }

    const results = await query<Record<string, unknown>>(sql);

    if (results.length === 0) {
      return new NextResponse("No data", { status: 404 });
    }

    const columns = Object.keys(results[0]);
    const csvRows = [
      columns.join(","),
      ...results.map((row) =>
        columns
          .map((col) => {
            const val = row[col];
            if (val === null || val === undefined) return "";
            const str = String(val);
            return str.includes(",") || str.includes('"') || str.includes("\n")
              ? `"${str.replace(/"/g, '""')}"`
              : str;
          })
          .join(",")
      ),
    ];

    const csv = csvRows.join("\n");
    const filename = `${config.title.replace(/[^a-zA-Z0-9]/g, "_")}.csv`;

    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: safeErrorMessage(error) }, { status: 500 });
  }
}
