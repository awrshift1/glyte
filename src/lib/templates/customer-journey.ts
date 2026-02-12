import type { TableProfile } from "@/lib/profiler";
import type { DashboardTemplate, TemplateMatch } from "./index";
import type { ChartRecommendation } from "@/lib/chart-recommender";

const EVENT_COLS = /^(event|action|activity|type|event.?type|event.?name|step)$/i;
const USER_COLS = /^(user.?id|customer.?id|account.?id|contact.?id|member.?id|session.?id)$/i;

function formatTitle(name: string): string {
  return name.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c) => c.toUpperCase());
}

export const matchCustomerJourney: DashboardTemplate = {
  id: "customer-journey",
  name: "Customer Journey",
  description: "Best for event/activity data with temporal, event type, and user ID columns. Shows timeline, funnel, and conversion charts.",

  match(profile: TableProfile): TemplateMatch {
    const hasTemporal = profile.columns.some((c) => c.type === "temporal");
    const hasEvent = profile.columns.some((c) => EVENT_COLS.test(c.name));
    const hasUser = profile.columns.some((c) => USER_COLS.test(c.name));

    if (hasTemporal && hasEvent && hasUser) {
      return {
        score: 0.9,
        confidence: 0.9,
        reason: `Temporal + event + user ID columns → customer journey`,
      };
    }
    if (hasTemporal && hasEvent) {
      return {
        score: 0.7,
        confidence: 0.7,
        reason: `Temporal + event columns (no explicit user ID)`,
      };
    }
    return { score: 0, confidence: 0, reason: "No event/journey pattern" };
  },

  generate(profile: TableProfile): ChartRecommendation[] {
    const charts: ChartRecommendation[] = [];
    const table = profile.tableName;
    let id = 0;
    const nextId = () => `chart-${++id}`;
    const temporal = profile.columns.find((c) => c.type === "temporal")!;
    const eventCol = profile.columns.find((c) => EVENT_COLS.test(c.name));
    const userCol = profile.columns.find((c) => USER_COLS.test(c.name));

    // KPI: total events
    charts.push({
      id: nextId(), type: "kpi", title: "Total Events",
      query: `SELECT COUNT(*) as value FROM "${table}"`,
      width: 3, confidence: 0.9, reason: "Total event count",
    });

    // KPI: unique users
    if (userCol) {
      charts.push({
        id: nextId(), type: "kpi", title: "Unique Users",
        query: `SELECT COUNT(DISTINCT "${userCol.name}") as value FROM "${table}"`,
        width: 3, confidence: 0.9, reason: "Distinct user count",
      });
    }

    // KPI: unique event types
    if (eventCol) {
      charts.push({
        id: nextId(), type: "kpi", title: `Event Types`,
        query: `SELECT COUNT(DISTINCT "${eventCol.name}") as value FROM "${table}"`,
        width: 3, confidence: 0.8, reason: "Distinct event types",
      });
    }

    // Timeline: events over time
    charts.push({
      id: nextId(), type: "line",
      title: "Events Over Time",
      query: `SELECT "${temporal.name}", COUNT(*) as "Count" FROM "${table}" GROUP BY "${temporal.name}" ORDER BY "${temporal.name}"`,
      xColumn: temporal.name, yColumns: ["Count"],
      width: 6, confidence: 0.9, reason: `Event frequency over "${temporal.name}"`,
    });

    // Event funnel / breakdown
    if (eventCol) {
      charts.push({
        id: nextId(), type: "horizontal-bar",
        title: `Events by ${formatTitle(eventCol.name)}`,
        query: `SELECT "${eventCol.name}", COUNT(*) as "Count" FROM "${table}" WHERE "${eventCol.name}" IS NOT NULL GROUP BY "${eventCol.name}" ORDER BY COUNT(*) DESC`,
        xColumn: eventCol.name, yColumns: ["Count"],
        width: 6, confidence: 0.85, reason: `Event type distribution`,
      });

      // Users per event type (conversion proxy)
      if (userCol) {
        charts.push({
          id: nextId(), type: "bar",
          title: `Users per ${formatTitle(eventCol.name)}`,
          query: `SELECT "${eventCol.name}", COUNT(DISTINCT "${userCol.name}") as "Users" FROM "${table}" WHERE "${eventCol.name}" IS NOT NULL GROUP BY "${eventCol.name}" ORDER BY "Users" DESC`,
          xColumn: eventCol.name, yColumns: ["Users"],
          width: 6, confidence: 0.8, reason: `Unique users reaching each event type`,
        });
      }
    }

    charts.push({
      id: nextId(), type: "table", title: `${formatTitle(table)} Details`,
      query: `SELECT * FROM "${table}" ORDER BY "${temporal.name}" DESC LIMIT 50`, width: 12,
      confidence: 0.7, reason: `Timeline view of events (most recent first)`,
    });

    return charts;
  },
};
