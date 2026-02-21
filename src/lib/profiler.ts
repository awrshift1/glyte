import { query } from "./duckdb";
import { quoteLiteral, quoteIdent } from "./sql-utils";

export type ColumnType = "temporal" | "numeric" | "categorical" | "text" | "boolean";

export interface ColumnProfile {
  name: string;
  type: ColumnType;
  distinctCount: number;
  nullCount: number;
  totalCount: number;
  min?: number | string;
  max?: number | string;
  mean?: number;
  sampleValues: string[];
}

export interface TableProfile {
  tableName: string;
  rowCount: number;
  columns: ColumnProfile[];
}

export async function profileTable(tableName: string): Promise<TableProfile> {
  // Get column info
  const colInfo = await query<{
    column_name: string;
    data_type: string;
  }>(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ${quoteLiteral(tableName)} ORDER BY ordinal_position`
  );

  const countResult = await query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM ${quoteIdent(tableName)}`
  );
  const rowCount = countResult[0].cnt;

  const columns: ColumnProfile[] = [];

  for (const col of colInfo) {
    const colName = col.column_name;
    const dtype = col.data_type.toUpperCase();

    // Classify column type
    let colType = classifyColumn(dtype, colName);

    // Get stats
    const stats = await query<Record<string, unknown>>(
      `SELECT
        approx_count_distinct(${quoteIdent(colName)}) as distinct_count,
        COUNT(*) - COUNT(${quoteIdent(colName)}) as null_count,
        COUNT(*) as total_count
      FROM ${quoteIdent(tableName)}`
    );

    const distinctCount = Number(stats[0].distinct_count);
    const nullCount = Number(stats[0].null_count);
    const totalCount = Number(stats[0].total_count);

    // Refine type based on cardinality (use non-null count for sparse columns)
    const nonNullCount = totalCount - nullCount;
    const cardinalityBase = nonNullCount > 0 ? nonNullCount : totalCount;
    if (colType === "categorical" && distinctCount > 50 && distinctCount > cardinalityBase * 0.5) {
      colType = "text";
    }

    const profile: ColumnProfile = {
      name: colName,
      type: colType,
      distinctCount,
      nullCount,
      totalCount,
      sampleValues: [],
    };

    // Get min/max/mean for numeric
    if (colType === "numeric") {
      const numStats = await query<Record<string, unknown>>(
        `SELECT MIN(${quoteIdent(colName)}) as min_val, MAX(${quoteIdent(colName)}) as max_val, AVG(${quoteIdent(colName)}) as mean_val FROM ${quoteIdent(tableName)}`
      );
      profile.min = Number(numStats[0].min_val);
      profile.max = Number(numStats[0].max_val);
      profile.mean = Number(numStats[0].mean_val);
    }

    // Get min/max for temporal
    if (colType === "temporal") {
      const dateStats = await query<Record<string, unknown>>(
        `SELECT MIN(${quoteIdent(colName)})::VARCHAR as min_val, MAX(${quoteIdent(colName)})::VARCHAR as max_val FROM ${quoteIdent(tableName)}`
      );
      profile.min = String(dateStats[0].min_val);
      profile.max = String(dateStats[0].max_val);
    }

    // Sample values
    const samples = await query<Record<string, unknown>>(
      `SELECT DISTINCT ${quoteIdent(colName)}::VARCHAR as val FROM ${quoteIdent(tableName)} WHERE ${quoteIdent(colName)} IS NOT NULL LIMIT 5`
    );
    profile.sampleValues = samples.map((r) => String(r.val));

    columns.push(profile);
  }

  return { tableName, rowCount, columns };
}

function classifyColumn(dtype: string, name: string): ColumnType {
  const nameLower = name.toLowerCase();

  // Temporal by type
  if (dtype.includes("DATE") || dtype.includes("TIMESTAMP") || dtype.includes("TIME")) {
    return "temporal";
  }

  // Temporal by name
  if (
    nameLower.includes("date") ||
    nameLower.includes("time") ||
    nameLower.includes("month") ||
    nameLower.includes("year") ||
    nameLower.includes("created") ||
    nameLower.includes("updated")
  ) {
    return "temporal";
  }

  // Numeric
  if (
    dtype.includes("INT") ||
    dtype.includes("FLOAT") ||
    dtype.includes("DOUBLE") ||
    dtype.includes("DECIMAL") ||
    dtype.includes("NUMERIC") ||
    dtype.includes("BIGINT") ||
    dtype.includes("SMALLINT") ||
    dtype.includes("TINYINT") ||
    dtype.includes("HUGEINT")
  ) {
    return "numeric";
  }

  // Boolean
  if (dtype.includes("BOOLEAN") || dtype.includes("BOOL")) {
    return "boolean";
  }

  // Text by name (identifiers, URLs, emails — always high-cardinality)
  if (
    nameLower.includes("url") ||
    nameLower.includes("link") ||
    nameLower.includes("email") ||
    nameLower.includes("website") ||
    nameLower.includes("domain")
  ) {
    return "text";
  }

  // Default: categorical (VARCHAR, etc)
  return "categorical";
}
