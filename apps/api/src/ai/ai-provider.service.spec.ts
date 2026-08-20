import { AiProviderService } from "./ai-provider.service";

describe("AiProviderService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("isEnabled", () => {
    it("returns false when AI_PROVIDER_API_KEY is not set", () => {
      delete process.env.AI_PROVIDER_API_KEY;
      expect(new AiProviderService().isEnabled()).toBe(false);
    });

    it("returns true when AI_PROVIDER_API_KEY is set", () => {
      process.env.AI_PROVIDER_API_KEY = "test-key";
      expect(new AiProviderService().isEnabled()).toBe(true);
    });
  });

  describe("generate", () => {
    it("throws when no API key is configured", async () => {
      delete process.env.AI_PROVIDER_API_KEY;
      await expect(new AiProviderService().generate("sys", "user")).rejects.toThrow(
        "AI provider is not configured",
      );
    });

    it("builds an OpenAI-format request by default and extracts the message content", async () => {
      process.env.AI_PROVIDER_API_KEY = "test-key";
      delete process.env.AI_PROVIDER_API_FORMAT;
      const fakeFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "hello from openai" } }] }),
      });

      const result = await new AiProviderService().generate("sys", "user", fakeFetch as unknown as typeof fetch);

      expect(result).toBe("hello from openai");
      const [url, init] = fakeFetch.mock.calls[0];
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      expect(init.headers.Authorization).toBe("Bearer test-key");
      const body = JSON.parse(init.body);
      expect(body.messages).toEqual([
        { role: "system", content: "sys" },
        { role: "user", content: "user" },
      ]);
    });

    it("builds an Anthropic-format request when AI_PROVIDER_API_FORMAT=anthropic", async () => {
      process.env.AI_PROVIDER_API_KEY = "test-key";
      process.env.AI_PROVIDER_API_FORMAT = "anthropic";
      const fakeFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ content: [{ text: "hello from anthropic" }] }),
      });

      const result = await new AiProviderService().generate("sys", "user", fakeFetch as unknown as typeof fetch);

      expect(result).toBe("hello from anthropic");
      const [url, init] = fakeFetch.mock.calls[0];
      expect(url).toBe("https://api.anthropic.com/v1/messages");
      expect(init.headers["x-api-key"]).toBe("test-key");
      const body = JSON.parse(init.body);
      expect(body.system).toBe("sys");
      expect(body.messages).toEqual([{ role: "user", content: "user" }]);
    });

    it("extracts the text block when the response includes a thinking block first (Anthropic extended thinking)", async () => {
      process.env.AI_PROVIDER_API_KEY = "test-key";
      process.env.AI_PROVIDER_API_FORMAT = "anthropic";
      const fakeFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          content: [
            { type: "thinking", thinking: "reasoning about the request...", signature: "abc" },
            { type: "text", text: "hello after thinking" },
          ],
        }),
      });

      const result = await new AiProviderService().generate("sys", "user", fakeFetch as unknown as typeof fetch);

      expect(result).toBe("hello after thinking");
    });

    it("respects AI_PROVIDER_API_URL and AI_PROVIDER_MODEL overrides", async () => {
      process.env.AI_PROVIDER_API_KEY = "test-key";
      process.env.AI_PROVIDER_API_URL = "https://my-proxy.example.com/v1/chat/completions";
      process.env.AI_PROVIDER_MODEL = "custom-model";
      const fakeFetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ choices: [{ message: { content: "ok" } }] }),
      });

      await new AiProviderService().generate("sys", "user", fakeFetch as unknown as typeof fetch);

      const [url, init] = fakeFetch.mock.calls[0];
      expect(url).toBe("https://my-proxy.example.com/v1/chat/completions");
      expect(JSON.parse(init.body).model).toBe("custom-model");
    });

    it("throws when the provider responds with a non-2xx status", async () => {
      process.env.AI_PROVIDER_API_KEY = "test-key";
      const fakeFetch = jest.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });

      await expect(
        new AiProviderService().generate("sys", "user", fakeFetch as unknown as typeof fetch),
      ).rejects.toThrow("AI provider request failed with status 500");
    });
  });
});
