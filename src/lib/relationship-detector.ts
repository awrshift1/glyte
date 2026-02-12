import { query } from "@/lib/duckdb";
import { quoteIdent, quoteLiteral } from "@/lib/sql-utils";
import { getModel, isAiConfigured, safeGenerateText } from "@/lib/ai-provider-config";

export interface RelationshipDetails {
  nameSimilarity: number;
  valueOverlap: number;
  sampleMatches: number;
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  cardinality: string;
}

export interface SuggestedRelationship {
  fromTable: string;
  fromColumn: string;
  toTable: string;
  toColumn: string;
  confidence: number;
  reason: string;
  cardinality: "one-to-one" | "one-to-many" | "many-to-many";
  details?: RelationshipDetails;
  source?: "auto" | "ai-suggested";
}

interface ColumnMeta {
  table: string;
  column: string;
  type: string;
}

// --- Stage 1: Name-based heuristic matching ---

function normalizeColumnName(name: string): string {
  return name.toLowerCase().replace(/[_\-\s]/g, "");
}

function singularize(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith("ies")) return lower.slice(0, -3) + "y";
  if (lower.endsWith("ses") || lower.endsWith("xes") || lower.endsWith("zes"))
    return lower.slice(0, -2);
  if (lower.endsWith("s") && !lower.endsWith("ss")) return lower.slice(0, -1);
  return lower;
}

function computeNameSimilarity(
  colA: ColumnMeta,
  colB: ColumnMeta
): number {
  const normA = normalizeColumnName(colA.column);
  const normB = normalizeColumnName(colB.column);

  // Exact column name match
  if (normA === normB) return 1.0;

  // FK pattern: "tableb_id" in tableA matches "id" in tableB
  const tableANorm = normalizeColumnName(singularize(colA.table));
  const tableBNorm = normalizeColumnName(singularize(colB.table));

  if (normA === tableBNorm + "id" && normB === "id") return 0.9;
  if (normB === tableANorm + "id" && normA === "id") return 0.9;

  // Reverse FK pattern
  if (normA === "id" && normB.endsWith("id") && normB.startsWith(tableANorm))
    return 0.9;
  if (normB === "id" && normA.endsWith("id") && normA.startsWith(tableBNorm))
    return 0.9;

  // Partial name overlap (e.g. "country" matches "country_code")
  if (normA.includes(normB) || normB.includes(normA)) return 0.5;

  return 0;
}

function areTypesCompatible(typeA: string, typeB: string): number {
  const normA = typeA.toLowerCase();
  const normB = typeB.toLowerCase();

  if (normA === normB) return 1.0;

  const numericTypes = ["integer", "int", "bigint", "smallint", "tinyint", "hugeint"];
  const textTypes = ["varchar", "text", "string"];

  const isNumA = numericTypes.some((t) => normA.includes(t));
  const isNumB = numericTypes.some((t) => normB.includes(t));
  const isTextA = textTypes.some((t) => normA.includes(t));
  const isTextB = textTypes.some((t) => normB.includes(t));

  if (isNumA && isNumB) return 0.9;
  if (isTextA && isTextB) return 0.9;

  // Mixed types can still join via CAST
  return 0.3;
}

// --- Stage 2: Value overlap via SQL ---

async function computeValueOverlap(
  tableA: string,
  colA: string,
  tableB: string,
  colB: string
): Promise<{ overlap: number; aDistinct: number; bDistinct: number }> {
  try {
    const qColA = quoteIdent(colA);
    const qColB = quoteIdent(colB);
    const qTableA = quoteIdent(tableA);
    const qTableB = quoteIdent(tableB);
    const sql = `
      SELECT
        COUNT(DISTINCT a.${qColA}) as a_distinct,
        COUNT(DISTINCT b.${qColB}) as b_distinct,
        COUNT(DISTINCT CASE WHEN b.${qColB} IS NOT NULL THEN a.${qColA} END) as overlap
      FROM ${qTableA} a
      LEFT JOIN ${qTableB} b ON CAST(a.${qColA} AS VARCHAR) = CAST(b.${qColB} AS VARCHAR)
      WHERE a.${qColA} IS NOT NULL
    `;
    const rows = await query<{
      a_distinct: number;
      b_distinct: number;
      overlap: number;
    }>(sql);

    if (rows.length === 0) return { overlap: 0, aDistinct: 0, bDistinct: 0 };

    return {
      overlap: rows[0].a_distinct > 0 ? rows[0].overlap / rows[0].a_distinct : 0,
      aDistinct: rows[0].a_distinct,
      bDistinct: rows[0].b_distinct,
    };
  } catch {
    return { overlap: 0, aDistinct: 0, bDistinct: 0 };
  }
}

