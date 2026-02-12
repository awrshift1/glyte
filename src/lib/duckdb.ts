import { DuckDBInstance } from "@duckdb/node-api";
import path from "path";
import fs from "fs";
import { runMigrations } from "./migrations";
import { quoteIdent, quoteLiteral, safeCsvPath } from "./sql-utils";

const DB_PATH = path.join(process.cwd(), "data", "glyte.duckdb");

// Survive Next.js hot reload — attach to globalThis
const globalDb = globalThis as unknown as { __glyte_db?: DuckDBInstance };

async function getInstance(): Promise<DuckDBInstance> {
  if (globalDb.__glyte_db) return globalDb.__glyte_db;

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
  } finally {
    conn.closeSync();
  }

  await runMigrations(instance);
  globalDb.__glyte_db = instance;
  return instance;
}

// Check if table exists in persistent DB
async function tableExists(tableName: string): Promise<boolean> {
  const db = await getInstance();
  const conn = await db.connect();
  try {
    const result = await conn.run(
      `SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = 'main' AND table_name = ${quoteLiteral(tableName)}`
    );
    const rows = await result.getRows();
    return Number(rows[0][0]) > 0;
  } finally {
    conn.closeSync();
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
  const db = await getInstance();
  const conn = await db.connect();
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
  } finally {
    conn.closeSync();
  }
}

export async function ingestCsv(
  csvPath: string,
  tableName: string
): Promise<{ rows: number; columns: string[] }> {
  const db = await getInstance();
  const conn = await db.connect();
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
  } finally {
    conn.closeSync();
  }
}

export async function dropTable(tableName: string): Promise<void> {
  const db = await getInstance();
  const conn = await db.connect();
  try {
    await conn.run(`DROP TABLE IF EXISTS ${quoteIdent(tableName)}`);
  } finally {
    conn.closeSync();
  }
}

export async function getTables(): Promise<string[]> {
  const rows = await query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'main' AND table_name NOT LIKE '_glyte_%'"
  );
  return rows.map((r) => r.table_name);
}
