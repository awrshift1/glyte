import type { TableProfile } from "@/lib/profiler";
import type { DashboardTemplate, TemplateMatch } from "./index";
import type { ChartRecommendation } from "@/lib/chart-recommender";
import { quoteIdent } from "@/lib/sql-utils";

const CHANNEL_COLS = /^(channel|source|medium|campaign|utm.?source|utm.?medium|platform|ad.?group)$/i;

function formatTitle(name: string): string {
  return name.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const matchChannelComparison: DashboardTemplate = {
  id: "channel-comparison",
  name: "Channel Comparison",
  description: "Best for marketing data with channel/source columns and numeric metrics. Shows grouped bars, donuts, and trends.",

  match(profile: TableProfile): TemplateMatch {
    const hasChannel = profile.columns.some((c) => CHANNEL_COLS.test(c.name));
    const numericCount = profile.columns.filter((c) => c.type === "numeric").length;

    if (hasChannel && numericCount >= 2) {
      return {
        score: 0.85,
        confidence: 0.85,
        reason: `Channel/source column + ${numericCount} metrics → channel comparison`,
      };
    }
    if (hasChannel) {
      return {
        score: 0.65,
        confidence: 0.65,
        reason: `Channel column found, limited metrics`,
      };
    }
    return { score: 0, confidence: 0, reason: "No channel/source columns" };
  },

  generate(profile: TableProfile): ChartRecommendation[] {
    const charts: ChartRecommendation[] = [];
    const table = profile.tableName;
    let id = 0;
    const nextId = () => `chart-${++id}`;
    const numerics = profile.columns.filter((c) => c.type === "numeric");
    const channelCol = profile.columns.find((c) => CHANNEL_COLS.test(c.name))!;

    // KPIs for top metrics
    for (const num of numerics.slice(0, 4)) {
      charts.push({
        id: nextId(), type: "kpi", title: `Total ${formatTitle(num.name)}`,
        query: `SELECT SUM(${quoteIdent(num.name)}) as value FROM ${quoteIdent(table)}`,
        width: 3, confidence: 0.85, reason: `Aggregate "${num.name}"`,
      });
    }

    // Grouped bar: top metric by channel
    if (numerics.length > 0) {
      charts.push({
        id: nextId(), type: "horizontal-bar",
        title: `${formatTitle(numerics[0].name)} by ${formatTitle(channelCol.name)}`,
        query: `SELECT ${quoteIdent(channelCol.name)}, SUM(${quoteIdent(numerics[0].name)}) as ${quoteIdent(numerics[0].name)} FROM ${quoteIdent(table)} GROUP BY ${quoteIdent(channelCol.name)} ORDER BY SUM(${quoteIdent(numerics[0].name)}) DESC`,
        xColumn: channelCol.name, yColumns: [numerics[0].name],
        width: 6, confidence: 0.9, reason: `Primary metric by channel`,
      });
    }

    // Donut: channel distribution
    charts.push({
      id: nextId(), type: "donut",
      title: `${formatTitle(channelCol.name)} Distribution`,
      query: `SELECT ${quoteIdent(channelCol.name)}, COUNT(*) as "Count" FROM ${quoteIdent(table)} WHERE ${quoteIdent(channelCol.name)} IS NOT NULL GROUP BY ${quoteIdent(channelCol.name)} ORDER BY COUNT(*) DESC`,
      xColumn: channelCol.name, yColumns: ["Count"],
      width: 6, confidence: 0.8, reason: `Channel proportions`,
    });

    // Multi-metric comparison
    if (numerics.length >= 2) {
      charts.push({
        id: nextId(), type: "bar",
        title: `${formatTitle(numerics[1].name)} by ${formatTitle(channelCol.name)}`,
        query: `SELECT ${quoteIdent(channelCol.name)}, SUM(${quoteIdent(numerics[1].name)}) as ${quoteIdent(numerics[1].name)} FROM ${quoteIdent(table)} GROUP BY ${quoteIdent(channelCol.name)} ORDER BY SUM(${quoteIdent(numerics[1].name)}) DESC`,
        xColumn: channelCol.name, yColumns: [numerics[1].name],
        width: 6, confidence: 0.75, reason: `Secondary metric by channel`,
      });
    }

    // Temporal trend if available
    const temporal = profile.columns.find((c) => c.type === "temporal");
    if (temporal && numerics.length > 0) {
      charts.push({
        id: nextId(), type: "line",
        title: `${formatTitle(numerics[0].name)} Over Time`,
        query: `SELECT ${quoteIdent(temporal.name)}, SUM(${quoteIdent(numerics[0].name)}) as ${quoteIdent(numerics[0].name)} FROM ${quoteIdent(table)} GROUP BY ${quoteIdent(temporal.name)} ORDER BY ${quoteIdent(temporal.name)}`,
        xColumn: temporal.name, yColumns: [numerics[0].name],
        width: 6, confidence: 0.85, reason: `Temporal trend of primary metric`,
      });
    }

    charts.push({
      id: nextId(), type: "table", title: `${formatTitle(table)} Details`,
      query: `SELECT * FROM ${quoteIdent(table)} LIMIT 50`, width: 12,
      confidence: 0.7, reason: `Channel data preview (first 50 rows)`,
    });

    return charts;
  },
};
