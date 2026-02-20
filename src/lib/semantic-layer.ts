import type { TableProfile, ColumnProfile } from "./profiler";
import type { DashboardConfig } from "@/types/dashboard";

export function buildSystemPrompt(config: DashboardConfig, profile: TableProfile): string {
  const excluded = new Set(config.excludedColumns ?? []);
  const visibleColumns = excluded.size > 0
    ? profile.columns.filter((col) => !excluded.has(col.name))
    : profile.columns;
  const filteredProfile = excluded.size > 0 ? { ...profile, columns: visibleColumns } : profile;

  const schemaLines = visibleColumns
    .map((col) => `  ${col.name} (${col.type}): ${describeColumn(col)}`)
    .join("\n");

  const metricsLines = generateCommonMetrics(filteredProfile);
  const exampleLines = generateExamples(filteredProfile);

  return `You are an expert data analyst assistant. You are honest, precise, and helpful.

Always respond in the same language as the user's message.

TABLE: "${profile.tableName}"
DATA: ${config.title} — ${profile.rowCount} rows, ${profile.columns.length} columns.

COLUMNS:
${schemaLines}

METRICS:
${metricsLines}

DECISION RULES (follow strictly):

1. HONEST FIRST: If the data CANNOT answer the question — say so clearly. Do NOT show an unrelated query pretending it answers the question.
   - Example: user asks about "people" but data only has aggregate metrics → return type "answer", explain what data is missing, and tell them exactly what CSV columns to upload (e.g., "Upload a contacts CSV with Name, Company, Email, Conference columns. Click '+ Add CSV' at the top.").

2. RELEVANT ALTERNATIVE: Only offer an alternative SQL query if it genuinely answers a closely related question. The alternative must be clearly labeled as different from what was asked.
   - Example: user asks "best ROI" and data has Revenue and Spend → this IS answerable, return SQL.
   - Example: user asks "who are my customers" and data only has campaign names → do NOT return a list of campaigns as if they were customers.

3. DIRECT ANSWER: When you CAN answer with SQL, return type "sql" with a brief insight explaining the result.

4. ACTIONABLE GUIDANCE: When returning type "answer", always include:
   - What this dataset actually contains (1 sentence)
   - What specific data/columns are missing
   - What to do: "Upload a CSV with [specific columns]. Use the '+ Add CSV' button."

SQL RULES:
- DuckDB syntax only. Use only columns and tables from the schema above.
- For dates: strftime("col"::DATE, '%Y-%m')
- Alias all computed columns with readable names.
- ROUND numeric results to appropriate precision.
- Only SELECT statements. No INSERT, UPDATE, DELETE, DROP, CREATE.
- NEVER silently drop a filter. If a filter column doesn't exist, use type "answer".
- No markdown code fences, no semicolons, no trailing text.

${exampleLines}${config.leadGenMode ? buildLeadGenContext(profile.tableName, config.classificationVersion ?? "1.0") : ""}`;
}

function describeColumn(col: ColumnProfile): string {
  switch (col.type) {
    case "numeric":
      return `Numeric. Range: ${col.min}–${col.max}, Mean: ${typeof col.mean === "number" ? col.mean.toFixed(1) : "N/A"}`;
    case "temporal":
      return `Date/time. Range: ${col.min} to ${col.max}`;
    case "categorical":
      return `Categorical (${col.distinctCount} unique). Sample: ${col.sampleValues.join(", ")}`;
    case "boolean":
      return `Boolean`;
    case "text":
      return `Free text (${col.distinctCount} unique)`;
    default:
      return `${col.distinctCount} unique values`;
  }
}

function generateCommonMetrics(profile: TableProfile): string {
  const lines: string[] = [];
  const numerics = profile.columns.filter((c) => c.type === "numeric");
  const categoricals = profile.columns.filter((c) => c.type === "categorical");

  for (const col of numerics) {
    lines.push(`  Total ${col.name}: SUM("${col.name}")`);
    lines.push(`  Average ${col.name}: ROUND(AVG("${col.name}"), 2)`);
  }

  for (const cat of categoricals) {
    if (numerics.length > 0) {
      lines.push(`  ${numerics[0].name} by ${cat.name}: SUM("${numerics[0].name}") ... GROUP BY "${cat.name}"`);
    }
  }

  return lines.join("\n") || "  (no standard metrics — derive from columns above)";
}

function generateExamples(profile: TableProfile): string {
  const examples: { q: string; sql: string }[] = [];
  const table = profile.tableName;

  // Always: total count
  examples.push({
    q: "How many records?",
    sql: `SELECT COUNT(*) as total_records FROM "${table}"`,
  });

  // Categorical breakdown
  const cat = profile.columns.find((c) => c.type === "categorical");
  const num = profile.columns.find((c) => c.type === "numeric");

  if (cat && num) {
    examples.push({
      q: `${num.name} by ${cat.name}`,
      sql: `SELECT "${cat.name}", SUM("${num.name}") as total_${num.name.toLowerCase().replace(/\s/g, "_")} FROM "${table}" GROUP BY "${cat.name}" ORDER BY total_${num.name.toLowerCase().replace(/\s/g, "_")} DESC`,
    });
  }

  // Temporal trend
  const temporal = profile.columns.find((c) => c.type === "temporal");
  if (temporal && num) {
    examples.push({
      q: `${num.name} over time`,
      sql: `SELECT strftime("${temporal.name}"::DATE, '%Y-%m') as month, SUM("${num.name}") as total FROM "${table}" GROUP BY month ORDER BY month`,
    });
  }

  // Top N
  if (cat) {
    examples.push({
      q: `Top 5 ${cat.name}`,
      sql: `SELECT "${cat.name}", COUNT(*) as count FROM "${table}" GROUP BY "${cat.name}" ORDER BY count DESC LIMIT 5`,
    });
  }

  return examples.map((e) => `Q: ${e.q}\nSQL: ${e.sql}`).join("\n\n");
}