// --- Stage 3: Cardinality detection ---

async function detectCardinality(
  table: string,
  column: string
): Promise<{ maxCount: number; isUnique: boolean }> {
  try {
    const qCol = quoteIdent(column);
    const qTable = quoteIdent(table);
    const sql = `
      SELECT MAX(cnt) as max_count FROM (
        SELECT ${qCol}, COUNT(*) as cnt FROM ${qTable} GROUP BY ${qCol}
      )
    `;
    const rows = await query<{ max_count: number }>(sql);
    const maxCount = rows[0]?.max_count ?? 0;
    return { maxCount, isUnique: maxCount <= 1 };
  } catch {
    return { maxCount: 0, isUnique: false };
  }
}

function resolveCardinality(
  fromUnique: boolean,
  toUnique: boolean
): "one-to-one" | "one-to-many" | "many-to-many" {
  if (fromUnique && toUnique) return "one-to-one";
  if (fromUnique || toUnique) return "one-to-many";
  return "many-to-many";
}

// --- Main detection pipeline ---

async function getTableColumns(tableName: string): Promise<ColumnMeta[]> {
  const rows = await query<{ column_name: string; data_type: string }>(
    `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = ${quoteLiteral(tableName)} AND table_schema = 'main' ORDER BY ordinal_position`
  );
  return rows.map((r) => ({
    table: tableName,
    column: r.column_name,
    type: r.data_type,
  }));
}

export async function detectRelationships(
  tableNames: string[]
): Promise<SuggestedRelationship[]> {
  if (tableNames.length < 2) return [];

  // Get column metadata for all tables
  const allColumns: Record<string, ColumnMeta[]> = {};
  await Promise.all(
    tableNames.map(async (t) => {
      allColumns[t] = await getTableColumns(t);
    })
  );

  const candidates: SuggestedRelationship[] = [];

  // Compare all table pairs
  for (let i = 0; i < tableNames.length; i++) {
    for (let j = i + 1; j < tableNames.length; j++) {
      const tableA = tableNames[i];
      const tableB = tableNames[j];
      const colsA = allColumns[tableA];
      const colsB = allColumns[tableB];

      // Compare all column pairs between the two tables
      for (const colA of colsA) {
        for (const colB of colsB) {
          const nameSim = computeNameSimilarity(colA, colB);

          // Skip pairs with zero name similarity — too many false positives
          if (nameSim === 0) continue;

          const typeCompat = areTypesCompatible(colA.type, colB.type);

          // Get value overlap
          const { overlap } = await computeValueOverlap(
            tableA,
            colA.column,
            tableB,
            colB.column
          );

          // Skip if no overlap at all
          if (overlap === 0 && nameSim < 0.9) continue;

          // Cardinality
          const [cardA, cardB] = await Promise.all([
            detectCardinality(tableA, colA.column),
            detectCardinality(tableB, colB.column),
          ]);
          const cardinality = resolveCardinality(cardA.isUnique, cardB.isUnique);
          const cardinalityClarity =
            cardA.isUnique || cardB.isUnique ? 1.0 : 0.5;

          // Composite confidence score
          const confidence =
            0.3 * nameSim +
            0.4 * overlap +
            0.2 * typeCompat +
            0.1 * cardinalityClarity;

          // Only surface suggestions above threshold
          if (confidence < 0.3) continue;

          // Build reason string
          const reasons: string[] = [];
          if (nameSim >= 0.9) reasons.push("Column name match");
          else if (nameSim >= 0.5) reasons.push("Partial name match");
          if (overlap > 0)
            reasons.push(`${Math.round(overlap * 100)}% value overlap`);
          if (typeCompat >= 0.9) reasons.push("Same data type");

          candidates.push({
            fromTable: tableA,
            fromColumn: colA.column,
            toTable: tableB,
            toColumn: colB.column,
            confidence: Math.round(confidence * 100) / 100,
            reason: reasons.join(" + ") || "Weak match",
            cardinality,
            details: {
              nameSimilarity: nameSim,
              valueOverlap: overlap,
              sampleMatches: Math.round(overlap * (cardA.maxCount || 1)),
              fromTable: tableA,
              fromColumn: colA.column,
              toTable: tableB,
              toColumn: colB.column,
              cardinality,
            },
          });
        }
      }
    }
  }

  // Sort by confidence descending, deduplicate
  candidates.sort((a, b) => b.confidence - a.confidence);

  // Remove duplicates (same column pair in reverse)
  const seen = new Set<string>();
  return candidates.filter((c) => {
    const key1 = `${c.fromTable}.${c.fromColumn}-${c.toTable}.${c.toColumn}`;
    const key2 = `${c.toTable}.${c.toColumn}-${c.fromTable}.${c.fromColumn}`;
    if (seen.has(key1) || seen.has(key2)) return false;
    seen.add(key1);
    return true;
  });
}

