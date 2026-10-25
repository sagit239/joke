import type { JokeRequest } from "./contracts";
import { interpretResponse, parseBody, type JokeOutcome } from "./interpretResponse";
import { normalizeTopic } from "./normalizeTopic";

export const CLIENT_TIMEOUT_MS = 28_000;

// Sends one POST /api/joke and maps every result to a UI outcome.
// Never throws: network loss, timeouts and non-JSON bodies become "error".
// Makes exactly one fetch call; there is no automatic retry (ARCHITECTURE.md 2.7).
export async function requestJoke(
  topic: string,
  fetchImpl: typeof fetch = fetch,
  timeoutMs = CLIENT_TIMEOUT_MS,
): Promise<JokeOutcome> {
  try {
    const payload: JokeRequest = { topic: normalizeTopic(topic) };
    const response = await fetchImpl("/api/joke", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return interpretResponse(response.status, parseBody(await response.text()));
  } catch {
    return { kind: "error" };
  }
}
