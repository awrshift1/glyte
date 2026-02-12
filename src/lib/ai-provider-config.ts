import { generateText, type LanguageModel } from "ai";

/**
 * Multi-provider AI config with graceful fallback.
 * Supports Anthropic, OpenAI, and Google via Vercel AI SDK Provider Registry.
 * Model selection via GLYTE_MODEL env var.
 */

export function getModel(): LanguageModel {
  const modelSpec = process.env.GLYTE_MODEL ?? "anthropic:claude-haiku-4-5-20251001";
  const [provider, modelId] = modelSpec.includes(":") ? modelSpec.split(":", 2) : ["anthropic", modelSpec];

  switch (provider) {
    case "anthropic": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { anthropic } = require("@ai-sdk/anthropic");
      return anthropic(modelId);
    }
    case "openai": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { openai } = require("@ai-sdk/openai");
      return openai(modelId);
    }
    case "google": {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { google } = require("@ai-sdk/google");
      return google(modelId);
    }
    default:
      throw new Error(`Unknown AI provider: ${provider}. Use anthropic, openai, or google.`);
  }
}

/**
 * Check if any AI provider is configured (has API key).
 */
export function isAiConfigured(): boolean {
  return !!(
    process.env.ANTHROPIC_API_KEY ||
    process.env.OPENAI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY
  );
}

/**
 * Safe wrapper around generateText — returns fallback on any error.
 */
export async function safeGenerateText(
  params: Parameters<typeof generateText>[0]
): Promise<{ text: string; fallback?: boolean }> {
  try {
    const result = await generateText(params);
    return { text: result.text };
  } catch (error) {
    console.error("[AI] Generation failed, returning fallback:", error);
    return { text: "", fallback: true };
  }
}
