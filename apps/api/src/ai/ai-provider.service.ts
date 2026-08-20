import { Injectable } from "@nestjs/common";

type AiProviderFormat = "openai" | "anthropic";

interface AiConfig {
  apiUrl: string;
  apiKey: string;
  format: AiProviderFormat;
  model: string;
  timeoutMs: number;
  maxTokens: number;
}

interface AiAdapter {
  buildRequest(config: AiConfig, systemPrompt: string, userPrompt: string): {
    url: string;
    headers: Record<string, string>;
    body: unknown;
  };
  extractContent(responseJson: Record<string, unknown>): string;
}

const DEFAULT_URLS: Record<AiProviderFormat, string> = {
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
};

const DEFAULT_MODELS: Record<AiProviderFormat, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-5",
};

const ADAPTERS: Record<AiProviderFormat, AiAdapter> = {
  openai: {
    buildRequest: (config, systemPrompt, userPrompt) => ({
      url: config.apiUrl,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${config.apiKey}` },
      body: {
        model: config.model,
        max_tokens: config.maxTokens,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      },
    }),
    extractContent: (json) => {
      const choices = json.choices as Array<{ message?: { content?: string } }> | undefined;
      return choices?.[0]?.message?.content ?? "";
    },
  },
  anthropic: {
    buildRequest: (config, systemPrompt, userPrompt) => ({
      url: config.apiUrl,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": config.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: {
        model: config.model,
        max_tokens: config.maxTokens,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      },
    }),
    extractContent: (json) => {
      const content = json.content as Array<{ text?: string }> | undefined;
      return content?.[0]?.text ?? "";
    },
  },
};

function readConfig(env: NodeJS.ProcessEnv): AiConfig | null {
  const apiKey = env.AI_PROVIDER_API_KEY;
  if (!apiKey) return null;

  const format: AiProviderFormat = env.AI_PROVIDER_API_FORMAT === "anthropic" ? "anthropic" : "openai";
  return {
    apiUrl: env.AI_PROVIDER_API_URL ?? DEFAULT_URLS[format],
    apiKey,
    format,
    model: env.AI_PROVIDER_MODEL ?? DEFAULT_MODELS[format],
    timeoutMs: Number(env.AI_PROVIDER_TIMEOUT_MS ?? 60_000),
    maxTokens: Number(env.AI_PROVIDER_MAX_TOKENS ?? 4_000),
  };
}

@Injectable()
export class AiProviderService {
  isEnabled(): boolean {
    return readConfig(process.env) !== null;
  }

  async generate(systemPrompt: string, userPrompt: string, fetchImpl: typeof fetch = fetch): Promise<string> {
    const config = readConfig(process.env);
    if (!config) {
      throw new Error("AI provider is not configured");
    }

    const adapter = ADAPTERS[config.format];
    const { url, headers, body } = adapter.buildRequest(config, systemPrompt, userPrompt);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);
    try {
      const res = await fetchImpl(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.ok) {
        throw new Error(`AI provider request failed with status ${res.status}`);
      }
      const json = (await res.json()) as Record<string, unknown>;
      return adapter.extractContent(json);
    } finally {
      clearTimeout(timeout);
    }
  }
}
