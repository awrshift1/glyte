import { query } from "@/lib/duckdb";
import { getTier } from "@/lib/icp-classifier";
import { quoteIdent, quoteLiteral } from "@/lib/sql-utils";
import type { IcpTier } from "@/lib/icp-classifier";

const BATCH_SIZE = 500;

export async function POST(request: Request) {
  const { tableName, titleColumn, companyColumn, version = "v1.0" } =
    await request.json();

  if (!tableName || !titleColumn) {
    return Response.json(
      { error: "tableName and titleColumn are required" },
      { status: 400 },
    );
  }

  const safeTable = quoteIdent(tableName);

  // Validate table exists
  const tableCheck = await query<{ cnt: number }>(
    `SELECT COUNT(*) as cnt FROM information_schema.tables WHERE table_schema = 'main' AND table_name = ${quoteLiteral(tableName)}`,
  );
  if (!tableCheck[0] || tableCheck[0].cnt === 0) {
    return Response.json(
      { error: `Table "${tableName}" not found` },
      { status: 404 },
    );
  }

  // Build SELECT columns
  const selectCols = [
    "rowid",
    quoteIdent(titleColumn),
    ...(companyColumn ? [quoteIdent(companyColumn)] : []),
  ].join(", ");

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Fetch all rows
        const rows = await query<Record<string, unknown>>(
          `SELECT ${selectCols} FROM ${safeTable}`,
        );
        const total = rows.length;
        const tierCounts: Record<string, number> = {};
        let icpCount = 0;
        let rejectedCount = 0;

        // Delete old results for this table + version
        await query(
          `DELETE FROM _glyte_icp_results WHERE table_name = ${quoteLiteral(tableName)} AND classifier_version = ${quoteLiteral(version)}`,
        );

        // Process in batches
        for (let i = 0; i < total; i += BATCH_SIZE) {
          const batch = rows.slice(i, i + BATCH_SIZE);
          const values: string[] = [];

          for (const row of batch) {
            const title = String(row[titleColumn] ?? "");
            const company = companyColumn
              ? String(row[companyColumn] ?? "")
              : undefined;
            const tier: IcpTier | null = getTier(title, company);

            if (tier) {
              icpCount++;
              tierCounts[tier] = (tierCounts[tier] || 0) + 1;
              values.push(
                `(${quoteLiteral(tableName)}, ${Number(row.rowid)}, ${quoteLiteral(tier)}, ${quoteLiteral(version)})`,
              );
            } else {
              rejectedCount++;
            }
          }

          // Insert batch results
          if (values.length > 0) {
            await query(
              `INSERT INTO _glyte_icp_results (table_name, row_number, icp_tier, classifier_version)
               VALUES ${values.join(", ")}`,
            );
          }

          // Stream progress
          const progress = {
            type: "progress" as const,
            processed: Math.min(i + BATCH_SIZE, total),
            total,
            tierCounts: { ...tierCounts },
          };
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(progress)}\n\n`),
          );
        }

        // Create enriched view
        await query(
          `CREATE OR REPLACE VIEW ${quoteIdent(`${tableName}_enriched`)} AS
           SELECT t.*, m.icp_tier
           FROM ${safeTable} t
           LEFT JOIN _glyte_icp_results m
             ON m.table_name = ${quoteLiteral(tableName)}
             AND m.row_number = t.rowid
             AND m.classifier_version = ${quoteLiteral(version)}`,
        );

        // Stream completion
        const complete = {
          type: "complete" as const,
          summary: {
            total,
            icp: icpCount,
            rejected: rejectedCount,
            byTier: { ...tierCounts },
          },
        };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(complete)}\n\n`),
        );
        controller.close();
      } catch (error) {
        const errMsg =
          error instanceof Error ? error.message : "Classification failed";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", error: errMsg })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
