import { NextRequest } from "next/server";
import { query } from "@/lib/duckdb";
import { quoteIdent, quoteLiteral } from "@/lib/sql-utils";

// ICP preset filters — safe SQL WHERE clauses
const PRESET_FILTERS: Record<string, string> = {
  icp: "icp_tier IS NOT NULL",
  "icp-email": "icp_tier IS NOT NULL AND email IS NOT NULL",
  tier1: "icp_tier = 'Tier 1'",
  "tier1.5": "icp_tier = 'Tier 1.5'",
  tier2: "icp_tier = 'Tier 2'",
  tier3: "icp_tier = 'Tier 3'",
  igaming: "icp_tier = 'iGaming'",
  board: "icp_tier = 'Board'",
  rejected: "icp_tier IS NULL",
};

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tableName = searchParams.get("table");
  const filter = searchParams.get("filter");

  if (!tableName) {
    return Response.json({ error: "table parameter required" }, { status: 400 });
  }

  try {
    // Validate table exists (covers both tables and views)
    const tableCheck = await query<{ cnt: number }>(
      `SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = 'main' AND table_name = ${quoteLiteral(tableName)}`,
    );

    if (!tableCheck[0] || tableCheck[0].cnt === 0) {
      return Response.json({ error: `Table "${tableName}" not found` }, { status: 404 });
    }

    // Build query
    const safeTable = quoteIdent(tableName);
    let sql = `SELECT * FROM ${safeTable}`;

    if (filter) {
      // Check for preset filter first
      const preset = PRESET_FILTERS[filter.toLowerCase()];
      if (preset) {
        sql += ` WHERE ${preset}`;
      } else {
        // Custom filter — block dangerous patterns
        const forbidden = /\b(DROP|DELETE|INSERT|UPDATE|CREATE|ALTER|EXEC|EXECUTE|UNION|INTO|GRANT|TRUNCATE|COPY|LOAD|ATTACH|CALL|PRAGMA)\b/i;
        const dangerousChars = /;|--|\/\*|\*\/|\bSELECT\b/i;
        if (forbidden.test(filter) || dangerousChars.test(filter)) {
          return Response.json({ error: "Invalid filter" }, { status: 400 });
        }
        sql += ` WHERE ${filter}`;
      }
    }

    const rows = await query<Record<string, unknown>>(sql);

    if (rows.length === 0) {
      return Response.json({ error: "No data matching filter" }, { status: 404 });
    }

    // Build CSV
    const columns = Object.keys(rows[0]);
    const csvLines: string[] = [columns.join(",")];

    for (const row of rows) {
      const values = columns.map((col) => {
        const val = row[col];
        if (val === null || val === undefined) return "";
        const str = String(val);
        // Escape CSV: wrap in quotes if contains comma, quote, or newline
        if (str.includes(",") || str.includes('"') || str.includes("\n")) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      });
      csvLines.push(values.join(","));
    }

    const csv = csvLines.join("\n");

    // Generate filename
    const filterDesc = filter ? filter.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 30) : "all";
    const date = new Date().toISOString().split("T")[0];
    const filename = `${tableName}_${filterDesc}_${rows.length}_${date}.csv`;

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    return Response.json(
      { error: `Export failed: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 }
    );
  }
}
