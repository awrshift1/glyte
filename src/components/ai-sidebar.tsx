"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Send, Loader2, ChevronDown, ChevronRight, X, AlertCircle, Sparkles } from "lucide-react";
import { SidebarChart } from "@/components/sidebar-chart";
import { ResultTable } from "@/components/result-table";
import { useAi, type AiMode } from "@/components/ai-provider";
import { getStartersByMode } from "@/lib/product-prompt";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  insight?: string;
  sql?: string;
  results?: Record<string, unknown>[];
  columns?: string[];
  chartType?: string;
  chartConfig?: { type: string; xKey?: string; yKeys?: string[] };
  error?: string;
  needsKey?: boolean;
  mode?: AiMode;
}

interface AiSidebarProps {
  dashboardId?: string;
  starterQuestions?: string[];
}

export function AiSidebar({ dashboardId, starterQuestions }: AiSidebarProps) {
  const { mode, open, toggle } = useAi();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const starters = mode === "analyst" && starterQuestions
    ? starterQuestions
    : getStartersByMode(mode);

  // Clear messages when mode changes
  const prevMode = useRef(mode);
  useEffect(() => {
    if (prevMode.current !== mode) {
      setMessages([]);
      prevMode.current = mode;
    }
  }, [mode]);

  const sendMessage = useCallback(
    async (question: string) => {
      if (!question.trim() || loading) return;
      setMessages((prev) => [...prev, { role: "user", content: question }]);
      setInput("");
      setLoading(true);

      try {
        if (mode === "analyst" && dashboardId) {
          // SQL analyst mode — use /api/chat
          const history = messages
            .reduce<{ question: string; response: string }[]>((acc, msg, i) => {
              if (msg.role === "user" && messages[i + 1]?.role === "assistant") {
                const asst = messages[i + 1];
                // Send full context: insight + SQL or just the text answer
                const response = asst.sql
                  ? JSON.stringify({ type: "sql", insight: asst.insight || asst.content, sql: asst.sql })
                  : JSON.stringify({ type: "answer", text: asst.content });
                acc.push({ question: msg.content, response });
              }
              return acc;
            }, [])
            .slice(-3);

          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ dashboardId, question, history }),
          });
          const data = await res.json();

          if (data.needsKey) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: "API key not configured", needsKey: true, mode },
            ]);
          } else if (data.fallback) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: data.error ?? "AI is temporarily unavailable. Your dashboard still works — just AI chat is paused.", mode },
            ]);
          } else if (data.answer) {
            // Natural language explanation (no SQL)
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: data.answer, mode },
            ]);
          } else if (data.error) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: data.error, error: data.error, sql: data.sql, mode },
            ]);
          } else {
            const isInfoMessage = data.results?.length === 1 && "error" in (data.results[0] ?? {});
            if (isInfoMessage) {
              setMessages((prev) => [
                ...prev,
                { role: "assistant", content: String(data.results[0].error), sql: data.sql, mode },
              ]);
            } else {
              const displayText = data.insight || `Found ${data.rowCount} result${data.rowCount !== 1 ? "s" : ""}`;
              setMessages((prev) => [
                ...prev,
                {
                  role: "assistant",
                  content: displayText,
                  insight: data.insight,
                  sql: data.sql,
                  results: data.results,
                  columns: data.columns,
                  chartType: data.chartType,
                  chartConfig: data.chartConfig,
                  mode,
                },
              ]);
            }
          }
        } else {
          // Salesperson/Guide mode — use /api/chat with mode param
          const res = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question, mode }),
          });
          const data = await res.json();

          if (data.needsKey) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: "API key not configured", needsKey: true, mode },
            ]);
          } else if (data.fallback) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: "AI is temporarily unavailable. Please try again later.", mode },
            ]);
          } else if (data.error) {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: data.error, error: data.error, mode },
            ]);
          } else {
            setMessages((prev) => [
              ...prev,
              { role: "assistant", content: data.answer ?? data.content ?? "I can help with that!", mode },
            ]);
          }
        }
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${e}`, error: String(e), mode },
        ]);
      }

      setLoading(false);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    },
    [loading, messages, dashboardId, mode]
  );

  // Listen for "Ask AI" from ProactiveInsights cards
  useEffect(() => {
    const handler = (e: Event) => {
      const question = (e as CustomEvent<{ question: string }>).detail.question;
      if (question) {
        if (!open) toggle();
        sendMessage(question);
      }
    };
    window.addEventListener("glyte:ask-ai", handler);
    return () => window.removeEventListener("glyte:ask-ai", handler);
  }, [open, toggle, sendMessage]);

  const modeLabel = mode === "analyst" ? "AI Analyst" : mode === "guide" ? "AI Guide" : "Glyte AI";

  if (!open) {
    return (
      <>
        <button
          onClick={toggle}
          className="fixed right-4 bottom-4 rounded-full bg-[#2563eb] p-3 text-white shadow-lg hover:bg-[#1d4ed8] transition-colors z-50 ai-pulse"
        >
          <Sparkles className="h-5 w-5" />
        </button>
        {/* Contextual hint for dashboard pages */}
        {mode === "analyst" && !hintDismissed && (
          <div
            className="fixed right-16 bottom-5 bg-[#1e293b] border border-[#334155] rounded-lg px-3 py-2 text-xs text-[#94a3b8] shadow-lg z-50 animate-fade-in cursor-pointer"
            onClick={() => { setHintDismissed(true); toggle(); }}
          >
            Ask me anything about this data
          </div>
        )}
      </>
    );
  }

  return (
    <div className="w-80 min-w-[320px] border-l border-[#334155] bg-[#0f1729] flex flex-col h-screen sticky top-0">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#334155] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#2563eb]" />
          <span className="text-sm font-semibold text-white">{modeLabel}</span>
          <span className="text-[10px] bg-[#2563eb]/20 text-[#2563eb] rounded-full px-1.5 py-0.5">
            {mode}
          </span>
        </div>
        <button onClick={toggle} className="text-[#94a3b8] hover:text-[#f8fafc]">
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-xs text-[#94a3b8] pt-8">
            <p className="mb-3">
              {mode === "analyst"
                ? "Ask anything about your data"
                : mode === "guide"
                ? "Let me help you get started"
                : "Hi! Ask me anything about Glyte"}
            </p>
            {starters.map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                className="block mx-auto mb-2 rounded-full border border-[#334155] px-3 py-1 text-xs text-[#94a3b8] hover:border-[#2563eb] hover:text-[#f8fafc] transition-colors"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((msg, i) => (
          <SidebarMessage key={i} message={msg} />
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
            <Loader2 className="h-3 w-3 animate-spin" />
            {mode === "analyst" ? "Analyzing..." : "Thinking..."}
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[#334155] p-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="flex items-center gap-2 rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-1.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={mode === "analyst" ? "Ask about your data..." : "Ask anything..."}
            className="flex-1 bg-transparent text-xs text-[#f8fafc] outline-none placeholder:text-[#94a3b8]"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="rounded bg-[#2563eb] p-1.5 text-white disabled:opacity-40"
          >
            <Send className="h-3 w-3" />
          </button>
        </form>
      </div>
    </div>
  );
}

function SidebarMessage({ message }: { message: ChatMessage }) {
  const [showSql, setShowSql] = useState(false);

  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-[#2563eb] px-3 py-1.5 text-xs text-white">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.needsKey) {
    return (
      <div className="rounded-lg border border-[#eab308]/30 bg-[#eab308]/10 px-3 py-2 text-xs text-[#eab308]">
        <div className="flex items-center gap-1.5 mb-1">
          <AlertCircle className="h-3 w-3" />
          <span className="font-medium">API Key Required</span>
        </div>
        <p>Add an API key to .env.local (ANTHROPIC_API_KEY, OPENAI_API_KEY, or GOOGLE_GENERATIVE_AI_API_KEY).</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {message.error ? (
        <div className="rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 px-3 py-2 text-xs text-[#ef4444]">
          {message.error}
        </div>
      ) : (
        <>
          {message.results && message.chartType && message.chartType !== "table" && (
            <div className="max-h-48 overflow-hidden">
              <SidebarChart
                data={message.results}
                chartType={message.chartType}
                chartConfig={message.chartConfig!}
              />
            </div>
          )}
          {message.results && message.columns && (message.chartType === "table" || !message.chartType) && (
            <div className="max-h-48 overflow-auto">
              <ResultTable data={message.results} columns={message.columns} />
            </div>
          )}
          <div className="text-xs text-[#94a3b8] space-y-1">
            <FormattedText text={message.content} />
          </div>
        </>
      )}

      {message.sql && (
        <button
          onClick={() => setShowSql(!showSql)}
          className="flex items-center gap-1 text-[10px] text-[#94a3b8] hover:text-[#f8fafc]"
        >
          {showSql ? <ChevronDown className="h-2.5 w-2.5" /> : <ChevronRight className="h-2.5 w-2.5" />}
          Show query
        </button>
      )}
      {showSql && message.sql && (
        <pre className="overflow-x-auto rounded bg-[#1e293b] p-2 text-[10px] text-[#94a3b8]">
          {message.sql}
        </pre>
      )}
    </div>
  );
}

/** Minimal markdown-like formatter for agent responses */
function FormattedText({ text }: { text: string }) {
  if (!text) return null;

  // Split into lines and process
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let tableLines: string[] = [];

  const flushTable = () => {
    if (tableLines.length < 2) {
      // Not a real table, render as text
      tableLines.forEach((line, i) => {
        elements.push(<p key={`tl-${elements.length}-${i}`}>{line}</p>);
      });
    } else {
      // Parse markdown table
      const headerLine = tableLines[0];
      const dataLines = tableLines.slice(2); // skip separator
      const headers = headerLine.split("|").map((h) => h.trim()).filter(Boolean);
      const rows = dataLines.map((line) =>
        line.split("|").map((c) => c.trim()).filter(Boolean)
      );

      elements.push(
        <div key={`table-${elements.length}`} className="overflow-x-auto my-1">
          <table className="text-[10px] w-full border-collapse">
            <thead>
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="text-left px-1.5 py-0.5 border-b border-[#334155] text-[#f8fafc] font-medium">
                    {formatInline(h)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <tr key={ri}>
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-1.5 py-0.5 border-b border-[#334155]/50">
                      {formatInline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    tableLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    // Table line detection
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      tableLines.push(trimmed);
      continue;
    }

    // Flush pending table
    if (tableLines.length > 0) flushTable();

    // Empty line
    if (!trimmed) continue;

    // Headers
    if (trimmed.startsWith("## ")) {
      elements.push(
        <p key={elements.length} className="font-semibold text-[#f8fafc] mt-1">
          {formatInline(trimmed.slice(3))}
        </p>
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      elements.push(
        <p key={elements.length} className="font-bold text-[#f8fafc] mt-1">
          {formatInline(trimmed.slice(2))}
        </p>
      );
      continue;
    }

    // Regular paragraph
    elements.push(<p key={elements.length}>{formatInline(trimmed)}</p>);
  }

  // Flush remaining table
  if (tableLines.length > 0) flushTable();

  return <>{elements}</>;
}

/** Inline formatting: **bold** */
function formatInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="text-[#f8fafc] font-medium">{part.slice(2, -2)}</strong>;
    }
    return part;
  });
}
