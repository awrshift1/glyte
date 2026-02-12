import "server-only";
import type { DashboardConfig } from "@/types/dashboard";
import { getAcceptedRelationships } from "@/lib/relationship-store";
import { query } from "@/lib/duckdb";
import { quoteLiteral } from "@/lib/sql-utils";

/**
 * Build multi-table system prompt with relationships and JOIN guidance.
 * Reads only 'accepted' relationships from DuckDB for AI context.
 * Server-only: uses DuckDB via relationship-store.
 */
export async function buildMultiTablePrompt(config: DashboardConfig): Promise<string> {
  const tables = config.tables ?? [];

  const accepted = await getAcceptedRelationships(config.id);

  // Fetch column schemas for secondary tables so AI can write valid SQL
  const tableSchemaBlocks: string[] = [];
  for (const t of tables) {
    const cols = await query<{ column_name: string; data_type: string }>(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ${quoteLiteral(t.tableName)} ORDER BY ordinal_position`
    );
    const excluded = new Set(t.excludedColumns ?? []);
    const visibleCols = cols.filter((c) => !excluded.has(c.column_name));
    const colLines = visibleCols.map((c) => `    ${c.column_name} (${c.data_type})`).join("\n");
    tableSchemaBlocks.push(`TABLE: "${t.tableName}" (${t.rowCount} rows)\n  COLUMNS:\n${colLines}`);
  }
  const tableSchemas = tableSchemaBlocks.join("\n\n");

  const relDescriptions = accepted.map((r) => {
    const arrow = r.type === "one-to-many" ? "1→N" : r.type === "one-to-one" ? "1→1" : "N→N";
    return `  "${r.from_table}"."${r.from_column}" ${arrow} "${r.to_table}"."${r.to_column}"`;
  }).join("\n");

  const joinExamples = accepted.map((r) => {
    return `SELECT * FROM "${r.from_table}" JOIN "${r.to_table}" ON "${r.from_table}"."${r.from_column}" = "${r.to_table}"."${r.to_column}" LIMIT 10`;
  }).join("\n\n");

  return `
ADDITIONAL TABLES IN THIS DASHBOARD:
${tableSchemas}

RELATIONSHIPS:
${relDescriptions || "  (no relationships defined — use separate queries per table)"}

JOIN RULES:
- NEVER use CROSS JOIN
- Always use explicit JOIN conditions from the relationships above
- Add LIMIT 1000 if the query involves JOINs and doesn't already have a LIMIT
- Only JOIN tables that have a defined relationship above
- If no relationship exists between tables, query them separately

JOIN EXAMPLES:
${joinExamples || "  (no JOIN examples — query tables independently)"}
`;
}
