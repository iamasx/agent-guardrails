// LLM provider abstraction — auto-selects based on available API keys.
// Priority: Anthropic > OpenAI > Gemini.
// Both judge (fast, small) and reporter (slow, large) use this.

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
// Provider implementations
// ---------------------------------------------------------------------------

async function callAnthropic(opts: LLMCallOptions): Promise<LLMResponse> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! });

  const model = opts.tier === "fast"
    ? "claude-haiku-4-5-20251001"
    : "claude-sonnet-4-5-20250514";

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

  const model = opts.tier === "fast" ? "gpt-4o-mini" : "gpt-4o";

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

  const model = opts.tier === "fast" ? "gemini-2.0-flash" : "gemini-2.5-pro-preview-06-05";

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
  // env.ts already validates at least one key exists, so this is unreachable
  throw new Error("No LLM API key configured");
}

const provider = selectProvider();

/** The active LLM provider name (for logging and DB records). */
export const llmProviderName: ProviderName = provider.name;

/** Call the active LLM provider. */
export const llmCall = provider.call;

console.log(`[llm] using provider: ${provider.name}`);
