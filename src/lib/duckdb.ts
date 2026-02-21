import { DuckDBInstance, DuckDBConnection } from "@duckdb/node-api";
import path from "path";
import fs from "fs";
import { runMigrations } from "./migrations";
import { quoteIdent, quoteLiteral, safeCsvPath } from "./sql-utils";
import type { SchemaCompatibility } from "@/types/dashboard";
import { DB_PATH } from "./paths";

const POOL_SIZE = 5;

// Survive Next.js hot reload — attach to globalThis
const globalState = globalThis as unknown as {
  __glyte_db?: DuckDBInstance;
  __glyte_pool?: DuckDBConnection[];
  __glyte_active_connections?: number;
};

if (globalState.__glyte_active_connections === undefined) {
  globalState.__glyte_active_connections = 0;
}

async function getInstance(): Promise<DuckDBInstance> {
  if (globalState.__glyte_db) return globalState.__glyte_db;

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const instance = await DuckDBInstance.create(DB_PATH);

  // WAL mode for better concurrency
  const conn = await instance.connect();
  try {
    await conn.run("PRAGMA wal_autocheckpoint='256KB'");
    // Note: enable_external_access left ON because ingestCsv uses read_csv_auto().
    // User SQL is protected by BLOCKED_FUNCTIONS regex in query/route.ts instead.
  } finally {
    conn.closeSync();
  }

  await runMigrations(instance);
  globalState.__glyte_db = instance;
  globalState.__glyte_pool = [];
  return instance;
}

// Connection pool — reuse connections instead of create/destroy per query
const MAX_CONNECTIONS = 20;

async function acquireConnection(): Promise<DuckDBConnection> {
  const db = await getInstance();
  if (!globalState.__glyte_pool) globalState.__glyte_pool = [];
  const conn = globalState.__glyte_pool.pop();
  if (conn) return conn;
  if (globalState.__glyte_active_connections! >= MAX_CONNECTIONS) {
    throw new Error("Connection pool exhausted");
  }
  globalState.__glyte_active_connections!++;
  return db.connect();
}

function releaseConnection(conn: DuckDBConnection, discard = false): void {
  const pool = globalState.__glyte_pool;
  if (!discard && pool && pool.length < POOL_SIZE) {
    pool.push(conn);
  } else {
    globalState.__glyte_active_connections = Math.max(0, globalState.__glyte_active_connections! - 1);
    try { conn.closeSync(); } catch { /* already closed */ }
  }
}

// Serialize write operations to prevent concurrent DDL/DML conflicts
class AsyncMutex {
  private queue: (() => void)[] = [];
  private locked = false;

  async acquire(): Promise<void> {
    if (!this.locked) {
      this.locked = true;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    const next = this.queue.shift();
    if (next) {
      next();
    } else {
      this.locked = false;
    }
  }
}

const writeMutex = new AsyncMutex();

// Check if table exists in persistent DB
async function tableExists(tableName: string): Promise<boolean> {
  const conn = await acquireConnection();
  let bad = false;
  try {
    const result = await conn.run(
      `SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = 'main' AND table_name = ${quoteLiteral(tableName)}`
    );
    const rows = await result.getRows();
    return Number(rows[0][0]) > 0;
  } catch (e) {
    bad = true;
    throw e;
  } finally {
    releaseConnection(conn, bad);
  }
}

// Ensure a table exists — skip re-ingestion if already in persistent DB
export async function ensureTable(tableName: string, csvPath: string): Promise<void> {
  if (await tableExists(tableName)) return;
  if (!fs.existsSync(csvPath)) return;
  await ingestCsv(csvPath, tableName);
}

const QUERY_TIMEOUT_MS = 30_000;

export async function query<T = Record<string, unknown>>(
  sql: string
): Promise<T[]> {
  const conn = await acquireConnection();
  let bad = false;
  try {
    const result = await Promise.race([
      conn.run(sql),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Query timeout: exceeded 30s")), QUERY_TIMEOUT_MS)
      ),
    ]);
    const rows = await result.getRows();
    const columns = result.columnNames();
    return rows.map((row) => {
      const obj: Record<string, unknown> = {};
      columns.forEach((col, i) => {
        const val = row[i];
        if (typeof val === "bigint") {
          obj[col] = Number(val);
        } else if (val !== null && typeof val === "object" && "toISOString" in val) {
          obj[col] = (val as unknown as Date).toISOString().split("T")[0];
        } else if (val !== null && typeof val === "object" && !(val instanceof Array)) {
          obj[col] = String(val);
        } else {
          obj[col] = val;
        }
      });
      return obj as T;
    });
  } catch (e) {
    bad = true;
    throw e;
  } finally {
    releaseConnection(conn, bad);
  }
}

