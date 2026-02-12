export type SidebarChartType = "kpi" | "kpi-row" | "bar" | "line" | "table";

interface DetectionResult {
  type: SidebarChartType;
  xKey?: string;
  yKeys?: string[];
}

export function detectChartType(
  data: Record<string, unknown>[],
  columns: string[]
): DetectionResult {
  if (!data.length) return { type: "table" };

  const numericCols = columns.filter((col) =>
    data.every((row) => typeof row[col] === "number")
  );
  const stringCols = columns.filter((col) =>
    data.some((row) => typeof row[col] === "string")
  );
  const dateLikeCols = columns.filter(
    (col) =>
      col.toLowerCase().includes("month") ||
      col.toLowerCase().includes("date") ||
      col.toLowerCase().includes("year") ||
      col.toLowerCase().includes("week")
  );

  // Single row, single number → KPI
  if (data.length === 1 && numericCols.length === 1) {
    return { type: "kpi", yKeys: numericCols };
  }

  // Single row, multiple numbers → KPI row
  if (data.length === 1 && numericCols.length > 1) {
    return { type: "kpi-row", yKeys: numericCols };
  }

  // Multiple rows with date-like column → Line chart
  if (data.length > 1 && dateLikeCols.length > 0 && numericCols.length > 0) {
    return {
      type: "line",
      xKey: dateLikeCols[0],
      yKeys: numericCols,
    };
  }

  // Multiple rows, 1 category + numeric → Bar chart
  if (data.length > 1 && stringCols.length >= 1 && numericCols.length >= 1) {
    return {
      type: "bar",
      xKey: stringCols[0],
      yKeys: numericCols.slice(0, 3),
    };
  }

  return { type: "table" };
}
