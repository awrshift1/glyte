import { NextResponse } from "next/server";
import { getModel, isAiConfigured, safeGenerateText } from "@/lib/ai-provider-config";
import { loadDashboard } from "@/lib/dashboard-loader";
import { buildAgentPrompt } from "@/lib/semantic-layer";
import { buildMultiTablePrompt } from "@/lib/semantic-layer-server";
import { detectChartType } from "@/lib/chart-detection";
import { buildProductPrompt } from "@/lib/product-prompt";
import { safeErrorMessage } from "@/lib/sql-utils";
import { runAnalystAgent } from "@/lib/analyst-agent";
import type { AiMode } from "@/components/ai-provider";

interface HistoryItem {
  question: string;
  response: string;
}

export async function POST(request: Request) {
  try {
    if (!isAiConfigured()) {
      return NextResponse.json({ needsKey: true, error: "No AI provider configured. Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY." });
    }

    const body = await request.json();
    const {
      dashboardId,
      question,
      history = [],
      mode = "analyst",
    } = body as {
      dashboardId?: string;
      question: string;
      history?: HistoryItem[];
      mode?: AiMode;
    };

    if (!question?.trim()) {
      return NextResponse.json({ error: "Question is required" }, { status: 400 });
    }

    // Salesperson/Guide mode — text-only responses
    if (mode === "salesperson" || mode === "guide") {
      const systemPrompt = buildProductPrompt(mode);

      const result = await safeGenerateText({
        model: getModel(),
        maxOutputTokens: 300,
        system: systemPrompt,
        messages: [{ role: "user", content: question }],
      });

      if (result.fallback) {
        return NextResponse.json({ answer: "AI is temporarily unavailable. Please check your API key configuration.", question, mode, fallback: true });
      }

      const answer = result.text.trim();
      return NextResponse.json({ answer, question, mode });
    }

    // Analyst mode — agentic tool-calling loop
    if (!dashboardId) {
      return NextResponse.json({ error: "dashboardId required for analyst mode" }, { status: 400 });
    }

    const config = await loadDashboard(dashboardId);

    if (!config.profile) {
      return NextResponse.json({ error: "Dashboard has no profile." }, { status: 400 });
    }

    let systemPrompt = buildAgentPrompt(config, config.profile);

    // Append multi-table context if dashboard has additional tables
    if (config.tables && config.tables.length > 0) {
      systemPrompt += "\n\n" + await buildMultiTablePrompt(config);
    }

    // Build allowed tables set for agent security
    const allowedTables = new Set([
      config.tableName.toLowerCase(),
      ...(config.tables ?? []).map((t) => t.tableName.toLowerCase()),
    ]);

    // Build conversation history
    const recentHistory = history.slice(-3);
    const messages = recentHistory.flatMap((h) => [
      { role: "user" as const, content: h.question },
      { role: "assistant" as const, content: h.response },
    ]);

    // Run agentic analyst — explores data via tools, then answers
    let agentResult;
    try {
      agentResult = await runAnalystAgent({
        model: getModel(),
        systemPrompt,
        question,
        messages,
        allowedTables,
      });
    } catch (error) {
      console.error("[AI] Agent failed:", error);
      return NextResponse.json({ error: "AI is temporarily unavailable. Please try again later.", question, fallback: true });
    }

    // Text-only response (data can't answer the question)
    if (agentResult.isTextOnly) {
      return NextResponse.json({ answer: agentResult.insight, question, mode: "analyst" });
    }

    // SQL response — detect chart type and return visualization data
    const results = agentResult.results ?? [];
    const columns = agentResult.columns ?? [];
    const chartType = detectChartType(results, columns);

    return NextResponse.json({
      question,
      sql: agentResult.sql,
      insight: agentResult.insight,
      results,
      columns,
      chartType: chartType.type,
      chartConfig: chartType,
      rowCount: results.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: safeErrorMessage(e), question: "unknown" },
      { status: 500 }
    );
  }
}
