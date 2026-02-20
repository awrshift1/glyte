import type { TableProfile } from "@/lib/profiler";

export type ChartType = "kpi" | "line" | "bar" | "horizontal-bar" | "donut" | "table";

export interface VersionEntry {
  version: number;
  rowCount: number;
  columnCount: number;
  csvPath: string;
  createdAt: string;
}

export interface DiffSummary {
  matchedDashboard: string;
  matchedDashboardId: string;
  rowDelta: number;
  oldRowCount: number;
  newRowCount: number;
  addedColumns: string[];
  removedColumns: string[];
  commonColumns: string[];
  overlapPercent: number;
}

export interface DashboardConfig {
  id: string;
  title: string;
  tableName: string;
  csvPath: string;
  rowCount: number;
  columnCount: number;
  charts: ChartConfig[];
  profile?: TableProfile;
  createdAt: string;
  updatedAt?: string;
  version?: number;
  previousVersions?: VersionEntry[];
  excludedColumns?: string[];
  tables?: TableEntry[];
  relationships?: Relationship[];
  templateId?: string;
  leadGenMode?: boolean;
  classificationVersion?: string;
  appendedSources?: AppendedSource[];
  hiddenChartIds?: string[];
}

export interface TableEntry {
  tableName: string;
  csvPath: string;
  rowCount: number;
  columnCount: number;
  addedAt: string;
  excludedColumns?: string[];
}

export interface AppendedSource {
  label: string;
  csvPath: string;
  rowCount: number;
  appendedAt: string;
}

export interface Relationship {
  id: string;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  type: "one-to-one" | "one-to-many" | "many-to-many";
}

export interface ChartConfig {
  id: string;
  type: ChartType;
  title: string;
  query: string;
  xColumn?: string;
  yColumns?: string[];
  groupBy?: string;
  width: number;
  confidence?: number;
  reason?: string;
}

export interface ChartData {
  id: string;
  type: ChartType;
  title: string;
  width: number;
  xColumn?: string;
  yColumns?: string[];
  groupBy?: string;
  data: Record<string, unknown>[];
  confidence?: number;
  reason?: string;
}

export interface KpiData {
  id: string;
  title: string;
  value: number;
  width: number;
}

export interface SchemaCompatibility {
  compatible: boolean;
  overlapPercent: number;
  commonColumns: string[];
  missingInTarget: string[];
  extraInSource: string[];
}

export interface ClassificationProgress {
  type: 'progress' | 'complete';
  processed?: number;
  total?: number;
  tierCounts?: Record<string, number>;
  summary?: {
    total: number;
    icp: number;
    rejected: number;
    byTier: Record<string, number>;
  };
}
