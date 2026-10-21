import "server-only";
import { getConfig } from "./config";
import { AppError } from "./errors";
import { openaiGenerator, type JokeGenerator } from "./openaiAdapter";

// Orchestrates joke creation. Milestone 2 adds the content filtering steps
// (ARCHITECTURE.md 2.6) around the generator call.
export async function createJoke(
  topic: string,
  generator: JokeGenerator = openaiGenerator,
): Promise<string> {
  const config = getConfig();
  if (!config.generationEnabled || !config.hasApiKey || config.openaiModel === "") {
    throw new AppError("SERVICE_UNAVAILABLE");
  }

  const result = await generator.generate(topic, AbortSignal.timeout(25_000));
  if (result.status === "rejected") {
    throw new AppError("TOPIC_NOT_ALLOWED");
  }
  return result.joke;
}