export async function ingestCsv(
  csvPath: string,
  tableName: string
): Promise<{ rows: number; columns: string[] }> {
  await writeMutex.acquire();
  try {
    const conn = await acquireConnection();
    let bad = false;
    try {
      const safeTable = quoteIdent(tableName);
      const safePath = safeCsvPath(csvPath);
      await conn.run(`DROP TABLE IF EXISTS ${safeTable}`);
      await conn.run(
        `CREATE TABLE ${safeTable} AS SELECT * FROM read_csv_auto(${quoteLiteral(safePath)})`
      );
      const countResult = await conn.run(
        `SELECT COUNT(*) as cnt FROM ${safeTable}`
      );
      const countRows = await countResult.getRows();
      const count = Number(countRows[0][0]);

      const colResult = await conn.run(
        `SELECT column_name FROM information_schema.columns WHERE table_name = ${quoteLiteral(tableName)} ORDER BY ordinal_position`
      );
      const colRows = await colResult.getRows();
      const columns = colRows.map((r) => String(r[0]));

      // Track version in _glyte_versions
      try {
        await conn.run(
          `INSERT INTO _glyte_versions (table_name, version, row_count, column_count, csv_path)
           VALUES (${quoteLiteral(tableName)}, 1, ${count}, ${columns.length}, ${quoteLiteral(safePath)})`
        );
      } catch {
        // _glyte_versions may not exist yet during first boot
      }

      return { rows: count, columns };
    } catch (e) {
      bad = true;
      throw e;
    } finally {
      releaseConnection(conn, bad);
    }
  } finally {
    writeMutex.release();
  }
}

export async function dropTable(tableName: string): Promise<void> {
  await writeMutex.acquire();
  try {
    const conn = await acquireConnection();
    let bad = false;
    try {
      await conn.run(`DROP TABLE IF EXISTS ${quoteIdent(tableName)}`);
    } catch (e) {
      bad = true;
      throw e;
    } finally {
      releaseConnection(conn, bad);
    }
  } finally {
    writeMutex.release();
  }
}

export async function getTables(): Promise<string[]> {
  const rows = await query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' AND table_name NOT LIKE '_glyte_%'"
  );
  return rows.map((r) => r.table_name);
}

export type { SchemaCompatibility };

function normalizeColName(name: string): string {
  return name.toLowerCase().replace(/[_\-\s]/g, "");
}

export async function schemaCompatibility(
  sourceTable: string,
  targetTable: string
): Promise<SchemaCompatibility> {
  const srcCols = await query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'main' AND table_name = ${quoteLiteral(sourceTable)} ORDER BY ordinal_position`
  );
  const tgtCols = await query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema = 'main' AND table_name = ${quoteLiteral(targetTable)} ORDER BY ordinal_position`
  );

  const srcNames = srcCols.map((r) => r.column_name);
  const tgtNamesList = tgtCols.map((r) => r.column_name);
  const tgtNames = new Set(tgtNamesList);

  // Pass 1: exact match
  const commonColumns = srcNames.filter((c) => tgtNames.has(c));
  const exactMatchedSrc = new Set(commonColumns);

  // Pass 2: normalized match for unmatched columns
  const unmatchedSrc = srcNames.filter((c) => !exactMatchedSrc.has(c));
  const unmatchedTgt = tgtNamesList.filter((c) => !exactMatchedSrc.has(c));

  const columnMapping: Record<string, string> = {};
  const normalizedTgtMap = new Map<string, string>(); // normalized → original target name
  for (const t of unmatchedTgt) {
    const norm = normalizeColName(t);
    if (!normalizedTgtMap.has(norm)) {
      normalizedTgtMap.set(norm, t);
    }
  }

  const usedTgt = new Set<string>();
  for (const s of unmatchedSrc) {
    const norm = normalizeColName(s);
    const tgtMatch = normalizedTgtMap.get(norm);
    if (tgtMatch && !usedTgt.has(tgtMatch)) {
      columnMapping[s] = tgtMatch;
      usedTgt.add(tgtMatch);
    }
  }

  const mappedSrcSet = new Set(Object.keys(columnMapping));
  const matchedCount = commonColumns.length + mappedSrcSet.size;
  const missingInTarget = srcNames.filter(
    (c) => !exactMatchedSrc.has(c) && !mappedSrcSet.has(c)
  );
  const extraInSource = tgtNamesList.filter(
    (c) => !exactMatchedSrc.has(c) && !usedTgt.has(c)
  );
  const overlapPercent =
    srcNames.length > 0 ? Math.round((matchedCount / srcNames.length) * 100) : 0;

  return {
    compatible: overlapPercent >= 50,
    overlapPercent,
    commonColumns,
    missingInTarget,
    extraInSource,
    ...(Object.keys(columnMapping).length > 0 ? { columnMapping } : {}),
  };
}

