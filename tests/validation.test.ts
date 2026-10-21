import { describe, expect, it } from "vitest";
import { AppError } from "@/server/errors";
import { validateJokeRequest } from "@/server/validation";

const URL_ = "http://localhost:3000/api/joke";

function request(
  body: string,
  headers: Record<string, string> = {},
): Request {
  return new Request(URL_, {
    method: "POST",
    headers: {
      host: "localhost:3000",
      origin: "http://localhost:3000",
      "content-type": "application/json",
      ...headers,
    },
    body,
  });
}

async function codeOf(req: Request) {
  try {
    await validateJokeRequest(req);
    return "OK";
  } catch (error) {
    return (error as AppError).code;
  }
}

describe("origin checks", () => {
  it("accepts a same-origin request", async () => {
    expect(await validateJokeRequest(request('{"topic":"כלבים"}'))).toBe("כלבים");
  });

  it("accepts same-origin Sec-Fetch-Site", async () => {
    expect(await codeOf(request("{}", { "sec-fetch-site": "same-origin" }))).toBe("OK");
  });

  it.each([
    ["foreign origin", { origin: "https://evil.example" }],
    ["null origin", { origin: "null" }],
    ["cross-site fetch", { "sec-fetch-site": "cross-site" }],
    ["different port", { origin: "http://localhost:4000" }],
  ])("rejects %s with FORBIDDEN_ORIGIN", async (_name, headers) => {
    expect(await codeOf(request("{}", headers))).toBe("FORBIDDEN_ORIGIN");
  });

  it("rejects a missing Origin header", async () => {
    const req = new Request(URL_, {
      method: "POST",
      headers: { host: "localhost:3000", "content-type": "application/json" },
      body: "{}",
    });
    expect(await codeOf(req)).toBe("FORBIDDEN_ORIGIN");
  });
});

describe("media type and size", () => {
  it("rejects non-JSON content type", async () => {
    expect(await codeOf(request("topic=x", { "content-type": "text/plain" }))).toBe(
      "UNSUPPORTED_MEDIA_TYPE",
    );
  });

  it("accepts JSON with a charset", async () => {
    expect(await codeOf(request("{}", { "content-type": "application/json; charset=utf-8" }))).toBe("OK");
  });

  it("rejects a body over 4 KiB", async () => {
    const body = JSON.stringify({ topic: "a".repeat(5000) });
    expect(await codeOf(request(body))).toBe("PAYLOAD_TOO_LARGE");
  });
});

describe("structure and topic", () => {
  it.each([
    ["broken JSON", "{"],
    ["array", "[]"],
    ["null topic", '{"topic":null}'],
    ["number topic", '{"topic":5}'],
    ["object topic", '{"topic":{}}'],
    ["JSON string", '"כלבים"'],
  ])("rejects %s with INVALID_REQUEST", async (_name, body) => {
    expect(await codeOf(request(body))).toBe("INVALID_REQUEST");
  });

  it.each([
    ["missing topic", "{}"],
    ["empty topic", '{"topic":""}'],
    ["whitespace topic", '{"topic":"  \\n\\t "}'],
  ])("treats %s as an empty topic", async (_name, body) => {
    expect(await validateJokeRequest(request(body))).toBe("");
  });

  it("trims and NFC-normalizes the topic", async () => {
    const decomposed = "  café ";
    const topic = await validateJokeRequest(request(JSON.stringify({ topic: decomposed })));
    expect(topic).toBe("café");
  });

  it("allows exactly 200 code points and rejects 201", async () => {
    const ok = "🐶".repeat(200);
    expect(await validateJokeRequest(request(JSON.stringify({ topic: ok })))).toBe(ok);
    expect(await codeOf(request(JSON.stringify({ topic: ok + "א" })))).toBe("INVALID_REQUEST");
  });
});
