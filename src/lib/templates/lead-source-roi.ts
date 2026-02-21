import type { TableProfile } from "@/lib/profiler";
import type { DashboardTemplate, TemplateMatch } from "./index";
import type { ChartRecommendation } from "@/lib/chart-recommender";
import { quoteIdent } from "@/lib/sql-utils";

const SOURCE_COLS = /^(source|lead.?source|referral|origin|acquisition)$/i;
const COST_COLS = /^(cost|spend|budget|investment|ad.?spend|cpa|cpc)$/i;
const REVENUE_COLS = /^(revenue|income|value|amount|deal.?value|ltv|arpu|mrr)$/i;

function formatTitle(name: string): string {
  return name.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const matchLeadSourceRoi: DashboardTemplate = {
  id: "lead-source-roi",
  name: "Lead Source ROI",
  description: "Best for data with source, cost, and revenue columns. Shows ROI KPIs, source comparison, and efficiency metrics.",

  match(profile: TableProfile): TemplateMatch {
    const hasSource = profile.columns.some((c) => SOURCE_COLS.test(c.name));
    const hasCost = profile.columns.some((c) => COST_COLS.test(c.name));
    const hasRevenue = profile.columns.some((c) => REVENUE_COLS.test(c.name));

    if (hasSource && hasCost && hasRevenue) {
      return {
        score: 0.9,
        confidence: 0.9,
        reason: `Source + cost + revenue columns → ROI analysis`,
      };
    }
    if (hasSource && (hasCost || hasRevenue)) {
      return {
        score: 0.7,
        confidence: 0.7,
        reason: `Source column + partial financial data`,
      };
    }
    return { score: 0, confidence: 0, reason: "No source/ROI pattern" };
  },

  generate(profile: TableProfile): ChartRecommendation[] {
    const charts: ChartRecommendation[] = [];
    const table = profile.tableName;
    let id = 0;
    const nextId = () => `chart-${++id}`;
    const sourceCol = profile.columns.find((c) => SOURCE_COLS.test(c.name))!;
    const costCol = profile.columns.find((c) => COST_COLS.test(c.name));
    const revenueCol = profile.columns.find((c) => REVENUE_COLS.test(c.name));

    // KPIs
    if (revenueCol) {
      charts.push({
        id: nextId(), type: "kpi", title: `Total ${formatTitle(revenueCol.name)}`,
        query: `SELECT SUM(${quoteIdent(revenueCol.name)}) as value FROM ${quoteIdent(table)}`,
        width: 3, confidence: 0.9, reason: "Total revenue/value",
      });
    }
    if (costCol) {
      charts.push({
        id: nextId(), type: "kpi", title: `Total ${formatTitle(costCol.name)}`,
        query: `SELECT SUM(${quoteIdent(costCol.name)}) as value FROM ${quoteIdent(table)}`,
        width: 3, confidence: 0.9, reason: "Total cost/spend",
      });
    }
    if (costCol && revenueCol) {
      charts.push({
        id: nextId(), type: "kpi", title: "ROI",
        query: `SELECT ROUND((SUM(${quoteIdent(revenueCol.name)}) - SUM(${quoteIdent(costCol.name)})) / NULLIF(SUM(${quoteIdent(costCol.name)}), 0) * 100, 1) as value FROM ${quoteIdent(table)}`,
        width: 3, confidence: 0.85, reason: "Return on investment percentage",
      });
    }
    charts.push({
      id: nextId(), type: "kpi", title: "Total Records",
      query: `SELECT COUNT(*) as value FROM ${quoteIdent(table)}`,
      width: 3, confidence: 0.8, reason: "Record count",
    });

    // Revenue by source
    if (revenueCol) {
      charts.push({
        id: nextId(), type: "horizontal-bar",
        title: `${formatTitle(revenueCol.name)} by ${formatTitle(sourceCol.name)}`,
        query: `SELECT ${quoteIdent(sourceCol.name)}, SUM(${quoteIdent(revenueCol.name)}) as ${quoteIdent(revenueCol.name)} FROM ${quoteIdent(table)} GROUP BY ${quoteIdent(sourceCol.name)} ORDER BY SUM(${quoteIdent(revenueCol.name)}) DESC`,
        xColumn: sourceCol.name, yColumns: [revenueCol.name],
        width: 6, confidence: 0.9, reason: "Revenue breakdown by source",
      });
    }

    // Cost by source
    if (costCol) {
      charts.push({
        id: nextId(), type: "horizontal-bar",
        title: `${formatTitle(costCol.name)} by ${formatTitle(sourceCol.name)}`,
        query: `SELECT ${quoteIdent(sourceCol.name)}, SUM(${quoteIdent(costCol.name)}) as ${quoteIdent(costCol.name)} FROM ${quoteIdent(table)} GROUP BY ${quoteIdent(sourceCol.name)} ORDER BY SUM(${quoteIdent(costCol.name)}) DESC`,
        xColumn: sourceCol.name, yColumns: [costCol.name],
        width: 6, confidence: 0.85, reason: "Cost breakdown by source",
      });
    }

    // Source distribution donut
    charts.push({
      id: nextId(), type: "donut",
      title: `Records by ${formatTitle(sourceCol.name)}`,
      query: `SELECT ${quoteIdent(sourceCol.name)}, COUNT(*) as "Count" FROM ${quoteIdent(table)} WHERE ${quoteIdent(sourceCol.name)} IS NOT NULL GROUP BY ${quoteIdent(sourceCol.name)} ORDER BY COUNT(*) DESC`,
      xColumn: sourceCol.name, yColumns: ["Count"],
      width: 6, confidence: 0.8, reason: "Source distribution",
    });

    // Temporal trend
    const temporal = profile.columns.find((c) => c.type === "temporal");
    if (temporal && revenueCol) {
      charts.push({
        id: nextId(), type: "line",
        title: `${formatTitle(revenueCol.name)} Over Time`,
        query: `SELECT ${quoteIdent(temporal.name)}, SUM(${quoteIdent(revenueCol.name)}) as ${quoteIdent(revenueCol.name)} FROM ${quoteIdent(table)} GROUP BY ${quoteIdent(temporal.name)} ORDER BY ${quoteIdent(temporal.name)}`,
        xColumn: temporal.name, yColumns: [revenueCol.name],
        width: 6, confidence: 0.85, reason: "Revenue trend",
      });
    }

    charts.push({
      id: nextId(), type: "table", title: `${formatTitle(table)} Details`,
      query: `SELECT * FROM ${quoteIdent(table)} LIMIT 50`, width: 12,
      confidence: 0.7, reason: `Source performance details`,
    });

    return charts;
  },
};
