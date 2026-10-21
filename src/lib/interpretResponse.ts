export type JokeOutcome =
  | { kind: "success"; joke: string }
  | { kind: "rejected" }
  | { kind: "error" };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// Maps any HTTP response (including non-JSON bodies from the platform or WAF)
// to one of the three UI outcomes. Anything unexpected is treated as an error.
export function interpretResponse(status: number, body: unknown): JokeOutcome {
  if (status === 200 && isObject(body) && typeof body.joke === "string" && body.joke.trim() !== "") {
    return { kind: "success", joke: body.joke };
  }
  if (
    status === 422 &&
    isObject(body) &&
    isObject(body.error) &&
    body.error.code === "TOPIC_NOT_ALLOWED"
  ) {
    return { kind: "rejected" };
  }
  return { kind: "error" };
}

// Parses a raw response body, returning undefined when it is not valid JSON.
export function parseBody(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
