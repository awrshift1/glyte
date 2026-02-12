import { NextResponse } from "next/server";
import { generateText, tool, stepCountIs } from "ai";
import { z } from "zod";
import { getModel, isAiConfigured } from "@/lib/ai-provider-config";
import { loadDashboard } from "@/lib/dashboard-loader";
import { detectRelationships } from "@/lib/relationship-detector";

const SYSTEM_PROMPT = `You are a data relationship expert helping users discover and create connections between their data tables on a visual canvas.

When the user asks to find connections, use detectRelationships first, then explain what you found clearly. For each suggestion, mention the tables, columns, confidence, and reason.

When the user asks to create a specific connection, use createRelationship.

When the user asks to remove a connection, use removeRelationship.

Be concise and direct. Use plain language, not technical jargon.`;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: Request) {
  try {
    if (!isAiConfigured()) {
      return NextResponse.json({ error: "No AI provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY." }, { status: 500 });
    }

    const body = await request.json();
    const {
      dashboardId,
      message,
      history = [],
    } = body as {
      dashboardId: string;
      message: string;
      history?: ChatMessage[];
    };

    if (!dashboardId || !message?.trim()) {
      return NextResponse.json({ error: "dashboardId and message required" }, { status: 400 });
    }

    const config = await loadDashboard(dashboardId);
    const allTables = [
      config.tableName,
      ...(config.tables ?? []).map((t) => t.tableName),
    ];

    const canvasTools = {
      detectRelationships: tool({
        description:
          "Analyze tables and detect potential relationships based on column names and data values. Returns a list of suggested connections with confidence scores.",
        inputSchema: z.object({
          tableNames: z
            .array(z.string())
            .optional()
            .describe(
              "Tables to analyze. If empty, analyzes all tables on canvas"
            ),
        }),
        execute: async ({ tableNames }) => {
          const tables =
            tableNames && tableNames.length > 0 ? tableNames : allTables;
          const suggestions = await detectRelationships(tables);

          // Filter out existing relationships
          const existing = config.relationships ?? [];
          const existingKeys = new Set(
            existing.flatMap((r) => [
              `${r.fromTable}.${r.fromColumn}-${r.toTable}.${r.toColumn}`,
              `${r.toTable}.${r.toColumn}-${r.fromTable}.${r.fromColumn}`,
            ])
          );

          const newSuggestions = suggestions.filter((s) => {
            const key = `${s.fromTable}.${s.fromColumn}-${s.toTable}.${s.toColumn}`;
            return !existingKeys.has(key);
          });

          return {
            suggestions: newSuggestions,
            existingCount: existing.length,
            tablesAnalyzed: tables,
          };
        },
      }),

      createRelationship: tool({
        description: "Create a confirmed relationship between two columns on the canvas",
        inputSchema: z.object({
          fromTable: z.string().describe("Source table name"),
          fromColumn: z.string().describe("Source column name"),
          toTable: z.string().describe("Target table name"),
          toColumn: z.string().describe("Target column name"),
          type: z
            .enum(["one-to-one", "one-to-many", "many-to-many"])
            .default("one-to-many")
            .describe("Relationship cardinality"),
        }),
        execute: async ({ fromTable, fromColumn, toTable, toColumn, type }) => {
          const res = await fetch(
            `${getBaseUrl()}/api/dashboard/${dashboardId}/relationships`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ fromTable, fromColumn, toTable, toColumn, type }),
            }
          );
          const data = await res.json();
          if (data.error) return { success: false, error: data.error };
          return {
            success: true,
            relationship: data.relationship,
          };
        },
      }),

      removeRelationship: tool({
        description: "Remove an existing relationship from the canvas",
        inputSchema: z.object({
          relationshipId: z.string().describe("The ID of the relationship to remove"),
        }),
        execute: async ({ relationshipId }) => {
          const res = await fetch(
            `${getBaseUrl()}/api/dashboard/${dashboardId}/relationships`,
            {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ relationshipId }),
            }
          );
          const data = await res.json();
          return { success: true, deleted: data.deleted };
        },
      }),
    };

    // Build context about available tables
    const tableContext = allTables
      .map((t) => `- ${t}`)
      .join("\n");
    const existingRels = (config.relationships ?? [])
      .map((r) => `- ${r.fromTable}.${r.fromColumn} → ${r.toTable}.${r.toColumn} (${r.type})`)
      .join("\n");

    const contextPrompt = `${SYSTEM_PROMPT}

Available tables on canvas:
${tableContext}

${existingRels ? `Existing connections:\n${existingRels}` : "No connections yet."}`;

    const messages = [
      ...history.slice(-5).map((h) => ({
        role: h.role as "user" | "assistant",
        content: h.content,
      })),
      { role: "user" as const, content: message },
    ];

    const result = await generateText({
      model: getModel(),
      maxOutputTokens: 1000,
      system: contextPrompt,
      messages,
      tools: canvasTools,
      stopWhen: stepCountIs(5),
    });

    // Collect tool results for the frontend
    const toolResults: Array<{
      toolName: string;
      args: Record<string, unknown>;
      result: unknown;
    }> = [];

    for (const step of result.steps) {
      for (const tr of step.toolResults) {
        toolResults.push({
          toolName: tr.toolName,
          args: tr.input as Record<string, unknown>,
          result: tr.output,
        });
      }
    }

    return NextResponse.json({
      response: result.text,
      toolResults,
    });
  } catch (e) {
    const msg = e instanceof Error
      ? e.message.replace(/\/[^\s:]+/g, "[path]").trim()
      : "An unexpected error occurred";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function getBaseUrl(): string {
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}
