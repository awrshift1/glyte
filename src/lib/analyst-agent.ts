import "server-only";
import { generateText, tool, stepCountIs } from "ai";
import type { LanguageModel } from "ai";
import { z } from "zod";
import { query } from "./duckdb";
import { quoteIdent, safeErrorMessage } from "./sql-utils";

export interface AgentResult {
  insight: string;
  sql?: string;
  results?: Record<string, unknown>[];
  columns?: string[];
  isTextOnly: boolean;
}

const BLOCKED_SQL = /\b(INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|TRUNCATE|EXEC|EXECUTE|GRANT|REVOKE|INTO\s+OUTFILE|LOAD|COPY|ATTACH|DETACH|INSTALL|PRAGMA)\b/i;

/**
 * Agentic analyst — explores data via tools before answering.
 * Unlike one-shot generateObject, the LLM can:
 *  1. Sample actual data rows
 *  2. Check distinct values for filtering
 *  3. Run SQL and see results
 *  4. Iterate on errors
 */
export async function runAnalystAgent(params: {
  model: LanguageModel;
  systemPrompt: string;
  question: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  allowedTables: Set<string>;
}): Promise<AgentResult> {
  // Closure to capture the last successful query
  let lastSql: string | undefined;
  let lastResults: Record<string, unknown>[] | undefined;

  const result = await generateText({
    model: params.model,
    system: params.systemPrompt,
    messages: [
      ...params.messages,
      { role: "user" as const, content: params.question },
    ],
    tools: {
      sampleData: tool({
        description:
          "Get sample rows from a table to understand actual data values. Always call this FIRST before writing SQL, so you know what the data looks like.",
        inputSchema: z.object({
          tableName: z.string().describe("Table name"),
          limit: z
            .number()
            .optional()
            .describe("Number of rows to return, default 5"),
        }),
        execute: async ({ tableName, limit }) => {
          if (!params.allowedTables.has(tableName.toLowerCase())) {
            return { error: `Table "${tableName}" not available. Available: ${[...params.allowedTables].join(", ")}` };
          }
          try {
            const rows = await query<Record<string, unknown>>(
              `SELECT * FROM ${quoteIdent(tableName)} LIMIT ${Math.min(limit ?? 5, 20)}`
            );
            return { tableName, rows, rowCount: rows.length };
          } catch (e) {
            return { error: safeErrorMessage(e) };
          }
        },
      }),

      getDistinctValues: tool({
        description:
          "Get distinct values of a column with counts. Useful to check what categories/filters exist before writing a query.",
        inputSchema: z.object({
          tableName: z.string(),
          column: z.string(),
          limit: z
            .number()
            .optional()
            .describe("Max values to return, default 20"),
        }),
        execute: async ({ tableName, column, limit }) => {
          if (!params.allowedTables.has(tableName.toLowerCase())) {
            return { error: `Table "${tableName}" not available` };
          }
          try {
            const rows = await query<Record<string, unknown>>(
              `SELECT ${quoteIdent(column)}::VARCHAR as value, COUNT(*) as count FROM ${quoteIdent(tableName)} GROUP BY ${quoteIdent(column)} ORDER BY count DESC LIMIT ${Math.min(limit ?? 20, 50)}`
            );
            return { column, values: rows };
          } catch (e) {
            return { error: safeErrorMessage(e) };
          }
        },
      }),

      runQuery: tool({
        description:
          "Execute a SQL SELECT query on DuckDB and return results. Use after exploring data with sampleData/getDistinctValues. If the query fails, read the error and try a corrected query.",
        inputSchema: z.object({
          sql: z.string().describe("DuckDB SELECT query. No semicolons."),
        }),
        execute: async ({ sql }) => {
          if (!/^\s*(SELECT|WITH)\b/i.test(sql)) {
            return { error: "Only SELECT/WITH queries are allowed" };
          }
          if (BLOCKED_SQL.test(sql)) {
            return { error: "Query contains blocked keywords" };
          }
          try {
            const rows = await query<Record<string, unknown>>(sql);
            lastSql = sql;
            lastResults = rows;
            const cols =
              rows.length > 0 ? Object.keys(rows[0]) : [];
            return {
              columns: cols,
              rows: rows.slice(0, 30),
              totalRows: rows.length,
              truncated: rows.length > 30,
            };
          } catch (e) {
            return { error: safeErrorMessage(e) };
          }
        },
      }),
    },
    stopWhen: stepCountIs(8),
  });

  return {
    insight: result.text || "Analysis complete.",
    sql: lastSql,
    results: lastResults,
    columns:
      lastResults && lastResults.length > 0
        ? Object.keys(lastResults[0])
        : undefined,
    isTextOnly: !lastSql,
  };
}
