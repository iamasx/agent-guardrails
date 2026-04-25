// LLM provider abstraction — auto-selects based on available API keys.
// Priority: Anthropic > OpenAI > Gemini.
// Override models via LLM_JUDGE_MODEL and LLM_REPORT_MODEL env vars.

import { env } from "./env.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LLMResponse {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
}

export interface LLMCallOptions {
  system: string;
  userMessage: string;
  maxTokens: number;
  /** Which model tier to use — "fast" picks the cheapest, "report" picks the most capable. */
  tier: "fast" | "report";
}

// ---------------------------------------------------------------------------
// Default models per provider and tier
// ---------------------------------------------------------------------------

const DEFAULTS: Record<ProviderName, { fast: string; report: string }> = {
  anthropic: { fast: "claude-haiku-4-5-20251001", report: "claude-sonnet-4-5-20250514" },
  openai:    { fast: "gpt-4o-mini",               report: "gpt-4o" },
  gemini:    { fast: "gemini-2.0-flash",           report: "gemini-2.5-pro" },
};

function resolveModel(providerName: ProviderName, tier: "fast" | "report"): string {
  const envOverride = tier === "fast" ? env.LLM_JUDGE_MODEL : env.LLM_REPORT_MODEL;
  return envOverride || DEFAULTS[providerName][tier];
}

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------

async function callAnthropic(opts: LLMCallOptions): Promise<LLMResponse> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! });

  const model = resolveModel("anthropic", opts.tier);

  const response = await client.messages.create({
    model,
    max_tokens: opts.maxTokens,
    system: opts.system,
    messages: [{ role: "user", content: opts.userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return {
    text: textBlock?.type === "text" ? textBlock.text : "",
    model,
    promptTokens: response.usage.input_tokens,
    completionTokens: response.usage.output_tokens,
  };
}

async function callOpenAI(opts: LLMCallOptions): Promise<LLMResponse> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY! });

  const model = resolveModel("openai", opts.tier);

  const response = await client.chat.completions.create({
    model,
    max_tokens: opts.maxTokens,
    messages: [
      { role: "system", content: opts.system },
      { role: "user", content: opts.userMessage },
    ],
  });

  return {
    text: response.choices[0]?.message?.content ?? "",
    model,
    promptTokens: response.usage?.prompt_tokens ?? 0,
    completionTokens: response.usage?.completion_tokens ?? 0,
  };
}

async function callGemini(opts: LLMCallOptions): Promise<LLMResponse> {
  const { GoogleGenAI } = await import("@google/genai");
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY! });

  const model = resolveModel("gemini", opts.tier);

  const response = await client.models.generateContent({
    model,
    config: {
      maxOutputTokens: opts.maxTokens,
      systemInstruction: opts.system,
    },
    contents: opts.userMessage,
  });

  return {
    text: response.text ?? "",
    model,
    promptTokens: response.usageMetadata?.promptTokenCount ?? 0,
    completionTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

// ---------------------------------------------------------------------------
// Provider selection (evaluated once at import time)
// ---------------------------------------------------------------------------

type ProviderName = "anthropic" | "openai" | "gemini";

function selectProvider(): { name: ProviderName; call: (opts: LLMCallOptions) => Promise<LLMResponse> } {
  if (env.ANTHROPIC_API_KEY) return { name: "anthropic", call: callAnthropic };
  if (env.OPENAI_API_KEY) return { name: "openai", call: callOpenAI };
  if (env.GEMINI_API_KEY) return { name: "gemini", call: callGemini };
  throw new Error("No LLM API key configured");
}

const provider = selectProvider();

/** The active LLM provider name (for logging and DB records). */
export const llmProviderName: ProviderName = provider.name;

/** Call the active LLM provider. */
export const llmCall = provider.call;

const judgeModel = resolveModel(provider.name, "fast");
const reportModel = resolveModel(provider.name, "report");
console.log(`[llm] provider=${provider.name} judge=${judgeModel} report=${reportModel}`);
