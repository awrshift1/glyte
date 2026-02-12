import { NextRequest, NextResponse } from "next/server";
import { loadDashboard } from "@/lib/dashboard-loader";
import { detectRelationships, enhanceWithLlm } from "@/lib/relationship-detector";
import { createRelationship, getRelationshipsByTables, type StoredRelationship } from "@/lib/relationship-store";
import { sanitizeDashboardId } from "@/lib/dashboard-loader";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const safeId = sanitizeDashboardId(id);
    const config = await loadDashboard(id);

    const body = await request.json().catch(() => ({}));
    let tableNames = body.tableNames as string[] | undefined;

    // Default: all tables in the dashboard
    if (!tableNames || tableNames.length === 0) {
      tableNames = [
        config.tableName,
        ...(config.tables ?? []).map((t) => t.tableName),
      ];
    }

    if (tableNames.length < 2) {
      return NextResponse.json({
        suggestions: [],
        message: "Need at least 2 tables for relationship detection",
      });
    }

    let suggestions = await detectRelationships(tableNames);
    suggestions = await enhanceWithLlm(suggestions);

    // Filter out already-existing relationships in DuckDB
    const existing = await getRelationshipsByTables(safeId, tableNames);
    const existingKeys = new Set(
      existing.map(
        (r) => `${r.from_table}.${r.from_column}-${r.to_table}.${r.to_column}`
      )
    );
    const existingKeysReverse = new Set(
      existing.map(
        (r) => `${r.to_table}.${r.to_column}-${r.from_table}.${r.from_column}`
      )
    );

    const newSuggestions = suggestions.filter((s) => {
      const key = `${s.fromTable}.${s.fromColumn}-${s.toTable}.${s.toColumn}`;
      return !existingKeys.has(key) && !existingKeysReverse.has(key);
    });

    // Auto-insert new suggestions as status='pending' into DuckDB
    const inserted: StoredRelationship[] = [];
    for (const s of newSuggestions) {
      const rel = await createRelationship({
        dashboardId: safeId,
        fromTable: s.fromTable,
        fromColumn: s.fromColumn,
        toTable: s.toTable,
        toColumn: s.toColumn,
        type: s.cardinality,
        confidence: s.confidence,
        source: s.source ?? "auto",
        status: "pending",
      });
      inserted.push(rel);
    }

    // Merge suggestion metadata with stored IDs
    const suggestionsWithIds = newSuggestions.map((s, i) => ({
      ...s,
      relationshipId: inserted[i]?.id,
    }));

    return NextResponse.json({
      suggestions: suggestionsWithIds,
      inserted: inserted.length,
      total: suggestions.length,
      filtered: suggestions.length - newSuggestions.length,
    });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
