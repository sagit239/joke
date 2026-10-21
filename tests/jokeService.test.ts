import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/server/errors";
import { createJoke } from "@/server/jokeService";
import type { AiProvider, GenerationResult } from "@/server/openaiAdapter";

const JOKE = "למה הכלב ישב ליד המחשב?\nכי הוא חיפש את העכבר.";

type Options = {
  result?: GenerationResult;
  flagged?: (text: string) => boolean;
  moderationError?: (text: string) => boolean;
};

// Records the order of provider calls so tests can prove the filter sequence.
function mockProvider({ result = { status: "ok", joke: JOKE }, flagged = () => false, moderationError = () => false }: Options = {}) {
  const calls: string[] = [];
  const provider: AiProvider = {
    generate: vi.fn(async (topic: string) => {
      calls.push(`generate:${topic}`);
      return { result };
    }),
    isFlagged: vi.fn(async (text: string) => {
      calls.push(`moderate:${text}`);
      if (moderationError(text)) throw new AppError("GENERATION_FAILED");
      return flagged(text);
    }),
  };
  return { provider, calls, get: () => provider };
}

beforeEach(() => {
  vi.stubEnv("GENERATION_ENABLED", "true");
  vi.stubEnv("OPENAI_API_KEY", "sk-test");
  vi.stubEnv("OPENAI_MODEL", "gpt-6-luna");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("configuration", () => {
  it.each([
    ["generation disabled", "GENERATION_ENABLED", "false"],
    ["API key missing", "OPENAI_API_KEY", ""],
    ["model missing", "OPENAI_MODEL", ""],
  ])("does not call the provider when %s", async (_name, key, value) => {
    vi.stubEnv(key, value);
    const mock = mockProvider();
    await expect(createJoke("כלבים", mock.get)).rejects.toEqual(new AppError("SERVICE_UNAVAILABLE"));
    expect(mock.calls).toEqual([]);
  });
});

describe("filter chain", () => {
  it("returns the joke only after input moderation, generation and output moderation", async () => {
    const mock = mockProvider();
    await expect(createJoke("כלבים", mock.get)).resolves.toMatchObject({ joke: JOKE });
    expect(mock.calls).toEqual(["moderate:כלבים", "generate:כלבים", `moderate:${JOKE}`]);
  });

  it("skips input moderation for an empty topic", async () => {
    const mock = mockProvider();
    await createJoke("", mock.get);
    expect(mock.calls).toEqual(["generate:", `moderate:${JOKE}`]);
  });

  it("rejects a flagged topic without calling generation", async () => {
    const mock = mockProvider({ flagged: (text) => text === "נושא אסור" });
    await expect(createJoke("נושא אסור", mock.get)).rejects.toEqual(new AppError("TOPIC_NOT_ALLOWED"));
    expect(mock.calls).toEqual(["moderate:נושא אסור"]);
  });

  it("maps a model rejection to TOPIC_NOT_ALLOWED", async () => {
    const mock = mockProvider({ result: { status: "rejected" } });
    await expect(createJoke("מלחמה", mock.get)).rejects.toEqual(new AppError("TOPIC_NOT_ALLOWED"));
    expect(mock.provider.generate).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["flagged output", { flagged: (text: string) => text === JOKE }],
    ["output moderation error", { moderationError: (text: string) => text === JOKE }],
    ["input moderation error", { moderationError: (text: string) => text === "כלבים" }],
    ["empty output", { result: { status: "ok", joke: "  " } as GenerationResult }],
    ["non-Hebrew output", { result: { status: "ok", joke: "Just English" } as GenerationResult }],
    ["too long output", { result: { status: "ok", joke: "א".repeat(601) } as GenerationResult }],
  ])("blocks the joke on %s and generates at most once", async (_name, options) => {
    const mock = mockProvider(options);
    await expect(createJoke("כלבים", mock.get)).rejects.toEqual(new AppError("GENERATION_FAILED"));
    expect(mock.calls.filter((c) => c.startsWith("generate")).length).toBeLessThanOrEqual(1);
  });

  it("trims the approved joke", async () => {
    const mock = mockProvider({ result: { status: "ok", joke: `\n ${JOKE} \n` } });
    await expect(createJoke("כלבים", mock.get)).resolves.toMatchObject({ joke: JOKE });
  });
});
