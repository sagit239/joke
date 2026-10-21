import "server-only";
import { getConfig } from "./config";
import { isAcceptableJokeText } from "./contentPolicy";
import { AppError } from "./errors";
import { getOpenAIProvider, type AiProvider, type TokenUsage } from "./openaiAdapter";

export type JokeOutcome = { joke: string; usage?: TokenUsage };

// Orchestrates the filter chain (ARCHITECTURE.md 2.6). A joke is returned only
// after every check has approved it; any failure blocks it.
export async function createJoke(
  topic: string,
  getProvider: () => AiProvider = getOpenAIProvider,
): Promise<JokeOutcome> {
  const config = getConfig();
  if (!config.generationEnabled || !config.hasApiKey || config.openaiModel === "") {
    throw new AppError("SERVICE_UNAVAILABLE");
  }

  const provider = getProvider();
  const signal = AbortSignal.timeout(25_000);

  if (topic !== "" && (await provider.isFlagged(topic, signal))) {
    throw new AppError("TOPIC_NOT_ALLOWED");
  }

  const { result, usage } = await provider.generate(topic, signal);
  if (result.status === "rejected") {
    throw new AppError("TOPIC_NOT_ALLOWED");
  }

  const joke = result.joke.trim();
  if (!isAcceptableJokeText(joke)) {
    throw new AppError("GENERATION_FAILED");
  }
  if (await provider.isFlagged(joke, signal)) {
    throw new AppError("GENERATION_FAILED");
  }

  return { joke, usage };
}
