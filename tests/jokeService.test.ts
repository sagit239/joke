import { afterEach, describe, expect, it, vi } from "vitest";
import { AppError } from "@/server/errors";
import { createJoke } from "@/server/jokeService";
import type { JokeGenerator } from "@/server/openaiAdapter";

function mockGenerator(): JokeGenerator & { generate: ReturnType<typeof vi.fn> } {
  return { generate: vi.fn(async () => ({ status: "ok" as const, joke: "בדיחה" })) };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createJoke", () => {
  it("does not call the provider when generation is disabled", async () => {
    vi.stubEnv("GENERATION_ENABLED", "false");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_MODEL", "gpt-6-luna");
    const generator = mockGenerator();

    await expect(createJoke("כלבים", generator)).rejects.toEqual(new AppError("SERVICE_UNAVAILABLE"));
    expect(generator.generate).toHaveBeenCalledTimes(0);
  });

  it("calls the provider once when enabled and configured", async () => {
    vi.stubEnv("GENERATION_ENABLED", "true");
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubEnv("OPENAI_MODEL", "gpt-6-luna");
    const generator = mockGenerator();

    await expect(createJoke("כלבים", generator)).resolves.toBe("בדיחה");
    expect(generator.generate).toHaveBeenCalledTimes(1);
  });
});
