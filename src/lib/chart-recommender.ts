import { ColumnProfile, TableProfile } from "./profiler";
import { quoteIdent } from "./sql-utils";

export type ChartType = "kpi" | "line" | "bar" | "horizontal-bar" | "donut" | "table";

export interface ChartRecommendation {
  id: string;
  type: ChartType;
  title: string;
  query: string;
  xColumn?: string;
  yColumns?: string[];
  groupBy?: string;
  width: number; // grid columns out of 12
  confidence?: number;
  reason?: string;
}

export function recommendCharts(profile: TableProfile): ChartRecommendation[] {
  const charts: ChartRecommendation[] = [];
  const temporals = profile.columns.filter((c) => c.type === "temporal");
  const numerics = profile.columns.filter((c) => c.type === "numeric");

  // Identifier-like columns: unique IDs, names, emails, URLs — not useful for charts
  const isIdentifier = (c: ColumnProfile) =>
    c.distinctCount > profile.rowCount * 0.8 ||
    /^(id|uuid|_id|key|email|url|linkedin|phone|address)$/i.test(c.name) ||
    /^(first.?name|last.?name|full.?name)$/i.test(c.name);

  // Low-cardinality: perfect for GROUP BY (2-20 unique values)
  const categoricals = profile.columns.filter(
    (c) => c.type === "categorical" && c.distinctCount >= 2 && c.distinctCount <= 20 && !isIdentifier(c)
  );

  // High-cardinality: too many values for full chart, but Top N is valuable
  const highCardCategoricals = profile.columns.filter(
    (c) => (c.type === "categorical" || c.type === "text") && c.distinctCount > 20 && !isIdentifier(c)
  );

  const table = profile.tableName;
  let chartId = 0;
  const nextId = () => `chart-${++chartId}`;

  // Helper: compute confidence based on data quality signals
  const kpiConfidence = (num: ColumnProfile) => {
    const hasVariance = num.min !== num.max;
    const notSparse = (num.nullCount ?? 0) < profile.rowCount * 0.5;
    return hasVariance && notSparse ? 0.85 : 0.5;
  };

  // 1. KPI cards for each numeric column (top row)
  for (const num of numerics.slice(0, 4)) {
    const conf = kpiConfidence(num);
    charts.push({
      id: nextId(),
      type: "kpi",
      title: formatTitle(num.name),
      query: `SELECT SUM(${quoteIdent(num.name)}) as value FROM ${quoteIdent(table)}`,
      width: 3,
      confidence: conf,
      reason: `Shows total ${formatTitle(num.name)} across all ${profile.rowCount} rows`,
    });
  }

  // 2. Temporal + numeric → line chart
  if (temporals.length > 0 && numerics.length > 0) {
    const timeCol = temporals[0];
    // Pick top 2 numeric columns for line chart
    const yNumerics = numerics.slice(0, 2);
    charts.push({
      id: nextId(),
      type: "line",
      title: `${formatTitle(yNumerics[0].name)} Over Time`,
      query: `SELECT ${quoteIdent(timeCol.name)}, ${yNumerics.map((n) => `SUM(${quoteIdent(n.name)}) as ${quoteIdent(n.name)}`).join(", ")} FROM ${quoteIdent(table)} GROUP BY ${quoteIdent(timeCol.name)} ORDER BY ${quoteIdent(timeCol.name)}`,
      xColumn: timeCol.name,
      yColumns: yNumerics.map((n) => n.name),
      width: 6,
      confidence: 0.9,
      reason: `${formatTitle(yNumerics[0].name)} trend over ${formatTitle(timeCol.name)}`,
    });
  }

  // 3. Categorical + numeric → bar chart (top categorical by cardinality interest)
  if (categoricals.length > 0 && numerics.length > 0) {
    const cat = categoricals[0];
    const num = numerics[0];
    charts.push({
      id: nextId(),
      type: "horizontal-bar",
      title: `${formatTitle(num.name)} by ${formatTitle(cat.name)}`,
      query: `SELECT ${quoteIdent(cat.name)}, SUM(${quoteIdent(num.name)}) as ${quoteIdent(num.name)} FROM ${quoteIdent(table)} GROUP BY ${quoteIdent(cat.name)} ORDER BY SUM(${quoteIdent(num.name)}) DESC`,
      xColumn: cat.name,
      yColumns: [num.name],
      width: 6,
      confidence: 0.8,
      reason: `Compares ${formatTitle(num.name)} across ${cat.distinctCount} ${formatTitle(cat.name)} categories`,
    });
  }

  // 4. If 2+ categoricals: grouped bar (second categorical as group)
  if (categoricals.length >= 2 && numerics.length > 0) {
    const cat1 = categoricals[0];
    const cat2 = categoricals[1];
    const num = numerics[0];
    charts.push({
      id: nextId(),
      type: "bar",
      title: `${formatTitle(num.name)} by ${formatTitle(cat2.name)}`,
      query: `SELECT ${quoteIdent(cat2.name)}, ${quoteIdent(cat1.name)}, SUM(${quoteIdent(num.name)}) as ${quoteIdent(num.name)} FROM ${quoteIdent(table)} GROUP BY ${quoteIdent(cat2.name)}, ${quoteIdent(cat1.name)} ORDER BY ${quoteIdent(cat2.name)}`,
      xColumn: cat2.name,
      yColumns: [num.name],
      groupBy: cat1.name,
      width: 6,
      confidence: 0.7,
      reason: `Groups ${formatTitle(num.name)} by ${formatTitle(cat2.name)} and ${formatTitle(cat1.name)} (${cat2.distinctCount} x ${cat1.distinctCount} combinations)`,
    });
  }

  // 4b. High-cardinality categorical + numeric → Top 10 bar chart
  if (highCardCategoricals.length > 0 && numerics.length > 0) {
    for (const cat of highCardCategoricals.slice(0, 2)) {
      const num = numerics[0];
      charts.push({
        id: nextId(),
        type: "horizontal-bar",
        title: `Top 10 ${formatTitle(cat.name)} by ${formatTitle(num.name)}`,
        query: `SELECT ${quoteIdent(cat.name)}, SUM(${quoteIdent(num.name)}) as ${quoteIdent(num.name)} FROM ${quoteIdent(table)} WHERE ${quoteIdent(cat.name)} IS NOT NULL AND ${quoteIdent(cat.name)} != '' GROUP BY ${quoteIdent(cat.name)} ORDER BY SUM(${quoteIdent(num.name)}) DESC LIMIT 10`,
        xColumn: cat.name,
        yColumns: [num.name],
        width: 6,
        confidence: 0.75,
        reason: `Top 10 from ${cat.distinctCount} unique ${formatTitle(cat.name)} values by ${formatTitle(num.name)}`,
      });
    }
  }

  // 5. Categorical with few values → donut chart (last numeric)
  const donutCat = categoricals.find((c) => c.distinctCount >= 2 && c.distinctCount <= 8);
  if (donutCat && numerics.length > 0) {
    const num = numerics.length > 1 ? numerics[1] : numerics[0];
    charts.push({
      id: nextId(),
      type: "donut",
      title: `${formatTitle(num.name)} by ${formatTitle(donutCat.name)}`,
      query: `SELECT ${quoteIdent(donutCat.name)}, SUM(${quoteIdent(num.name)}) as ${quoteIdent(num.name)} FROM ${quoteIdent(table)} GROUP BY ${quoteIdent(donutCat.name)} ORDER BY SUM(${quoteIdent(num.name)}) DESC`,
      xColumn: donutCat.name,
      yColumns: [num.name],
      width: 6,
      confidence: 0.75,
      reason: `Distribution of ${formatTitle(num.name)} across ${donutCat.distinctCount} ${formatTitle(donutCat.name)} segments`,
    });
  }

  // 5b. Count-based charts when no numeric columns
  if (numerics.length === 0 && (categoricals.length > 0 || highCardCategoricals.length > 0)) {
    // KPI: total records
    charts.push({
      id: nextId(),
      type: "kpi",
      title: "Total Records",
      query: `SELECT COUNT(*) as value FROM ${quoteIdent(table)}`,
      width: 3,
      confidence: 0.9,
      reason: `Total row count for ${formatTitle(table)}`,
    });

    // KPI: unique values for first categorical
    const firstDimension = categoricals[0] || highCardCategoricals[0];
    if (firstDimension) {
      charts.push({
        id: nextId(),
        type: "kpi",
        title: `Unique ${formatTitle(firstDimension.name)}`,
        query: `SELECT COUNT(DISTINCT ${quoteIdent(firstDimension.name)}) as value FROM ${quoteIdent(table)} WHERE ${quoteIdent(firstDimension.name)} IS NOT NULL AND ${quoteIdent(firstDimension.name)} != ''`,
        width: 3,
        confidence: 0.8,
        reason: `Distinct count of ${formatTitle(firstDimension.name)} (${firstDimension.distinctCount} unique values)`,
      });
    }

    // Bar chart for each low-cardinality categorical (full distribution)
    for (const cat of categoricals.slice(0, 2)) {
      charts.push({
        id: nextId(),
        type: "horizontal-bar",
        title: `Records by ${formatTitle(cat.name)}`,
        query: `SELECT ${quoteIdent(cat.name)}, COUNT(*) as "Count" FROM ${quoteIdent(table)} WHERE ${quoteIdent(cat.name)} IS NOT NULL AND ${quoteIdent(cat.name)} != '' GROUP BY ${quoteIdent(cat.name)} ORDER BY COUNT(*) DESC`,
        xColumn: cat.name,
        yColumns: ["Count"],
        width: 6,
        confidence: 0.8,
        reason: `Record count breakdown by ${formatTitle(cat.name)} (${cat.distinctCount} categories)`,
      });
    }

    // Bar charts for high-cardinality categoricals (Top 10)
    for (const cat of highCardCategoricals.slice(0, 2)) {
      charts.push({
        id: nextId(),
        type: "horizontal-bar",
        title: `Top 10 ${formatTitle(cat.name)}`,
        query: `SELECT ${quoteIdent(cat.name)}, COUNT(*) as "Count" FROM ${quoteIdent(table)} WHERE ${quoteIdent(cat.name)} IS NOT NULL AND ${quoteIdent(cat.name)} != '' GROUP BY ${quoteIdent(cat.name)} ORDER BY COUNT(*) DESC LIMIT 10`,
        xColumn: cat.name,
        yColumns: ["Count"],
        width: 6,
        confidence: 0.75,
        reason: `Top 10 from ${cat.distinctCount} unique ${formatTitle(cat.name)} values`,
      });
    }

    // Donut for low-cardinality categorical
    const donutCatNoNum = categoricals.find((c) => c.distinctCount >= 2 && c.distinctCount <= 8);
    if (donutCatNoNum && donutCatNoNum !== categoricals[0]) {
      charts.push({
        id: nextId(),
        type: "donut",
        title: `Distribution by ${formatTitle(donutCatNoNum.name)}`,
        query: `SELECT ${quoteIdent(donutCatNoNum.name)}, COUNT(*) as "Count" FROM ${quoteIdent(table)} WHERE ${quoteIdent(donutCatNoNum.name)} IS NOT NULL AND ${quoteIdent(donutCatNoNum.name)} != '' GROUP BY ${quoteIdent(donutCatNoNum.name)} ORDER BY COUNT(*) DESC`,
        xColumn: donutCatNoNum.name,
        yColumns: ["Count"],
        width: 6,
        confidence: 0.7,
        reason: `Proportional split across ${donutCatNoNum.distinctCount} ${formatTitle(donutCatNoNum.name)} values`,
      });
    }

    // Temporal + count → line chart
    if (temporals.length > 0) {
      const timeCol = temporals[0];
      charts.push({
        id: nextId(),
        type: "line",
        title: "Records Over Time",
        query: `SELECT ${quoteIdent(timeCol.name)}, COUNT(*) as "Count" FROM ${quoteIdent(table)} GROUP BY ${quoteIdent(timeCol.name)} ORDER BY ${quoteIdent(timeCol.name)}`,
        xColumn: timeCol.name,
        yColumns: ["Count"],
        width: 6,
        confidence: 0.85,
        reason: `Record count trend over ${formatTitle(timeCol.name)}`,
      });
    }
  }

  // 6. Summary table
  charts.push({
    id: nextId(),
    type: "table",
    title: `${formatTitle(table)} Details`,
    query: buildSummaryTableQuery(profile),
    width: 12,
    confidence: 0.6,
    reason: `Summary table with ${profile.columns.length} columns`,
  });

  return charts;
}

function buildSummaryTableQuery(profile: TableProfile): string {
  const cats = profile.columns.filter((c) => c.type === "categorical");
  const nums = profile.columns.filter((c) => c.type === "numeric");

  if (cats.length === 0) {
    return `SELECT * FROM ${quoteIdent(profile.tableName)} LIMIT 50`;
  }

  const groupCols = cats.slice(0, 2).map((c) => quoteIdent(c.name));
  const aggCols = nums
    .slice(0, 5)
    .map((c) => `SUM(${quoteIdent(c.name)}) as ${quoteIdent(c.name)}`);

  if (aggCols.length === 0) {
    return `SELECT * FROM ${quoteIdent(profile.tableName)} LIMIT 50`;
  }

  return `SELECT ${groupCols.join(", ")}, ${aggCols.join(", ")} FROM ${quoteIdent(profile.tableName)} GROUP BY ${groupCols.join(", ")} ORDER BY ${aggCols[0].split(" as ")[0].replace("SUM", "SUM")} DESC`;
}

function formatTitle(name: string): string {
  return name
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}
