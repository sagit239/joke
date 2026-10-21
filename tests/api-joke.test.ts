import { afterEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/joke/route";

const FAKE_KEY = "sk-test-fake-key-123";

function postRequest(body: unknown) {
  return new Request("http://localhost:3000/api/joke", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/joke (Milestone 1 skeleton)", () => {
  it("returns SERVICE_UNAVAILABLE when generation is disabled", async () => {
    vi.stubEnv("GENERATION_ENABLED", "false");
    vi.stubEnv("OPENAI_API_KEY", FAKE_KEY);
    vi.stubEnv("OPENAI_MODEL", "gpt-6-luna");

    const response = await POST(postRequest({ topic: "כלבים" }));

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ error: { code: "SERVICE_UNAVAILABLE" } });
  });

  it("returns SERVICE_UNAVAILABLE from the skeleton adapter when enabled", async () => {
    vi.stubEnv("GENERATION_ENABLED", "true");
    vi.stubEnv("OPENAI_API_KEY", FAKE_KEY);
    vi.stubEnv("OPENAI_MODEL", "gpt-6-luna");

    const response = await POST(postRequest({ topic: "" }));
    const text = await response.text();

    expect(response.status).toBe(503);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(text).not.toContain(FAKE_KEY);
  });

  it("returns SERVICE_UNAVAILABLE when the key is missing", async () => {
    vi.stubEnv("GENERATION_ENABLED", "true");
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("OPENAI_MODEL", "gpt-6-luna");

    const response = await POST(postRequest({ topic: "כלבים" }));

    expect(response.status).toBe(503);
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
