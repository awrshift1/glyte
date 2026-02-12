import { NextRequest, NextResponse } from "next/server";
import { query, dropTable } from "@/lib/duckdb";
import { loadDashboard, buildSafeWhereClause, sanitizeDashboardId } from "@/lib/dashboard-loader";
import { unlink } from "fs/promises";
import path from "path";
import type { ChartData, KpiData } from "@/types/dashboard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const config = await loadDashboard(id);

    const filterParams = request.nextUrl.searchParams.getAll("filter");
    const dateCol = request.nextUrl.searchParams.get("dateCol") ?? undefined;
    const dateFrom = request.nextUrl.searchParams.get("dateFrom") ?? undefined;
    const dateTo = request.nextUrl.searchParams.get("dateTo") ?? undefined;
    const dateRange = dateCol ? { col: dateCol, from: dateFrom, to: dateTo } : undefined;
    const { clause: whereClause } = buildSafeWhereClause(filterParams, config, dateRange);

    const chartResults: (ChartData | KpiData)[] = [];

    // Task #14: parallel chart queries
    const chartPromises = config.charts.map(async (chart) => {
      try {
        const filteredQuery = injectWhere(chart.query, whereClause);
        const data = await query(filteredQuery);

        if (chart.type === "kpi") {
          const row = data[0] as Record<string, unknown>;
          const value = Number(Object.values(row)[0]) || 0;
          return {
            id: chart.id,
            title: chart.title,
            value,
            width: chart.width,
          } as KpiData;
        } else {
          return {
            id: chart.id,
            type: chart.type,
            title: chart.title,
            width: chart.width,
            xColumn: chart.xColumn,
            yColumns: chart.yColumns,
            groupBy: chart.groupBy,
            data: data as Record<string, unknown>[],
            confidence: chart.confidence,
            reason: chart.reason,
          } as ChartData;
        }
      } catch (err) {
        console.error(`Chart ${chart.id} query failed:`, err);
        return {
          id: chart.id,
          type: chart.type,
          title: chart.title + " (error)",
          width: chart.width,
          data: [],
        } as ChartData;
      }
    });

    const results = await Promise.all(chartPromises);
    chartResults.push(...results);

    return NextResponse.json({ config, charts: chartResults });
  } catch (error) {
    return NextResponse.json(
      { error: String(error) },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const safeId = sanitizeDashboardId(id);
    const config = await loadDashboard(id);

    // Drop DuckDB table
    await dropTable(config.tableName);

    // Delete config JSON
    const configPath = path.join(process.cwd(), "data", "dashboards", `${safeId}.json`);
    await unlink(configPath).catch(() => {});

    return NextResponse.json({ deleted: true, id: safeId });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

function injectWhere(sql: string, whereClause: string): string {
  if (!whereClause) return sql;
  const insertPoints = [/\bGROUP BY\b/i, /\bORDER BY\b/i, /\bLIMIT\b/i];
  for (const re of insertPoints) {
    const match = sql.match(re);
    if (match && match.index !== undefined) {
      const hasWhere = /\bWHERE\b/i.test(sql.substring(0, match.index));
      const keyword = hasWhere ? " AND " : " WHERE ";
      return (
        sql.substring(0, match.index) +
        keyword +
        whereClause +
        " " +
        sql.substring(match.index)
      );
    }
  }
  const hasWhere = /\bWHERE\b/i.test(sql);
  return sql + (hasWhere ? " AND " : " WHERE ") + whereClause;
}
