import { createHash } from "crypto";
import { query } from "@/lib/duckdb";
import { quoteIdent } from "@/lib/sql-utils";
import { getModel, isAiConfigured, safeGenerateText } from "@/lib/ai-provider-config";
import type { Insight, InsightType } from "@/types/dashboard";
import type { TableProfile, ColumnProfile } from "@/lib/profiler";

export function computeInsightsHash(profile: TableProfile): string {
  const key = `${profile.rowCount}:${profile.columns.map(c => c.name).sort().join(",")}`;
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export async function generateInsights(tableName: string, profile: TableProfile): Promise<Insight[]> {
  const safeTable = quoteIdent(tableName);
  const allInsights: Insight[] = [];

  // Detector 1: Outliers (numeric columns, max 5)
  const numericCols = profile.columns.filter(c => c.type === "numeric").slice(0, 5);
  for (const col of numericCols) {
    try {
      const safeCol = quoteIdent(col.name);
      const quartiles = await query<{ q1: number; q3: number }>(
        `SELECT
          PERCENTILE_CONT(0.25) WITHIN GROUP (ORDER BY ${safeCol}) as q1,
          PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY ${safeCol}) as q3
        FROM ${safeTable}`
      );
      const { q1, q3 } = quartiles[0];
      const iqr = q3 - q1;
      if (iqr === 0) continue;

      const lower = q1 - 1.5 * iqr;
      const upper = q3 + 1.5 * iqr;
      const outlierResult = await query<{ cnt: number }>(
        `SELECT COUNT(*) as cnt FROM ${safeTable}
        WHERE ${safeCol} < ${lower} OR ${safeCol} > ${upper}`
      );
      const outlierCount = outlierResult[0].cnt;
      const outlierRatio = outlierCount / profile.rowCount;

      if (outlierRatio > 0.01 && outlierRatio < 0.30) {
        allInsights.push({
          id: `outlier-${col.name}`,
          title: `Outliers detected in ${col.name}`,
          description: `${(outlierRatio * 100).toFixed(1)}% of values in ${col.name} are statistical outliers (beyond 1.5× IQR)`,
          type: "anomaly" as InsightType,
          confidence: Math.min(0.9, 0.3 + outlierRatio * 3),
          suggestedQuestion: `Show me the outlier values in ${col.name}`,
        });
      }
    } catch (e) {
      console.error(`[Insights] Outlier detection failed for ${col.name}:`, e);
    }
  }

  // Detector 2: Missing data (all columns, from profile)
  for (const col of profile.columns) {
    try {
      const nullRatio = col.nullCount / col.totalCount;
      if (nullRatio > 0.05 && nullRatio < 0.95) {
        allInsights.push({
          id: `missing-${col.name}`,
          title: `Missing data in ${col.name}`,
          description: `${(nullRatio * 100).toFixed(1)}% of values in ${col.name} are missing`,
          type: "distribution" as InsightType,
          confidence: Math.min(0.85, nullRatio),
          suggestedQuestion: `Which rows have missing ${col.name}?`,
        });
      }
    } catch (e) {
      console.error(`[Insights] Missing data detection failed for ${col.name}:`, e);
    }
  }

  // Detector 3: Temporal trends (need 1 temporal + numeric cols, max 2 numeric)
  const temporalCols = profile.columns.filter(c => c.type === "temporal");
  if (temporalCols.length > 0) {
    const dateCol = temporalCols[0];
    const safeDateCol = quoteIdent(dateCol.name);
    const trendNumericCols = numericCols.slice(0, 2);

    for (const col of trendNumericCols) {
      try {
        const safeCol = quoteIdent(col.name);
        const trendResult = await query<{ period: string; total: number; prev_total: number | null; pct_change: number | null }>(
          `WITH monthly AS (
            SELECT strftime(${safeDateCol}, '%Y-%m') as period, SUM(${safeCol}) as total
            FROM ${safeTable}
            WHERE ${safeDateCol} IS NOT NULL
            GROUP BY 1
            ORDER BY 1
          ),
          with_lag AS (
            SELECT period, total, LAG(total) OVER (ORDER BY period) as prev_total
            FROM monthly
          )
          SELECT period, total, prev_total,
            CASE WHEN prev_total > 0 THEN (total - prev_total) / prev_total ELSE NULL END as pct_change
          FROM with_lag
          ORDER BY period DESC
          LIMIT 1`
        );

        if (trendResult.length > 0 && trendResult[0].pct_change !== null) {
          const pctChange = trendResult[0].pct_change;
          if (Math.abs(pctChange) > 0.15) {
            allInsights.push({
              id: `trend-${col.name}`,
              title: `${col.name} ${pctChange > 0 ? "increased" : "decreased"} ${(Math.abs(pctChange) * 100).toFixed(0)}%`,
              description: `${col.name} changed by ${(pctChange * 100).toFixed(1)}% in the most recent period compared to the previous one`,
              type: "trend" as InsightType,
              confidence: Math.min(0.95, Math.abs(pctChange)),
              suggestedQuestion: `Show me ${col.name} trend over time`,
            });
          }
        }
      } catch (e) {
        console.error(`[Insights] Trend detection failed for ${col.name}:`, e);
      }
    }
  }

  // Detector 4: Concentration (categorical cols with distinctCount <= 50, max 3)
  const categoricalCols = profile.columns
    .filter(c => c.type === "categorical" && c.distinctCount <= 50)
    .slice(0, 3);

  for (const col of categoricalCols) {
    try {
      const safeCol = quoteIdent(col.name);
      const topResult = await query<{ col_val: string; cnt: number }>(
        `SELECT ${safeCol} as col_val, COUNT(*) as cnt FROM ${safeTable} GROUP BY 1 ORDER BY cnt DESC LIMIT 1`
      );

      if (topResult.length > 0) {
        const dominance = topResult[0].cnt / profile.rowCount;
        if (dominance > 0.50) {
          allInsights.push({
            id: `concentration-${col.name}`,
            title: `High concentration in ${col.name}`,
            description: `"${topResult[0].col_val}" accounts for ${(dominance * 100).toFixed(1)}% of all values in ${col.name}`,
            type: "distribution" as InsightType,
            confidence: Math.min(0.9, dominance),
            suggestedQuestion: `What is the distribution of ${col.name}?`,
          });
        }
      }
    } catch (e) {
      console.error(`[Insights] Concentration detection failed for ${col.name}:`, e);
    }
  }

  // Detector 5: Correlation (numeric column pairs, max 3 pairs)
  const corrPairs: [ColumnProfile, ColumnProfile][] = [];
  for (let i = 0; i < numericCols.length && corrPairs.length < 3; i++) {
    for (let j = i + 1; j < numericCols.length && corrPairs.length < 3; j++) {
      corrPairs.push([numericCols[i], numericCols[j]]);
    }
  }

  for (const [col1, col2] of corrPairs) {
    try {
      const safeCol1 = quoteIdent(col1.name);
      const safeCol2 = quoteIdent(col2.name);
      const corrResult = await query<{ r: number | null }>(
        `SELECT CORR(${safeCol1}, ${safeCol2}) as r FROM ${safeTable}`
      );

      if (corrResult.length > 0 && corrResult[0].r !== null) {
        const r = corrResult[0].r;
        if (Math.abs(r) > 0.6) {
          allInsights.push({
            id: `correlation-${col1.name}-${col2.name}`,
            title: `${col1.name} and ${col2.name} are ${r > 0 ? "positively" : "negatively"} correlated`,
            description: `Pearson correlation of ${r.toFixed(2)} between ${col1.name} and ${col2.name}`,
            type: "correlation" as InsightType,
            confidence: Math.abs(r),
            suggestedQuestion: `Show me the relationship between ${col1.name} and ${col2.name}`,
          });
        }
      }
    } catch (e) {
      console.error(`[Insights] Correlation detection failed for ${col1.name}/${col2.name}:`, e);
    }
  }

  // Sort by confidence desc, limit to 5
  allInsights.sort((a, b) => b.confidence - a.confidence);
  const topInsights = allInsights.slice(0, 5);

  // LLM enrichment (optional)
  if (isAiConfigured() && topInsights.length > 0) {
    try {
      const insightsSummary = topInsights.map(i => ({
        id: i.id,
        title: i.title,
        description: i.description,
      }));

      const { text, fallback } = await safeGenerateText({
        model: getModel(),
        prompt: `You are a data analyst. Rewrite these data insights with clear, business-friendly language. Keep each title under 60 chars and description under 120 chars. Return ONLY a JSON array of objects with fields: id, title, description. No markdown, no explanation.\n\n${JSON.stringify(insightsSummary)}`,
      });

      if (!fallback && text) {
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const enriched = JSON.parse(jsonMatch[0]) as { id: string; title: string; description: string }[];
          for (const e of enriched) {
            const match = topInsights.find(i => i.id === e.id);
            if (match) {
              match.title = e.title;
              match.description = e.description;
              match.narrativeGenerated = true;
            }
          }
        }
      }
    } catch (e) {
      console.error("[Insights] LLM enrichment failed, keeping template texts:", e);
    }
  }

  return topInsights;
}
