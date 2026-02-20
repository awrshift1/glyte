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

  // Build all funnel queries
  const funnelDefs: { label: string; sql: string; color: string }[] = [
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
    funnelDefs.push({
      label: "Has Email",
      sql: `SELECT COUNT(*) as cnt FROM ${enrichedView} WHERE icp_tier IS NOT NULL AND ${quoteIdent(emailCol)} IS NOT NULL AND ${quoteIdent(emailCol)} != ''`,
      color: "#22c55e",
    });
  }

  if (linkedinCol) {
    funnelDefs.push({
      label: "Has LinkedIn",
      sql: `SELECT COUNT(*) as cnt FROM ${enrichedView} WHERE icp_tier IS NOT NULL AND ${quoteIdent(linkedinCol)} IS NOT NULL AND ${quoteIdent(linkedinCol)} != ''`,
      color: "#06b6d4",
    });
  }

  if (emailCol && linkedinCol) {
    funnelDefs.push({
      label: "Complete",
      sql: `SELECT COUNT(*) as cnt FROM ${enrichedView} WHERE icp_tier IS NOT NULL AND ${quoteIdent(emailCol)} IS NOT NULL AND ${quoteIdent(emailCol)} != '' AND ${quoteIdent(linkedinCol)} IS NOT NULL AND ${quoteIdent(linkedinCol)} != ''`,
      color: "#a855f7",
    });
  }

  // Execute all funnel queries in parallel
  const funnelResults = await Promise.all(
    funnelDefs.map(async (def) => {
      try {
        const rows = await query<{ cnt: number }>(def.sql);
        return { label: def.label, value: Number(rows[0]?.cnt ?? 0), color: def.color };
      } catch {
        return { label: def.label, value: 0, color: def.color };
      }
    }),
  );

  const funnel = funnelResults;

  // Enrichment status (parallel)
  const enrichment: { label: string; count: number; color: string; presetId?: string }[] = [];

  if (emailCol && linkedinCol) {
    const enrichDefs = [
      {
        label: "Complete",
        sql: `SELECT COUNT(*) as cnt FROM ${enrichedView} WHERE icp_tier IS NOT NULL AND ${quoteIdent(emailCol)} IS NOT NULL AND ${quoteIdent(emailCol)} != '' AND ${quoteIdent(linkedinCol)} IS NOT NULL AND ${quoteIdent(linkedinCol)} != ''`,
        color: "#22c55e",
        presetId: "enrichment-complete",
      },
      {
        label: "Need Email",
        sql: `SELECT COUNT(*) as cnt FROM ${enrichedView} WHERE icp_tier IS NOT NULL AND (${quoteIdent(emailCol)} IS NULL OR ${quoteIdent(emailCol)} = '') AND ${quoteIdent(linkedinCol)} IS NOT NULL AND ${quoteIdent(linkedinCol)} != ''`,
        color: "#eab308",
        presetId: "enrichment-need-email",
      },
      {
        label: "Need LinkedIn",
        sql: `SELECT COUNT(*) as cnt FROM ${enrichedView} WHERE icp_tier IS NOT NULL AND ${quoteIdent(emailCol)} IS NOT NULL AND ${quoteIdent(emailCol)} != '' AND (${quoteIdent(linkedinCol)} IS NULL OR ${quoteIdent(linkedinCol)} = '')`,
        color: "#f97316",
        presetId: "enrichment-need-linkedin",
      },
      {
        label: "Need Both",
        sql: `SELECT COUNT(*) as cnt FROM ${enrichedView} WHERE icp_tier IS NOT NULL AND (${quoteIdent(emailCol)} IS NULL OR ${quoteIdent(emailCol)} = '') AND (${quoteIdent(linkedinCol)} IS NULL OR ${quoteIdent(linkedinCol)} = '')`,
        color: "#ef4444",
        presetId: "enrichment-need-both",
      },
    ];

    const enrichResults = await Promise.all(
      enrichDefs.map(async (eq) => {
        try {
          const rows = await query<{ cnt: number }>(eq.sql);
          return {
            label: eq.label,
            count: Number(rows[0]?.cnt ?? 0),
            color: eq.color,
            presetId: eq.presetId,
          };
        } catch {
          return { label: eq.label, count: 0, color: eq.color, presetId: eq.presetId };
        }
      }),
    );

    enrichment.push(...enrichResults);
  }

  // Tier distribution (for dynamic export presets)
  const tierRows = await query<{ icp_tier: string; cnt: number }>(
    `SELECT icp_tier, COUNT(*) as cnt FROM ${enrichedView} WHERE icp_tier IS NOT NULL GROUP BY icp_tier ORDER BY cnt DESC`,
  );
  const tiers = tierRows.map((r) => ({ tier: r.icp_tier, count: Number(r.cnt) }));

  return NextResponse.json({ funnel, enrichment, tiers });
}
