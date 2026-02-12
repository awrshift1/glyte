"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Send,
  Loader2,
  X,
  Sparkles,
  Check,
  XCircle,
  GitBranch,
} from "lucide-react";
import type { SuggestedRelationship } from "@/lib/relationship-detector";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  toolResults?: ToolResult[];
}

interface ToolResult {
  toolName: string;
  args: Record<string, unknown>;
  result: {
    suggestions?: SuggestedRelationship[];
    success?: boolean;
    relationship?: { id: string };
    error?: string;
    [key: string]: unknown;
  };
}

interface CanvasAiSidebarProps {
  dashboardId: string;
  open: boolean;
  onClose: () => void;
  onSuggestionsReceived: (suggestions: SuggestedRelationship[]) => void;
  onRelationshipCreated: () => void;
}

const STARTER_QUESTIONS = [
  "Find connections between my tables",
  "What relationships exist?",
  "Which columns look related?",
];

export function CanvasAiSidebar({
  dashboardId,
  open,
  onClose,
  onSuggestionsReceived,
  onRelationshipCreated,
}: CanvasAiSidebarProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sendMessage = useCallback(
    async (question: string) => {
      if (!question.trim() || loading) return;
      setMessages((prev) => [...prev, { role: "user", content: question }]);
      setInput("");
      setLoading(true);

      try {
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const res = await fetch("/api/canvas/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dashboardId, message: question, history }),
        });
        const data = await res.json();

        if (data.error) {
          setMessages((prev) => [
            ...prev,
            { role: "assistant", content: data.error },
          ]);
        } else {
          const msg: ChatMessage = {
            role: "assistant",
            content: data.response || "Done.",
            toolResults: data.toolResults,
          };
          setMessages((prev) => [...prev, msg]);

          // Forward suggestions to the canvas
          for (const tr of data.toolResults ?? []) {
            if (
              tr.toolName === "detectRelationships" &&
              tr.result?.suggestions
            ) {
              onSuggestionsReceived(tr.result.suggestions);
            }
            if (tr.toolName === "createRelationship" && tr.result?.success) {
              onRelationshipCreated();
            }
          }
        }
      } catch (e) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: `Error: ${e}` },
        ]);
      }

      setLoading(false);
      setTimeout(
        () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }),
        100
      );
    },
    [loading, messages, dashboardId, onSuggestionsReceived, onRelationshipCreated]
  );

  // Scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!open) return null;

  return (
    <div className="w-80 min-w-[320px] border-l border-[#334155] bg-[#0f1729] flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#334155] px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#2563eb]" />
          <span className="text-sm font-semibold text-white">
            Canvas AI
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-[#94a3b8] hover:text-[#f8fafc]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4 min-h-0">
        {messages.length === 0 && (
          <div className="text-center text-xs text-[#94a3b8] pt-8">
            <GitBranch className="h-8 w-8 mx-auto mb-3 text-[#475569]" />
            <p className="mb-3">
              I can help you discover connections between your tables
            </p>
            {STARTER_QUESTIONS.map((s) => (
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
          <CanvasChatMessage key={i} message={msg} />
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-xs text-[#94a3b8]">
            <Loader2 className="h-3 w-3 animate-spin" />
            Analyzing tables...
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[#334155] p-3 shrink-0">
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
            placeholder="Ask about table connections..."
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

function CanvasChatMessage({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-xl rounded-tr-sm bg-[#2563eb] px-3 py-1.5 text-xs text-white">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Tool results */}
      {message.toolResults?.map((tr, i) => (
        <ToolResultCard key={i} result={tr} />
      ))}

      {/* Text response */}
      {message.content && (
        <p className="text-xs text-[#94a3b8] whitespace-pre-wrap">
          {message.content}
        </p>
      )}
    </div>
  );
}

function ToolResultCard({ result }: { result: ToolResult }) {
  if (result.toolName === "detectRelationships") {
    const suggestions = result.result?.suggestions ?? [];
    if (suggestions.length === 0) {
      return (
        <div className="rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-2 text-xs text-[#94a3b8]">
          No new connections found
        </div>
      );
    }

    return (
      <div className="rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-2 space-y-2">
        <p className="text-xs font-medium text-slate-300">
          Found {suggestions.length} potential connection
          {suggestions.length !== 1 ? "s" : ""}
        </p>
        {suggestions.map((s, i) => (
          <SuggestionCard key={i} suggestion={s} />
        ))}
      </div>
    );
  }

  if (result.toolName === "createRelationship") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-400">
        <Check className="h-3 w-3 shrink-0" />
        <span>Connection created</span>
      </div>
    );
  }

  if (result.toolName === "removeRelationship") {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#ef4444]/30 bg-[#ef4444]/10 px-3 py-2 text-xs text-[#ef4444]">
        <XCircle className="h-3 w-3 shrink-0" />
        <span>Connection removed</span>
      </div>
    );
  }

  return null;
}

function SuggestionCard({
  suggestion,
}: {
  suggestion: SuggestedRelationship;
}) {
  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="min-w-0 text-[11px]">
        <span className="text-slate-300 font-mono">
          {suggestion.fromTable}.{suggestion.fromColumn}
        </span>
        <span className="text-[#475569] mx-1">→</span>
        <span className="text-slate-300 font-mono">
          {suggestion.toTable}.{suggestion.toColumn}
        </span>
        <span className="block text-[10px] text-[#94a3b8] mt-0.5">
          {suggestion.reason}
        </span>
      </div>
      <span
        className={`text-[10px] font-medium shrink-0 px-1.5 py-0.5 rounded-full ${
          suggestion.confidence >= 0.7
            ? "bg-emerald-500/20 text-emerald-400"
            : suggestion.confidence >= 0.5
              ? "bg-[#eab308]/20 text-[#eab308]"
              : "bg-[#94a3b8]/20 text-[#94a3b8]"
        }`}
      >
        {Math.round(suggestion.confidence * 100)}%
      </span>
    </div>
  );
}
