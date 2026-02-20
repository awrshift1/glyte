import { NextRequest } from "next/server";
import { query } from "@/lib/duckdb";
import { quoteIdent, quoteLiteral } from "@/lib/sql-utils";

// Whitelisted preset filters — only these are allowed
const PRESET_FILTERS: Record<string, { sql: string; desc: string }> = {
  icp: { sql: "icp_tier IS NOT NULL", desc: "all_icp" },
  "icp-email": { sql: "icp_tier IS NOT NULL AND email IS NOT NULL AND email != ''", desc: "icp_with_email" },
  "icp-needs-linkedin": { sql: "icp_tier IS NOT NULL AND (\"linkedinUrl\" IS NULL OR \"linkedinUrl\" = '')", desc: "icp_needs_linkedin" },
  tier1: { sql: "icp_tier = 'Tier 1'", desc: "tier1" },
  "tier1.5": { sql: "icp_tier = 'Tier 1.5'", desc: "tier1_5" },
  "tier1+1.5": { sql: "icp_tier IN ('Tier 1', 'Tier 1.5')", desc: "tier1_and_1_5" },
  tier2: { sql: "icp_tier = 'Tier 2'", desc: "tier2" },
  tier3: { sql: "icp_tier = 'Tier 3'", desc: "tier3" },
  igaming: { sql: "icp_tier = 'iGaming'", desc: "igaming" },
  board: { sql: "icp_tier = 'Board'", desc: "board" },
  rejected: { sql: "icp_tier IS NULL", desc: "rejected" },
  // Enrichment status presets (used by EnrichmentBoard)
  "enrichment-complete": { sql: "icp_tier IS NOT NULL AND email IS NOT NULL AND email != '' AND \"linkedinUrl\" IS NOT NULL AND \"linkedinUrl\" != ''", desc: "complete" },
  "enrichment-need-email": { sql: "icp_tier IS NOT NULL AND (email IS NULL OR email = '') AND \"linkedinUrl\" IS NOT NULL AND \"linkedinUrl\" != ''", desc: "need_email" },
  "enrichment-need-linkedin": { sql: "icp_tier IS NOT NULL AND email IS NOT NULL AND email != '' AND (\"linkedinUrl\" IS NULL OR \"linkedinUrl\" = '')", desc: "need_linkedin" },
  "enrichment-need-both": { sql: "icp_tier IS NOT NULL AND (email IS NULL OR email = '') AND (\"linkedinUrl\" IS NULL OR \"linkedinUrl\" = '')", desc: "need_both" },
};

async function handleExport(tableName: string, presetId?: string | null) {
  // Validate table exists
  const tableCheck = await query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = 'main' AND table_name = ${quoteLiteral(tableName)}`,
  );
  if (!tableCheck[0] || tableCheck[0].cnt === 0) {
    return Response.json({ error: `Table "${tableName}" not found` }, { status: 404 });
  }

  const safeTable = quoteIdent(tableName);
  let sql = `SELECT * FROM ${safeTable}`;
  let filterDesc = "all";

  if (presetId) {
    const preset = PRESET_FILTERS[presetId];
    if (!preset) {
      return Response.json({ error: `Unknown preset: "${presetId}"` }, { status: 400 });
    }
    sql += ` WHERE ${preset.sql}`;
    filterDesc = preset.desc;
  }

  const rows = await query<Record<string, unknown>>(sql);

  if (rows.length === 0) {
    return Response.json({ error: "No data matching filter" }, { status: 404 });
  }

  const columns = Object.keys(rows[0]);
  const date = new Date().toISOString().split("T")[0];
  const filename = `${tableName}_${filterDesc}_${rows.length}_${date}.csv`;

  // Stream CSV in batches to avoid building full string in memory
  const BATCH = 1000;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Header row
      controller.enqueue(encoder.encode(columns.join(",") + "\n"));

      // Data rows in batches
      for (let i = 0; i < rows.length; i += BATCH) {
        const end = Math.min(i + BATCH, rows.length);
        let chunk = "";
        for (let j = i; j < end; j++) {
          const row = rows[j];
          const line = columns
            .map((col) => {
              const val = row[col];
              if (val === null || val === undefined) return "";
              const str = String(val);
              if (str.includes(",") || str.includes('"') || str.includes("\n")) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            })
            .join(",");
          chunk += line + "\n";
        }
        controller.enqueue(encoder.encode(chunk));
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "X-Filename": filename,
    },
  });
}

// POST — primary method (no SQL in URL)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { table, preset } = body as { table?: string; preset?: string };
    if (!table) {
      return Response.json({ error: "table is required" }, { status: 400 });
    }
    return handleExport(table, preset);
  } catch (error) {
    return Response.json(
      { error: `Export failed: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 },
    );
  }
}

// GET — kept for backwards compatibility (preset ID only, no raw SQL)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const tableName = searchParams.get("table");
    const preset = searchParams.get("preset") || searchParams.get("filter");
    if (!tableName) {
      return Response.json({ error: "table parameter required" }, { status: 400 });
    }
    // Only allow known preset IDs via GET
    if (preset && !PRESET_FILTERS[preset]) {
      return Response.json({ error: `Unknown preset: "${preset}"` }, { status: 400 });
    }
    return handleExport(tableName, preset);
  } catch (error) {
    return Response.json(
      { error: `Export failed: ${error instanceof Error ? error.message : "Unknown error"}` },
      { status: 500 },
    );
  }
}