export async function appendCsv(
  targetTable: string,
  sourceTable: string,
  sourceLabel: string
): Promise<{ newRows: number; totalRows: number }> {
  await writeMutex.acquire();
  try {
    const conn = await acquireConnection();
    let bad = false;
    try {
      const safeTarget = quoteIdent(targetTable);

      // Ensure _source column exists on target
      const cols = await query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'main' AND table_name = ${quoteLiteral(targetTable)} AND column_name = '_source'`
      );
      if (cols.length === 0) {
        await conn.run(`ALTER TABLE ${safeTarget} ADD COLUMN "_source" VARCHAR`);
      }

      // Add any source columns missing in target (truly unmapped only)
      const compat = await schemaCompatibility(sourceTable, targetTable);
      for (const col of compat.missingInTarget) {
        if (col === "_source") continue;
        await conn.run(`ALTER TABLE ${safeTarget} ADD COLUMN ${quoteIdent(col)} VARCHAR`);
      }

      // Count source rows before insert
      const countBefore = await conn.run(`SELECT COUNT(*) as cnt FROM ${quoteIdent(sourceTable)}`);
      const newRows = Number((await countBefore.getRows())[0][0]);

      // Build SELECT with column mapping aliases
      const mapping = compat.columnMapping ?? {};
      const srcColsResult = await query<{ column_name: string }>(
        `SELECT column_name FROM information_schema.columns WHERE table_schema = 'main' AND table_name = ${quoteLiteral(sourceTable)} ORDER BY ordinal_position`
      );
      const srcColNames = srcColsResult.map((r) => r.column_name);

      const selectParts: string[] = [];
      for (const col of srcColNames) {
        if (mapping[col]) {
          selectParts.push(`${quoteIdent(col)} AS ${quoteIdent(mapping[col])}`);
        } else {
          selectParts.push(quoteIdent(col));
        }
      }
      selectParts.push(`${quoteLiteral(sourceLabel)} AS "_source"`);

      await conn.run(
        `INSERT INTO ${safeTarget} BY NAME (SELECT ${selectParts.join(", ")} FROM ${quoteIdent(sourceTable)})`
      );

      // Get total rows after insert
      const countAfter = await conn.run(`SELECT COUNT(*) as cnt FROM ${safeTarget}`);
      const totalRows = Number((await countAfter.getRows())[0][0]);

      return { newRows, totalRows };
    } catch (e) {
      bad = true;
      throw e;
    } finally {
      releaseConnection(conn, bad);
    }
  } finally {
    writeMutex.release();
  }
}

export async function backfillSource(
  tableName: string,
  label: string
): Promise<void> {
  await query(
    `UPDATE ${quoteIdent(tableName)} SET "_source" = ${quoteLiteral(label)} WHERE "_source" IS NULL`
  );
}

// Graceful shutdown — close all connections and DB instance
async function shutdown() {
  const pool = globalState.__glyte_pool || [];
  for (const conn of pool) {
    try { conn.closeSync(); } catch { /* ignore */ }
  }
  globalState.__glyte_pool = [];
  if (globalState.__glyte_db) {
    try { globalState.__glyte_db.closeSync(); } catch { /* ignore */ }
    globalState.__glyte_db = undefined;
  }
  globalState.__glyte_active_connections = 0;
}

if (typeof process !== "undefined") {
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