/**
 * Simplified prompt for agentic mode — agent discovers data via tools.
 * No SQL examples or format instructions needed.
 */
export function buildAgentPrompt(config: DashboardConfig, profile: TableProfile): string {
  const excluded = new Set(config.excludedColumns ?? []);
  const visibleColumns = excluded.size > 0
    ? profile.columns.filter((col) => !excluded.has(col.name))
    : profile.columns;

  const schemaLines = visibleColumns
    .map((col) => `  ${col.name} (${col.type}): ${describeColumn(col)}`)
    .join("\n");

  return `You are an expert data analyst. You explore data using tools, then answer questions precisely.

Always respond in the same language as the user's message.

PRIMARY TABLE: "${profile.tableName}"
DATA: ${config.title} — ${profile.rowCount} rows, ${profile.columns.length} columns.

COLUMNS:
${schemaLines}

WORKFLOW:
1. ALWAYS call sampleData first to see actual rows before writing any SQL.
2. Use getDistinctValues to check what categories/filter values exist.
3. Use runQuery to execute SQL and examine results.
4. If a query fails, read the error message and fix the query.
5. After getting results, present a clear answer with the key finding.

RULES:
- DuckDB SQL syntax. Only SELECT statements.
- ROUND numeric results. Alias computed columns with readable names.
- If data CANNOT answer the question — say so clearly, explain what columns/data are missing, and suggest: "Upload a CSV with [specific columns] using the '+ Add CSV' button."
- Do NOT pretend unrelated data answers the question.

RESPONSE FORMAT:
- Keep your final answer concise: 2-3 sentences with the key insight.
- Do NOT include markdown tables in your response — the data is displayed separately as interactive charts and tables.
- Use plain text with line breaks. You may use **bold** for emphasis.
- Focus on the INSIGHT (what the data means), not repeating raw numbers.
- Example good response: "Tier 1 dominates the contact base at 88%, with 5,593 contacts. The remaining tiers combined account for only 12%, suggesting a strong focus on high-priority accounts."
- Example bad response: "| Tier | Count | ... |" (don't repeat the data as a table)${config.leadGenMode ? buildLeadGenContext(profile.tableName, config.classificationVersion ?? "1.0") : ""}`;
}

/**
 * Build additional context for lead-gen mode.
 * Appended to system prompt when ICP classification is present.
 */
export function buildLeadGenContext(tableName: string, version: string): string {
  return `
LEAD GEN MODE ACTIVE (ICP Classification ${version}):
This dataset contains classified contacts with ICP tiers.

Available tiers:
- Tier 1: Decision Makers (CEO, CFO, COO, CRO, MD, President, Founder, Owner)
- Tier 1.5: Payment & Finance Owners (Head of Payments, Finance Director, Treasury)
- Tier 2: Influencers/Scouts (Operations Director, BD Director, Regional Director, generic Director/Head)
- Tier 3: VP/EVP/Deputy (VP, SVP, EVP, Deputy roles)
- iGaming: Casino/Betting Directors (context-dependent)
- Board: Low priority (Chairman, Board Member)

IMPORTANT: Use the "${tableName}_enriched" view instead of "${tableName}" for ICP-aware queries.
The enriched view includes an "icp_tier" column.

Example queries:
Q: How many ICP contacts?
SQL: SELECT COUNT(*) as icp_contacts FROM "${tableName}_enriched" WHERE icp_tier IS NOT NULL

Q: Tier breakdown
SQL: SELECT icp_tier, COUNT(*) as count FROM "${tableName}_enriched" WHERE icp_tier IS NOT NULL GROUP BY icp_tier ORDER BY count DESC

Q: ICP contacts with email
SQL: SELECT COUNT(*) as ready_for_outreach FROM "${tableName}_enriched" WHERE icp_tier IS NOT NULL AND email IS NOT NULL AND email != ''

Q: Top companies by Tier 1
SQL: SELECT "companyName", COUNT(*) as count FROM "${tableName}_enriched" WHERE icp_tier = 'Tier 1' GROUP BY "companyName" ORDER BY count DESC LIMIT 10
`;
}

export function generateStarterQuestions(profile: TableProfile): string[] {
  const questions: string[] = [];
  const cat = profile.columns.find((c) => c.type === "categorical");
  const num = profile.columns.find((c) => c.type === "numeric");
  const temporal = profile.columns.find((c) => c.type === "temporal");

  questions.push(`How many total records?`);

  if (cat && num) {
    questions.push(`${num.name} by ${cat.name}`);
  }

  if (temporal && num) {
    questions.push(`${num.name} trend over time`);
  }

  if (cat) {
    questions.push(`Top ${cat.name} values`);
  }

  return questions.slice(0, 4);
}
