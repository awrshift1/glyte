import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/duckdb";
import { quoteIdent, quoteLiteral } from "@/lib/sql-utils";

export async function GET(request: NextRequest) {
  const tableName = request.nextUrl.searchParams.get("table");

  if (!tableName) {
    return NextResponse.json(
      { error: "table parameter is required" },
      { status: 400 },
    );
  }

  const enrichedView = quoteIdent(`${tableName}_enriched`);

  // Check if enriched view exists
  const viewCheck = await query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_name = ${quoteLiteral(`${tableName}_enriched`)}`,
  );
  if (!viewCheck[0] || viewCheck[0].cnt === 0) {
    return NextResponse.json({ funnel: [], enrichment: [] });
  }

  // Detect available columns
  const colsRaw = await query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = ${quoteLiteral(`${tableName}_enriched`)}`,
  );
  const cols = new Set(colsRaw.map((r) => r.column_name.toLowerCase()));

  const emailCol = cols.has("email") ? "email" : cols.has("e-mail") ? "e-mail" : null;
  const linkedinCol = cols.has("linkedinurl")
    ? "linkedinUrl"
    : cols.has("linkedin_url")
      ? "linkedin_url"
      : cols.has("linkedin")
        ? "linkedin"
        : null;

  // Funnel stages
  const funnelQueries: { label: string; sql: string; color: string }[] = [
    {
      label: "Total",
      sql: `SELECT COUNT(*) as cnt FROM ${enrichedView}`,
      color: "#64748b",
    },
    {
      label: "ICP",
      sql: `SELECT COUNT(*) as cnt FROM ${enrichedView} WHERE icp_tier IS NOT NULL`,
      color: "#3b82f6",
    },
  ];

  if (emailCol) {
    funnelQueries.push({
      label: "Has Email",
      sql: `SELECT COUNT(*) as cnt FROM ${enrichedView} WHERE icp_tier IS NOT NULL AND ${quoteIdent(emailCol)} IS NOT NULL AND ${quoteIdent(emailCol)} != ''`,
      color: "#22c55e",
    });
  }

  if (linkedinCol) {
    funnelQueries.push({
      label: "Has LinkedIn",
      sql: `SELECT COUNT(*) as cnt FROM ${enrichedView} WHERE icp_tier IS NOT NULL AND ${quoteIdent(linkedinCol)} IS NOT NULL AND ${quoteIdent(linkedinCol)} != ''`,
      color: "#06b6d4",
    });
  }

  if (emailCol && linkedinCol) {
    funnelQueries.push({
      label: "Complete",
      sql: `SELECT COUNT(*) as cnt FROM ${enrichedView} WHERE icp_tier IS NOT NULL AND ${quoteIdent(emailCol)} IS NOT NULL AND ${quoteIdent(emailCol)} != '' AND ${quoteIdent(linkedinCol)} IS NOT NULL AND ${quoteIdent(linkedinCol)} != ''`,
      color: "#a855f7",
    });
  }

  const funnel = [];
  for (const stage of funnelQueries) {
    try {
      const rows = await query<{ cnt: number }>(stage.sql);
      funnel.push({
        label: stage.label,
        value: Number(rows[0]?.cnt ?? 0),
        color: stage.color,
        percentage: 0,
      });
    } catch {
      funnel.push({ label: stage.label, value: 0, color: stage.color, percentage: 0 });
    }
  }

  // Calculate drop-off percentages
  for (let i = 0; i < funnel.length; i++) {
    funnel[i].percentage =
      i === 0
        ? 100
        : funnel[i - 1].value > 0
          ? Math.round((funnel[i].value / funnel[i - 1].value) * 100)
          : 0;
  }

  // Enrichment status
  const enrichment: { label: string; count: number; color: string; filterQuery?: string }[] = [];

  if (emailCol && linkedinCol) {
    const enrichQueries = [
      {
        label: "Complete",
        sql: `SELECT COUNT(*) as cnt FROM ${enrichedView} WHERE icp_tier IS NOT NULL AND ${quoteIdent(emailCol)} IS NOT NULL AND ${quoteIdent(emailCol)} != '' AND ${quoteIdent(linkedinCol)} IS NOT NULL AND ${quoteIdent(linkedinCol)} != ''`,
        color: "#22c55e",
        filterQuery: `icp_tier IS NOT NULL AND ${quoteIdent(emailCol)} IS NOT NULL AND ${quoteIdent(emailCol)} != '' AND ${quoteIdent(linkedinCol)} IS NOT NULL AND ${quoteIdent(linkedinCol)} != ''`,
      },
      {
        label: "Need Email",
        sql: `SELECT COUNT(*) as cnt FROM ${enrichedView} WHERE icp_tier IS NOT NULL AND (${quoteIdent(emailCol)} IS NULL OR ${quoteIdent(emailCol)} = '') AND ${quoteIdent(linkedinCol)} IS NOT NULL AND ${quoteIdent(linkedinCol)} != ''`,
        color: "#eab308",
        filterQuery: `icp_tier IS NOT NULL AND (${quoteIdent(emailCol)} IS NULL OR ${quoteIdent(emailCol)} = '') AND ${quoteIdent(linkedinCol)} IS NOT NULL`,
      },
      {
        label: "Need LinkedIn",
        sql: `SELECT COUNT(*) as cnt FROM ${enrichedView} WHERE icp_tier IS NOT NULL AND ${quoteIdent(emailCol)} IS NOT NULL AND ${quoteIdent(emailCol)} != '' AND (${quoteIdent(linkedinCol)} IS NULL OR ${quoteIdent(linkedinCol)} = '')`,
        color: "#f97316",
        filterQuery: `icp_tier IS NOT NULL AND ${quoteIdent(emailCol)} IS NOT NULL AND (${quoteIdent(linkedinCol)} IS NULL OR ${quoteIdent(linkedinCol)} = '')`,
      },
      {
        label: "Need Both",
        sql: `SELECT COUNT(*) as cnt FROM ${enrichedView} WHERE icp_tier IS NOT NULL AND (${quoteIdent(emailCol)} IS NULL OR ${quoteIdent(emailCol)} = '') AND (${quoteIdent(linkedinCol)} IS NULL OR ${quoteIdent(linkedinCol)} = '')`,
        color: "#ef4444",
        filterQuery: `icp_tier IS NOT NULL AND (${quoteIdent(emailCol)} IS NULL OR ${quoteIdent(emailCol)} = '') AND (${quoteIdent(linkedinCol)} IS NULL OR ${quoteIdent(linkedinCol)} = '')`,
      },
    ];

    for (const eq of enrichQueries) {
      try {
        const rows = await query<{ cnt: number }>(eq.sql);
        enrichment.push({
          label: eq.label,
          count: Number(rows[0]?.cnt ?? 0),
          color: eq.color,
          filterQuery: eq.filterQuery,
        });
      } catch {
        enrichment.push({ label: eq.label, count: 0, color: eq.color });
      }
    }
  }

  return NextResponse.json({ funnel, enrichment });
}
