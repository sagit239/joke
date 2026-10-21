import { APIError } from "openai";
import { describe, expect, it, vi } from "vitest";
import { createProvider, type OpenAIClient } from "@/server/openaiAdapter";

const signal = new AbortController().signal;

function message(text: string) {
  return { type: "message", content: [{ type: "output_text", text }] };
}

function fakeClient(response: object | Error, moderation: object | Error = { results: [{ flagged: false }] }) {
  const responsesCreate = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  const moderationsCreate = vi.fn(async () => {
    if (moderation instanceof Error) throw moderation;
    return moderation;
  });
  const client = {
    responses: { create: responsesCreate },
    moderations: { create: moderationsCreate },
  } as unknown as OpenAIClient;
  return { client, responsesCreate, moderationsCreate };
}

function completed(text: string, extra: object = {}) {
  return {
    status: "completed",
    output: [message(text)],
    output_text: text,
    usage: { input_tokens: 600, output_tokens: 40 },
    ...extra,
  };
}

describe("generate", () => {
  it("sends fixed instructions with the topic as separate input", async () => {
    const { client, responsesCreate } = fakeClient(completed('{"status":"ok","joke":"בדיחה"}'));
    const provider = createProvider(client, "gpt-6-luna");

    const { result, usage } = await provider.generate("כלבים", signal);

    expect(result).toEqual({ status: "ok", joke: "בדיחה" });
    expect(usage).toEqual({ inputTokens: 600, outputTokens: 40 });
    const [params, options] = responsesCreate.mock.calls[0] as unknown as [Record<string, any>, { signal: AbortSignal }];
    expect(params.model).toBe("gpt-6-luna");
    expect(params.store).toBe(false);
    expect(params.max_output_tokens).toBe(1024);
    expect(params.stream).toBeUndefined();
    expect(params.tools).toBeUndefined();
    expect(params.previous_response_id).toBeUndefined();
    expect(params.input).toBe("Topic (write the joke in Hebrew): כלבים");
    expect(params.instructions).not.toContain("כלבים");
    expect(params.text.format).toMatchObject({ type: "json_schema", strict: true });
    expect(params.text.format.schema.additionalProperties).toBe(false);
    expect(options.signal).toBe(signal);
  });

  it("maps a model rejection to rejected", async () => {
    const { client } = fakeClient(completed('{"status":"rejected","joke":""}'));
    const { result } = await createProvider(client, "m").generate("x", signal);
    expect(result).toEqual({ status: "rejected" });
  });

  it("maps an explicit safety refusal to rejected without exposing its text", async () => {
    const { client } = fakeClient({
      status: "completed",
      output: [{ type: "message", content: [{ type: "refusal", refusal: "I can't help" }] }],
      output_text: "",
    });
    const { result } = await createProvider(client, "m").generate("x", signal);
    expect(result).toEqual({ status: "rejected" });
  });

  it("fails on an incomplete response", async () => {
    const { client } = fakeClient(completed('{"status":"ok","joke":"בדי', { status: "incomplete" }));
    await expect(createProvider(client, "m").generate("x", signal)).rejects.toMatchObject({
      code: "GENERATION_FAILED",
    });
  });

  it("fails on malformed JSON", async () => {
    const { client } = fakeClient(completed("not json"));
    await expect(createProvider(client, "m").generate("x", signal)).rejects.toMatchObject({
      code: "GENERATION_FAILED",
    });
  });

  it.each([
    ["401 bad key", 401, undefined, "SERVICE_UNAVAILABLE"],
    ["429 insufficient_quota", 429, "insufficient_quota", "SERVICE_UNAVAILABLE"],
    ["429 rate limit", 429, "rate_limit_exceeded", "GENERATION_FAILED"],
    ["500 server error", 500, undefined, "GENERATION_FAILED"],
  ])("maps %s", async (_name, status, code, expected) => {
    const error = new APIError(status, { code }, "provider error", new Headers());
    const { client } = fakeClient(error);
    await expect(createProvider(client, "m").generate("x", signal)).rejects.toMatchObject({
      code: expected,
    });
  });
});

describe("isFlagged", () => {
  it("returns the moderation flag", async () => {
    const { client, moderationsCreate } = fakeClient({}, { results: [{ flagged: true }] });
    expect(await createProvider(client, "m").isFlagged("text", signal)).toBe(true);
    expect(moderationsCreate).toHaveBeenCalledWith(
      { model: "omni-moderation-latest", input: "text" },
      { signal },
    );
  });

  it("treats an unexpected moderation response as a failure, not as clean", async () => {
    const { client } = fakeClient({}, { results: [] });
    await expect(createProvider(client, "m").isFlagged("text", signal)).rejects.toMatchObject({
      code: "GENERATION_FAILED",
    });
  });
});
