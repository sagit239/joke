import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AiProvider } from "@/server/openaiAdapter";

const JOKE = "למה הכלב ישב ליד המחשב?\nכי הוא חיפש את העכבר.";
const FAKE_KEY = "sk-test-fake-key-123";

// The route uses the real service; only the AI provider is replaced.
const provider = {
  generate: vi.fn<AiProvider["generate"]>(),
  isFlagged: vi.fn<AiProvider["isFlagged"]>(),
};
vi.mock("@/server/openaiAdapter", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  getOpenAIProvider: () => provider,
}));

const { GET, POST } = await import("@/app/api/joke/route");

function postRequest(body: unknown, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/joke", {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "content-type": "application/json",
      ...headers,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

let logSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.stubEnv("GENERATION_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", FAKE_KEY);
  vi.stubEnv("OPENAI_MODEL", "gpt-6-luna");
  provider.generate.mockReset().mockResolvedValue({
    result: { status: "ok", joke: JOKE },
    usage: { inputTokens: 600, outputTokens: 40 },
  });
  provider.isFlagged.mockReset().mockResolvedValue(false);
  logSpy = vi.spyOn(console, "info").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

function loggedText() {
  return JSON.stringify(logSpy.mock.calls);
}

describe("POST /api/joke", () => {
  it("returns an approved joke with no-store", async () => {
    const response = await POST(postRequest({ topic: "כלבים" }));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ joke: JOKE });
  });

  it("returns 422 TOPIC_NOT_ALLOWED for a rejected topic", async () => {
    provider.generate.mockResolvedValue({ result: { status: "rejected" } });
    const response = await POST(postRequest({ topic: "מלחמה" }));
    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({ error: { code: "TOPIC_NOT_ALLOWED" } });
  });

  it("does not send a joke whose output moderation is flagged", async () => {
    provider.isFlagged.mockImplementation(async (text) => text === JOKE);
    const response = await POST(postRequest({ topic: "כלבים" }));
    const text = await response.text();
    expect(response.status).toBe(502);
    expect(text).not.toContain("העכבר");
    expect(JSON.parse(text)).toEqual({ error: { code: "GENERATION_FAILED" } });
  });

  it.each([
    ["foreign origin", postRequest({}, { origin: "https://evil.example" }), 403, "FORBIDDEN_ORIGIN"],
    ["wrong media type", postRequest("x", { "content-type": "text/plain" }), 415, "UNSUPPORTED_MEDIA_TYPE"],
    ["large body", postRequest({ topic: "a".repeat(5000) }), 413, "PAYLOAD_TOO_LARGE"],
    ["broken JSON", postRequest("{"), 400, "INVALID_REQUEST"],
    ["long topic", postRequest({ topic: "א".repeat(201) }), 400, "INVALID_REQUEST"],
  ])("rejects %s before calling the provider", async (_name, request, status, code) => {
    const response = await POST(request);
    expect(response.status).toBe(status);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: { code } });
    expect(provider.generate).not.toHaveBeenCalled();
    expect(provider.isFlagged).not.toHaveBeenCalled();
  });

  it("returns SERVICE_UNAVAILABLE when generation is disabled", async () => {
    vi.stubEnv("GENERATION_ENABLED", "false");
    const response = await POST(postRequest({ topic: "כלבים" }));
    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it("never exposes keys and logs no topic or joke", async () => {
    const response = await POST(postRequest({ topic: "כלבים" }));
    const text = await response.text();
    expect(text).not.toContain(FAKE_KEY);
    const logs = loggedText();
    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(logs).toContain("joke_request");
    expect(logs).not.toContain("כלבים");
    expect(logs).not.toContain("העכבר");
    expect(logs).not.toContain(FAKE_KEY);
  });

  it("maps an unexpected error to GENERATION_FAILED without details", async () => {
    provider.generate.mockRejectedValue(new Error("secret internal detail"));
    const response = await POST(postRequest({ topic: "כלבים" }));
    const text = await response.text();
    expect(response.status).toBe(502);
    expect(text).not.toContain("secret internal detail");
  });
});

describe("other methods", () => {
  it("returns 405 with Allow: POST", async () => {
    const response = GET();
    expect(response.status).toBe(405);
    expect(response.headers.get("Allow")).toBe("POST");
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: { code: "METHOD_NOT_ALLOWED" } });
  });
});
