import { getAvailablePoolKey, getProviderSettings, providerBaseUrl } from "./adminKeyPoolService";
import { getRequestUserId } from "./requestUser";

export interface LLMMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface LLMRetryInfo {
  attempt: number;
  waitMs: number;
  status: number;
}

export interface LLMCompletionOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  response_format?: any;
  /** Epoch ms after which retries stop and the caller falls back instead of waiting. */
  retryDeadlineMs?: number;
  onRetry?: (info: LLMRetryInfo) => void;
}

const MAX_PROVIDER_RETRIES = 3;
const MAX_RETRY_WAIT_MS = 30_000;
const BASE_RETRY_WAIT_MS = 1_500;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface ResolvedProvider {
  provider: string;
  apiKey: string;
  baseUrl: string;
  effectiveModel: string;
}

async function resolveProvider(options: LLMCompletionOptions): Promise<ResolvedProvider> {
  const settings = await getProviderSettings();
  const provider = (settings.LLM || "groq").toLowerCase();
  const userId = await getRequestUserId();
  const apiKey = await getAvailablePoolKey(provider, userId);

  if (!apiKey) {
    throw new Error(
      `No active API key found for provider '${provider}'. Please add a key in the Admin Console or set GROQ_API_KEY.`
    );
  }

  const effectiveModel =
    options.model ||
    (provider === "qwen"
      ? settings.QWEN_MODEL || "qwen-plus"
      : settings.GROQ_MODEL || "openai/gpt-oss-120b");

  return { provider, apiKey: apiKey.trim(), baseUrl: providerBaseUrl(provider), effectiveModel };
}

function parseRetryAfterMs(response: Response, body: string): number | null {
  const header = response.headers.get("retry-after");
  if (header) {
    const seconds = Number(header);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  }
  try {
    const json = JSON.parse(body);
    const value =
      json?.retry_after ?? json?.error?.retry_after ?? json?.error?.metadata?.retry_after;
    const seconds = Number(value);
    if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;
  } catch {}
  return null;
}

function isRetryableProviderError(status: number, body: string): boolean {
  if (status === 429 || status === 500 || status === 502 || status === 503 || status === 504) {
    return true;
  }
  // Groq (and some OpenAI-compatible gateways) report per-minute token limits
  // as 413s; the request itself may fit once the TPM window clears.
  return (
    status === 413 &&
    /rate_limit_exceeded|tokens per minute|\bTPM\b|request too large/i.test(body)
  );
}

async function postChatCompletion(
  resolved: ResolvedProvider,
  body: Record<string, unknown>,
  onRetry?: (info: LLMRetryInfo) => void,
  retryDeadlineMs?: number,
): Promise<Response> {
  const { provider, apiKey, baseUrl } = resolved;
  const isGroqGptOss =
    provider === "groq" && /gpt-oss/i.test(resolved.effectiveModel);
  const requestBody = isGroqGptOss
    ? {
        ...body,
        reasoning_effort: "low",
        ...(!body.response_format
          ? {
              tools: Array.isArray(body.tools)
                ? [...body.tools, { type: "browser_search" }]
                : [{ type: "browser_search" }],
            }
          : {}),
      }
    : body;

  for (let attempt = 0; ; attempt += 1) {
    if (retryDeadlineMs != null && Date.now() >= retryDeadlineMs) {
      throw new Error(
        `LLM Provider (${provider}) request budget for this slide is exhausted.`,
      );
    }
    // A stalled provider response must not consume the whole request budget.
    const requestTimeoutMs =
      retryDeadlineMs == null
        ? null
        : Math.max(
            15_000,
            Math.min(90_000, retryDeadlineMs - Date.now()),
          );
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(requestBody),
      ...(requestTimeoutMs != null
        ? { signal: AbortSignal.timeout(requestTimeoutMs) }
        : {}),
    });

    if (response.ok) return response;

    const errorBody = await response.text();
    if (
      attempt >= MAX_PROVIDER_RETRIES ||
      !isRetryableProviderError(response.status, errorBody)
    ) {
      throw new Error(
        `LLM Provider (${provider}) returned ${response.status}: ${errorBody}`
      );
    }

    const waitMs = Math.min(
      parseRetryAfterMs(response, errorBody) ??
        BASE_RETRY_WAIT_MS * 2 ** attempt,
      MAX_RETRY_WAIT_MS,
    );
    // Never let backoff outlive the caller's budget: a long wait would only
    // push the request past the serverless duration limit, so fail fast and
    // let the caller use its fallback.
    if (
      retryDeadlineMs != null &&
      Date.now() + waitMs > retryDeadlineMs
    ) {
      throw new Error(
        `LLM Provider (${provider}) returned ${response.status} and the retry budget for this request is exhausted.`,
      );
    }
    console.warn(
      `[LLM] ${provider} returned ${response.status}; retrying in ${Math.round(
        waitMs / 1000,
      )}s (attempt ${attempt + 1}/${MAX_PROVIDER_RETRIES})`,
    );
    onRetry?.({ attempt: attempt + 1, waitMs, status: response.status });
    await sleep(waitMs + Math.floor(Math.random() * 400));
  }
}

export interface LLMTextResult {
  text: string;
  model: string;
  usage?: { prompt_tokens: number; completion_tokens: number };
}

export async function callLLMChatCompletion(
  messages: LLMMessage[],
  options: LLMCompletionOptions = {}
): Promise<LLMTextResult> {
  const resolved = await resolveProvider(options);

  const response = await postChatCompletion(
    resolved,
    {
      model: resolved.effectiveModel,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.max_tokens ?? 4096,
      response_format: options.response_format,
    },
    options.onRetry,
    options.retryDeadlineMs,
  );

  const data = await response.json();
  const choice = data.choices?.[0];
  const text = choice?.message?.content || "";

  return {
    text,
    model: resolved.effectiveModel,
    usage: data.usage
      ? {
          prompt_tokens: data.usage.prompt_tokens || 0,
          completion_tokens: data.usage.completion_tokens || 0,
        }
      : undefined,
  };
}

export async function* streamLLMChatCompletion(
  messages: LLMMessage[],
  options: LLMCompletionOptions = {}
): AsyncGenerator<string, void, unknown> {
  const resolved = await resolveProvider(options);

  const response = await postChatCompletion(
    resolved,
    {
      model: resolved.effectiveModel,
      messages,
      temperature: options.temperature ?? 0.3,
      max_tokens: options.max_tokens ?? 4096,
      stream: true,
    },
    options.onRetry,
  );

  if (!response.body) {
    throw new Error(`LLM Provider (${resolved.provider}) returned an empty stream`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data: ")) continue;
      const dataStr = trimmed.slice(6);
      if (dataStr === "[DONE]") return;
      try {
        const json = JSON.parse(dataStr);
        const delta = json.choices?.[0]?.delta?.content;
        if (delta) {
          yield delta;
        }
      } catch {}
    }
  }
}
