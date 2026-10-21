import { describe, expect, it } from "vitest";
import { interpretResponse, parseBody } from "@/lib/interpretResponse";

describe("interpretResponse", () => {
  it("treats 200 with a joke as success", () => {
    expect(interpretResponse(200, { joke: "בדיחה" })).toEqual({ kind: "success", joke: "בדיחה" });
  });

  it("treats 422 TOPIC_NOT_ALLOWED as rejected", () => {
    expect(interpretResponse(422, { error: { code: "TOPIC_NOT_ALLOWED" } })).toEqual({
      kind: "rejected",
    });
  });

  it.each([
    ["503 service unavailable", 503, { error: { code: "SERVICE_UNAVAILABLE" } }],
    ["429 rate limit", 429, { error: { code: "RATE_LIMITED" } }],
    ["HTML body", 502, parseBody("<html>Bad gateway</html>")],
    ["empty body", 500, parseBody("")],
    ["200 without joke", 200, {}],
    ["200 with empty joke", 200, { joke: "  " }],
    ["422 with another code", 422, { error: { code: "INVALID_REQUEST" } }],
  ])("treats %s as error", (_name, status, body) => {
    expect(interpretResponse(status, body)).toEqual({ kind: "error" });
  });
});

describe("parseBody", () => {
  it("returns undefined for non-JSON text", () => {
    expect(parseBody("not json")).toBeUndefined();
  });
});