// --- Stage 4: LLM enhancement for ambiguous candidates ---

export async function enhanceWithLlm(
  candidates: SuggestedRelationship[]
): Promise<SuggestedRelationship[]> {
  if (!isAiConfigured()) return candidates;

  // Only enhance mid-confidence candidates (ambiguous zone)
  const ambiguous = candidates.filter((c) => c.confidence >= 0.3 && c.confidence <= 0.8);
  if (ambiguous.length === 0) return candidates;

  // Collect sample values for context
  const pairDescriptions = await Promise.all(
    ambiguous.map(async (c) => {
      let samplesA: string[] = [];
      let samplesB: string[] = [];
      try {
        const rowsA = await query<Record<string, unknown>>(
          `SELECT DISTINCT ${quoteIdent(c.fromColumn)} as v FROM ${quoteIdent(c.fromTable)} WHERE ${quoteIdent(c.fromColumn)} IS NOT NULL LIMIT 5`
        );
        samplesA = rowsA.map((r) => String(r.v));
        const rowsB = await query<Record<string, unknown>>(
          `SELECT DISTINCT ${quoteIdent(c.toColumn)} as v FROM ${quoteIdent(c.toTable)} WHERE ${quoteIdent(c.toColumn)} IS NOT NULL LIMIT 5`
        );
        samplesB = rowsB.map((r) => String(r.v));
      } catch { /* ignore sample fetch errors */ }

      return `- ${c.fromTable}.${c.fromColumn} (samples: ${samplesA.join(", ") || "none"}) ↔ ${c.toTable}.${c.toColumn} (samples: ${samplesB.join(", ") || "none"}) | heuristic confidence: ${c.confidence} | reason: ${c.reason}`;
    })
  );

  const prompt = `You are a data analyst. Given these candidate column relationships between database tables, determine which are REAL foreign key relationships and which are false positives.

For each pair, respond with a JSON array. Each entry: {"index": N, "isReal": true/false, "adjustment": -0.2 to +0.2, "reasoning": "brief explanation"}

Candidates:
${pairDescriptions.join("\n")}

Respond with ONLY the JSON array, no markdown.`;

  const result = await safeGenerateText({
    model: getModel(),
    maxOutputTokens: 500,
    messages: [{ role: "user", content: prompt }],
  });

  if (result.fallback || !result.text.trim()) return candidates;

  // Parse LLM response
  try {
    const cleaned = result.text.replace(/```(?:json)?\n?/g, "").replace(/```/g, "").trim();
    const assessments = JSON.parse(cleaned) as Array<{
      index: number;
      isReal: boolean;
      adjustment: number;
      reasoning: string;
    }>;

    // Apply adjustments
    const ambiguousMap = new Map(ambiguous.map((c, i) => [i, c]));
    for (const a of assessments) {
      const candidate = ambiguousMap.get(a.index);
      if (!candidate) continue;

      const adj = Math.max(-0.2, Math.min(0.2, a.adjustment));
      const penalty = a.isReal === false ? -0.15 : 0;
      candidate.confidence = Math.round(Math.max(0, Math.min(1, candidate.confidence + adj + penalty)) * 100) / 100;
      candidate.reason = `${candidate.reason} | AI: ${a.reasoning}`;
      candidate.source = "ai-suggested";
    }
  } catch {
    // If LLM response doesn't parse, keep heuristic scores
  }

  return candidates;
}
