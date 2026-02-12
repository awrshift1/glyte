import { query } from "@/lib/duckdb";
import { quoteLiteral } from "@/lib/sql-utils";

export interface StoredRelationship {
  id: string;
  dashboard_id: string;
  from_table: string;
  from_column: string;
  to_table: string;
  to_column: string;
  type: "one-to-one" | "one-to-many" | "many-to-many";
  confidence: number | null;
  source: "auto" | "ai-suggested" | "manual";
  status: "pending" | "accepted" | "rejected";
  user_note: string | null;
  created_at: string;
  updated_at: string | null;
}

export async function getRelationships(dashboardId: string): Promise<StoredRelationship[]> {
  return query<StoredRelationship>(
    `SELECT * FROM _glyte_relationships WHERE dashboard_id = ${quoteLiteral(dashboardId)} ORDER BY created_at DESC`
  );
}

export async function getAcceptedRelationships(dashboardId: string): Promise<StoredRelationship[]> {
  return query<StoredRelationship>(
    `SELECT * FROM _glyte_relationships WHERE dashboard_id = ${quoteLiteral(dashboardId)} AND status = 'accepted' ORDER BY created_at`
  );
}

export async function createRelationship(rel: {
  dashboardId: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type?: string;
  confidence?: number;
  source?: string;
  status?: string;
}): Promise<StoredRelationship> {
  const type = rel.type ?? "one-to-many";
  const confidence = rel.confidence ?? null;
  const source = rel.source ?? "manual";
  const status = rel.status ?? "pending";

  // Check for existing relationship (same tuple in either direction)
  const existing = await query<StoredRelationship>(
    `SELECT * FROM _glyte_relationships
     WHERE dashboard_id = ${quoteLiteral(rel.dashboardId)}
       AND ((from_table = ${quoteLiteral(rel.fromTable)} AND from_column = ${quoteLiteral(rel.fromColumn)}
             AND to_table = ${quoteLiteral(rel.toTable)} AND to_column = ${quoteLiteral(rel.toColumn)})
            OR (from_table = ${quoteLiteral(rel.toTable)} AND from_column = ${quoteLiteral(rel.toColumn)}
                AND to_table = ${quoteLiteral(rel.fromTable)} AND to_column = ${quoteLiteral(rel.fromColumn)}))`
  );
  if (existing.length > 0) return existing[0];

  const id = `rel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  await query(
    `INSERT INTO _glyte_relationships (id, dashboard_id, from_table, from_column, to_table, to_column, type, confidence, source, status)
     VALUES (${quoteLiteral(id)}, ${quoteLiteral(rel.dashboardId)}, ${quoteLiteral(rel.fromTable)}, ${quoteLiteral(rel.fromColumn)}, ${quoteLiteral(rel.toTable)}, ${quoteLiteral(rel.toColumn)}, ${quoteLiteral(type)}, ${confidence !== null ? confidence : "NULL"}, ${quoteLiteral(source)}, ${quoteLiteral(status)})`
  );

  const rows = await query<StoredRelationship>(
    `SELECT * FROM _glyte_relationships WHERE id = ${quoteLiteral(id)}`
  );
  return rows[0];
}

export async function updateRelationshipStatus(
  id: string,
  status: "pending" | "accepted" | "rejected",
  userNote?: string
): Promise<void> {
  const noteClause = userNote !== undefined ? `, user_note = ${quoteLiteral(userNote)}` : "";
  await query(
    `UPDATE _glyte_relationships SET status = ${quoteLiteral(status)}, updated_at = current_timestamp${noteClause} WHERE id = ${quoteLiteral(id)}`
  );
}

export async function deleteRelationship(id: string): Promise<void> {
  await query(`DELETE FROM _glyte_relationships WHERE id = ${quoteLiteral(id)}`);
}

export async function getRelationshipsByTables(
  dashboardId: string,
  tableNames: string[]
): Promise<StoredRelationship[]> {
  if (tableNames.length === 0) return [];
  const inClause = tableNames.map(quoteLiteral).join(", ");
  return query<StoredRelationship>(
    `SELECT * FROM _glyte_relationships
     WHERE dashboard_id = ${quoteLiteral(dashboardId)}
       AND from_table IN (${inClause})
       AND to_table IN (${inClause})
     ORDER BY confidence DESC NULLS LAST`
  );
}
