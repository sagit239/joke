import { describe, expect, it, vi } from "vitest";
import { requestJoke } from "@/lib/requestJoke";

const JOKE = "למה הכלב ישב ליד המחשב?\nכי הוא חיפש את העכבר.";

function fakeFetch(respond: (init: RequestInit) => Promise<Response>) {
  return vi.fn((_url: string | URL | Request, init?: RequestInit) => respond(init ?? {})) as unknown as typeof fetch &
    ReturnType<typeof vi.fn>;
}

function reply(status: number, body: string, contentType = "application/json") {
  return fakeFetch(async () => new Response(body, { status, headers: { "content-type": contentType } }));
}

describe("requestJoke", () => {
  it("returns success for a joke and sends one normalized POST", async () => {
    const fetchImpl = reply(200, JSON.stringify({ joke: JOKE }));
    expect(await requestJoke("  כלבים \n", fetchImpl)).toEqual({ kind: "success", joke: JOKE });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/joke");
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ topic: "כלבים" });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it("returns rejected for TOPIC_NOT_ALLOWED", async () => {
    const fetchImpl = reply(422, JSON.stringify({ error: { code: "TOPIC_NOT_ALLOWED" } }));
    expect(await requestJoke("מלחמה", fetchImpl)).toEqual({ kind: "rejected" });
  });

  it.each([
    ["HTML 502", reply(502, "<html><body>Bad Gateway</body></html>", "text/html")],
    ["HTML 504 platform timeout", reply(504, "<html>FUNCTION_INVOCATION_TIMEOUT</html>", "text/html")],
    ["plain-text 429 from a firewall", reply(429, "Too Many Requests", "text/plain")],
    ["200 with a non-JSON body", reply(200, "<b>not json</b>", "text/html")],
    ["503 app error", reply(503, JSON.stringify({ error: { code: "SERVICE_UNAVAILABLE" } }))],
  ])("returns error for %s without throwing", async (_name, fetchImpl) => {
    expect(await requestJoke("כלבים", fetchImpl)).toEqual({ kind: "error" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("returns error when the network is down", async () => {
    const fetchImpl = fakeFetch(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await requestJoke("כלבים", fetchImpl)).toEqual({ kind: "error" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("gives up after the client timeout instead of waiting forever", async () => {
    const fetchImpl = fakeFetch(
      (init) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );
    const started = Date.now();
    expect(await requestJoke("כלבים", fetchImpl, 50)).toEqual({ kind: "error" });
    expect(Date.now() - started).toBeLessThan(2000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
