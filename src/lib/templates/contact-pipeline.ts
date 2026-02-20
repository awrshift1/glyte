import type { TableProfile, ColumnProfile } from "@/lib/profiler";
import type { DashboardTemplate, TemplateMatch } from "./index";
import type { ChartRecommendation } from "@/lib/chart-recommender";

const CONTACT_COLS = /^(email|name|first.?name|last.?name|full.?name|phone|contact)$/i;
const STATUS_COLS = /^(status|stage|pipeline|funnel|lead.?status|deal.?stage)$/i;
const SEGMENT_COLS = /^(tier|icp.?tier|segment|category|grade|type|group|region|country|source|channel)$/i;

// Columns that are identifiers — not useful for charts
const IDENTIFIER_PATTERN = /^(id|uuid|_id|key)$/i;
const URL_PATTERN = /url|link|linkedin|website|href/i;
const FREETEXT_PATTERN = /^(description|bio|summary|notes?|comment|about|message|body|text)$/i;

function formatTitle(name: string): string {
  return name.replace(/_/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isIdentifier(col: ColumnProfile, rowCount: number): boolean {
  if (IDENTIFIER_PATTERN.test(col.name)) return true;
  if (URL_PATTERN.test(col.name)) return true;
  if (CONTACT_COLS.test(col.name)) return true; // Contact fields (email, name, phone) are identity, not analytical
  if (FREETEXT_PATTERN.test(col.name)) return true; // Free-text fields are not analytical dimensions
  // Very high cardinality (>80% unique) = likely identifier
  if (col.distinctCount > rowCount * 0.8) return true;
  // Sparse column: very few non-null values relative to rows — not useful for distribution
  const nonNull = col.totalCount - col.nullCount;
  if (nonNull > 0 && nonNull < rowCount * 0.1 && col.distinctCount <= nonNull) return true;
  return false;
}

export const matchContactPipeline: DashboardTemplate = {
  id: "contact-pipeline",
  name: "Contact Pipeline",
  description: "Best for contact/lead lists. Shows segment breakdowns, top companies, job titles, and coverage metrics.",

  match(profile: TableProfile): TemplateMatch {
    const hasContact = profile.columns.some((c) => CONTACT_COLS.test(c.name));
    const hasStatus = profile.columns.some((c) => STATUS_COLS.test(c.name));
    const hasSegment = profile.columns.some((c) => SEGMENT_COLS.test(c.name));
    const hasIcpTier = profile.columns.some((c) => /^icp.?tier$/i.test(c.name));

    if (hasContact && hasIcpTier) {
      return { score: 0.95, confidence: 0.95, reason: "Contact list with ICP classification detected" };
    }
    if (hasContact && hasStatus) {
      return { score: 0.85, confidence: 0.85, reason: "Contact + status/stage column detected" };
    }
    if (hasContact && hasSegment) {
      return { score: 0.8, confidence: 0.8, reason: "Contact + segment/tier column detected" };
    }
    if (hasContact) {
      return { score: 0.6, confidence: 0.6, reason: "Contact column found" };
    }
    return { score: 0, confidence: 0, reason: "No contact columns" };
  },

  generate(profile: TableProfile): ChartRecommendation[] {
    const charts: ChartRecommendation[] = [];
    const table = profile.tableName;
    let id = 0;
    const nextId = () => `chart-${++id}`;

    // Classify columns for charting
    const lowCard = profile.columns.filter(
      (c) => (c.type === "categorical" || c.type === "text") &&
        c.distinctCount >= 2 && c.distinctCount <= 20 &&
        !isIdentifier(c, profile.rowCount)
    );
    const highCard = profile.columns.filter(
      (c) => (c.type === "categorical" || c.type === "text") &&
        c.distinctCount > 20 && c.distinctCount <= profile.rowCount * 0.8 &&
        !isIdentifier(c, profile.rowCount)
    );
    const coverageCols = profile.columns.filter(
      (c) => /email|domain|phone|linkedin|url|website/i.test(c.name) && c.nullCount > 0
    );
    const statusCol = profile.columns.find((c) => STATUS_COLS.test(c.name));
    const segmentCol = profile.columns.find((c) => SEGMENT_COLS.test(c.name));
    const numCols = profile.columns.filter((c) => c.type === "numeric");
    const temporal = profile.columns.find((c) => c.type === "temporal");

    // === KPI ROW ===

    // KPI: Total Contacts
    charts.push({
      id: nextId(), type: "kpi", title: "Total Contacts",
      query: `SELECT COUNT(*) as value FROM "${table}"`,
      width: 3, confidence: 0.9, reason: "Total record count",
    });

    // KPI: Unique Emails (if email column exists)
    const emailCol = profile.columns.find((c) => /email/i.test(c.name));
    if (emailCol) {
      charts.push({
        id: nextId(), type: "kpi",
        title: "With Email",
        query: `SELECT COUNT(DISTINCT "${emailCol.name}") as value FROM "${table}" WHERE "${emailCol.name}" IS NOT NULL AND "${emailCol.name}" != ''`,
        width: 3, confidence: 0.85,
        reason: emailCol.nullCount > 0
          ? `${emailCol.nullCount} contacts missing email (${Math.round((1 - emailCol.nullCount / profile.rowCount) * 100)}% coverage)`
          : "Unique email count",
      });
    }

    // KPI: Unique Companies (if company column exists)
    const companyCol = profile.columns.find((c) => /company|org|employer/i.test(c.name) && !URL_PATTERN.test(c.name));
    if (companyCol) {
      charts.push({
        id: nextId(), type: "kpi", title: "Unique Companies",
        query: `SELECT COUNT(DISTINCT "${companyCol.name}") as value FROM "${table}" WHERE "${companyCol.name}" IS NOT NULL AND "${companyCol.name}" != ''`,
        width: 3, confidence: 0.8, reason: `Distinct company count from "${companyCol.name}"`,
      });
    }

    // KPI: Segment count or coverage KPI (only if 2+ distinct values)
    const primarySegment = segmentCol || statusCol;
    if (primarySegment && primarySegment.distinctCount >= 2) {
      charts.push({
        id: nextId(), type: "kpi", title: `${formatTitle(primarySegment.name)} Groups`,
        query: `SELECT COUNT(DISTINCT "${primarySegment.name}") as value FROM "${table}" WHERE "${primarySegment.name}" IS NOT NULL`,
        width: 3, confidence: 0.75, reason: `Number of distinct ${formatTitle(primarySegment.name)} values`,
      });
    } else if (coverageCols.length > 0) {
      // Coverage KPI for a field with nulls — skip if already shown as email KPI
      const covCol = coverageCols.find((c) => !(emailCol && c.name === emailCol.name));
      if (covCol) {
        charts.push({
          id: nextId(), type: "kpi", title: `With ${formatTitle(covCol.name)}`,
          query: `SELECT COUNT("${covCol.name}") as value FROM "${table}" WHERE "${covCol.name}" IS NOT NULL AND "${covCol.name}" != ''`,
          width: 3, confidence: 0.7,
          reason: `${covCol.nullCount} missing out of ${profile.rowCount} (${Math.round((1 - covCol.nullCount / profile.rowCount) * 100)}% coverage)`,
        });
      }
    }

    // === SEGMENT / STATUS BREAKDOWNS ===

    // Primary segment bar + donut (status or segment like icpTier)
    // Skip columns with only 1 unique value — no analytical value
    const breakdownCol = [statusCol, segmentCol, ...lowCard].find(
      (c) => c && c.distinctCount >= 2
    );
    if (breakdownCol) {
      charts.push({
        id: nextId(), type: "horizontal-bar",
        title: `Contacts by ${formatTitle(breakdownCol.name)}`,
        query: `SELECT "${breakdownCol.name}", COUNT(*) as "Count" FROM "${table}" WHERE "${breakdownCol.name}" IS NOT NULL GROUP BY "${breakdownCol.name}" ORDER BY "Count" DESC`,
        xColumn: breakdownCol.name, yColumns: ["Count"],
        width: 6, confidence: 0.9,
        reason: `Distribution across ${breakdownCol.distinctCount} ${formatTitle(breakdownCol.name)} values`,
      });

      // Only add donut if 3+ categories — donut with 1-2 slices is not useful
      if (breakdownCol.distinctCount >= 3 && breakdownCol.distinctCount <= 8) {
        charts.push({
          id: nextId(), type: "donut",
          title: `Distribution by ${formatTitle(breakdownCol.name)}`,
          query: `SELECT "${breakdownCol.name}", COUNT(*) as "Count" FROM "${table}" WHERE "${breakdownCol.name}" IS NOT NULL GROUP BY "${breakdownCol.name}" ORDER BY "Count" DESC`,
          xColumn: breakdownCol.name, yColumns: ["Count"],
          width: 6, confidence: 0.85,
          reason: `Proportional view of ${formatTitle(breakdownCol.name)}`,
        });
      }
    }

    // Second low-cardinality categorical (if different from breakdownCol, 2+ values)
    const secondLowCard = lowCard.find((c) => c.name !== breakdownCol?.name && c.distinctCount >= 2);
    if (secondLowCard) {
      charts.push({
        id: nextId(), type: "horizontal-bar",
        title: `Contacts by ${formatTitle(secondLowCard.name)}`,
        query: `SELECT "${secondLowCard.name}", COUNT(*) as "Count" FROM "${table}" WHERE "${secondLowCard.name}" IS NOT NULL GROUP BY "${secondLowCard.name}" ORDER BY "Count" DESC`,
        xColumn: secondLowCard.name, yColumns: ["Count"],
        width: 6, confidence: 0.75,
        reason: `Distribution across ${secondLowCard.distinctCount} ${formatTitle(secondLowCard.name)} values`,
      });
    }

    // === ICP-AWARE CHARTS (if icp_tier column exists) ===

    const icpTierCol = profile.columns.find((c) => /^icp.?tier$/i.test(c.name));
    if (icpTierCol) {
      // ICP KPI: Total ICP contacts
      charts.push({
        id: nextId(), type: "kpi", title: "ICP Contacts",
        query: `SELECT COUNT(*) as value FROM "${table}" WHERE "${icpTierCol.name}" IS NOT NULL`,
        width: 3, confidence: 0.95,
        reason: "Total contacts with ICP classification",
      });

      // ICP Hit Rate KPI
      charts.push({
        id: nextId(), type: "kpi", title: "ICP Hit Rate",
        query: `SELECT ROUND(COUNT(CASE WHEN "${icpTierCol.name}" IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1) as value FROM "${table}"`,
        width: 3, confidence: 0.9,
        reason: "Percentage of contacts classified as ICP",
      });

      // ICP Tier breakdown — only if not already generated as breakdownCol above
      if (breakdownCol?.name !== icpTierCol.name) {
        charts.push({
          id: nextId(), type: "horizontal-bar",
          title: "Contacts by ICP Tier",
          query: `SELECT "${icpTierCol.name}", COUNT(*) as "Count" FROM "${table}" WHERE "${icpTierCol.name}" IS NOT NULL GROUP BY "${icpTierCol.name}" ORDER BY "Count" DESC`,
          xColumn: icpTierCol.name, yColumns: ["Count"],
          width: 6, confidence: 0.9,
          reason: "ICP tier distribution — purpose-built for classified contacts",
        });

        charts.push({
          id: nextId(), type: "donut",
          title: "ICP Tier Distribution",
          query: `SELECT "${icpTierCol.name}", COUNT(*) as "Count" FROM "${table}" WHERE "${icpTierCol.name}" IS NOT NULL GROUP BY "${icpTierCol.name}" ORDER BY "Count" DESC`,
          xColumn: icpTierCol.name, yColumns: ["Count"],
          width: 6, confidence: 0.9,
          reason: "Proportional ICP tier view",
        });
      }

      // Top Companies by ICP Tier (cross-tab)
      if (companyCol) {
        charts.push({
          id: nextId(), type: "bar",
          title: "Top Companies by ICP Tier",
          query: `SELECT "${companyCol.name}", "${icpTierCol.name}", COUNT(*) as "Count" FROM "${table}" WHERE "${companyCol.name}" IS NOT NULL AND "${companyCol.name}" != '' AND "${icpTierCol.name}" IS NOT NULL GROUP BY "${companyCol.name}", "${icpTierCol.name}" ORDER BY "Count" DESC LIMIT 20`,
          xColumn: companyCol.name, yColumns: ["Count"], groupBy: icpTierCol.name,
          width: 12, confidence: 0.9,
          reason: "Cross-tabulation of companies by ICP classification",
        });
      }
    }

    // === HIGH-CARDINALITY TOP N ===

    for (const cat of highCard.slice(0, 2)) {
      // Skip if too few non-null values — Top 10 of 3 items is not useful
      const nonNullCount = cat.totalCount - cat.nullCount;
      if (nonNullCount < 10) continue;

      charts.push({
        id: nextId(), type: "horizontal-bar",
        title: `Top 10 ${formatTitle(cat.name)}`,
        query: `SELECT "${cat.name}", COUNT(*) as "Count" FROM "${table}" WHERE "${cat.name}" IS NOT NULL AND "${cat.name}" != '' GROUP BY "${cat.name}" ORDER BY "Count" DESC LIMIT 10`,
        xColumn: cat.name, yColumns: ["Count"],
        width: 6, confidence: 0.8,
        reason: `Most common ${formatTitle(cat.name)} values (${cat.distinctCount} total)`,
      });
    }

    // === NUMERIC BREAKDOWNS (if available) ===

    if (numCols.length > 0 && breakdownCol) {
      const num = numCols[0];
      charts.push({
        id: nextId(), type: "bar",
        title: `${formatTitle(num.name)} by ${formatTitle(breakdownCol.name)}`,
        query: `SELECT "${breakdownCol.name}", SUM("${num.name}") as "${num.name}" FROM "${table}" GROUP BY "${breakdownCol.name}" ORDER BY SUM("${num.name}") DESC`,
        xColumn: breakdownCol.name, yColumns: [num.name],
        width: 6, confidence: 0.75,
        reason: `Metric "${num.name}" segmented by ${formatTitle(breakdownCol.name)}`,
      });
    }

    // === TEMPORAL TREND ===

    if (temporal) {
      charts.push({
        id: nextId(), type: "line",
        title: "Contacts Over Time",
        query: `SELECT "${temporal.name}", COUNT(*) as "Count" FROM "${table}" GROUP BY "${temporal.name}" ORDER BY "${temporal.name}"`,
        xColumn: temporal.name, yColumns: ["Count"],
        width: 6, confidence: 0.8,
        reason: `Timeline from "${temporal.name}"`,
      });
    }

    // === SUMMARY TABLE ===

    // Build a focused table query — prioritize useful columns over URLs/IDs
    const tableCols = profile.columns
      .filter((c) => !URL_PATTERN.test(c.name) || /email/i.test(c.name))
      .slice(0, 8)
      .map((c) => `"${c.name}"`);
    const tableQuery = tableCols.length > 0 && tableCols.length < profile.columns.length
      ? `SELECT ${tableCols.join(", ")} FROM "${table}" LIMIT 50`
      : `SELECT * FROM "${table}" LIMIT 50`;

    charts.push({
      id: nextId(), type: "table", title: `${formatTitle(table)} Details`,
      query: tableQuery,
      width: 12, confidence: 0.7, reason: `Summary of ${profile.rowCount} contact records`,
    });

    return charts;
  },
};
