import type { DuckDBInstance } from "@duckdb/node-api";

interface Migration {
  version: number;
  sql: string[];
}

const migrations: Migration[] = [
  {
    version: 1,
    sql: [
      `CREATE TABLE IF NOT EXISTS _glyte_meta (key VARCHAR PRIMARY KEY, value VARCHAR)`,
      `INSERT OR IGNORE INTO _glyte_meta VALUES ('schema_version', '1')`,
      `CREATE TABLE IF NOT EXISTS _glyte_versions (
        id INTEGER PRIMARY KEY,
        table_name VARCHAR NOT NULL,
        version INTEGER DEFAULT 1,
        row_count INTEGER,
        column_count INTEGER,
        csv_path VARCHAR,
        created_at TIMESTAMP DEFAULT current_timestamp
      )`,
    ],
  },
  {
    version: 2,
    sql: [
      `CREATE TABLE IF NOT EXISTS _glyte_relationships (
        id VARCHAR PRIMARY KEY,
        dashboard_id VARCHAR NOT NULL,
        from_table VARCHAR NOT NULL,
        from_column VARCHAR NOT NULL,
        to_table VARCHAR NOT NULL,
        to_column VARCHAR NOT NULL,
        type VARCHAR DEFAULT 'one-to-many',
        confidence DOUBLE,
        source VARCHAR DEFAULT 'auto',
        status VARCHAR DEFAULT 'pending',
        user_note VARCHAR,
        created_at TIMESTAMP DEFAULT current_timestamp
      )`,
      `UPDATE _glyte_meta SET value = '2' WHERE key = 'schema_version'`,
    ],
  },
  {
    version: 3,
    sql: [
      `ALTER TABLE _glyte_relationships ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP`,
      `UPDATE _glyte_meta SET value = '3' WHERE key = 'schema_version'`,
    ],
  },
  {
    version: 4,
    sql: [
      `CREATE TABLE IF NOT EXISTS _glyte_icp_results (
        id INTEGER PRIMARY KEY,
        table_name VARCHAR NOT NULL,
        row_number INTEGER NOT NULL,
        icp_tier VARCHAR,
        classifier_version VARCHAR,
        classified_at TIMESTAMP DEFAULT current_timestamp,
        UNIQUE(table_name, row_number, classifier_version)
      )`,
      `UPDATE _glyte_meta SET value = '4' WHERE key = 'schema_version'`,
    ],
  },
  {
    version: 5,
    sql: [
      `DROP TABLE IF EXISTS _glyte_icp_results`,
      `CREATE TABLE _glyte_icp_results (
        table_name VARCHAR NOT NULL,
        row_number INTEGER NOT NULL,
        icp_tier VARCHAR,
        classifier_version VARCHAR,
        classified_at TIMESTAMP DEFAULT current_timestamp,
        PRIMARY KEY(table_name, row_number, classifier_version)
      )`,
      `UPDATE _glyte_meta SET value = '5' WHERE key = 'schema_version'`,
    ],
  },
];

export async function runMigrations(db: DuckDBInstance): Promise<void> {
  const conn = await db.connect();
  try {
    // Check if _glyte_meta exists
    const tables = await conn.run(
      `SELECT table_name FROM information_schema.tables WHERE table_name = '_glyte_meta'`
    );
    const tableRows = await tables.getRows();
    let currentVersion = 0;

    if (tableRows.length > 0) {
      const versionResult = await conn.run(
        `SELECT value FROM _glyte_meta WHERE key = 'schema_version'`
      );
      const versionRows = await versionResult.getRows();
      if (versionRows.length > 0) {
        currentVersion = parseInt(String(versionRows[0][0]), 10);
      }
    }

    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        await conn.run("BEGIN TRANSACTION");
        try {
          for (const sql of migration.sql) {
            await conn.run(sql);
          }
          await conn.run(
            `UPDATE _glyte_meta SET value = '${migration.version}' WHERE key = 'schema_version'`
          );
          await conn.run("COMMIT");
        } catch (e) {
          await conn.run("ROLLBACK");
          throw e;
        }
      }
    }
  } finally {
    conn.closeSync();
  }
}
