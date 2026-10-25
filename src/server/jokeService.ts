import "server-only";
import { getConfig } from "./config";
import { isAcceptableJokeText } from "./contentPolicy";
import { AppError } from "./errors";
import { getOpenAIProvider, type AiProvider, type TokenUsage } from "./openaiAdapter";

export type JokeOutcome = { joke: string; usage?: TokenUsage };

// Orchestrates the filter chain (ARCHITECTURE.md 2.6). A joke is returned only
// after every check has approved it; any failure blocks it.
// One deadline is shared by all provider calls (ARCHITECTURE.md 2.7);
// deadlineMs is a parameter only so tests can use a short one.
export async function createJoke(
  topic: string,
  getProvider: () => AiProvider = getOpenAIProvider,
  deadlineMs = 25_000,
): Promise<JokeOutcome> {
  const config = getConfig();
  if (!config.generationEnabled || !config.hasApiKey || config.openaiModel === "") {
    throw new AppError("SERVICE_UNAVAILABLE");
  }

  const provider = getProvider();
  const signal = AbortSignal.timeout(deadlineMs);
  // Guards against a provider call that resolves after the deadline anyway.
  const checkDeadline = () => {
    if (signal.aborted) throw new AppError("GENERATION_TIMEOUT");
  };

  if (topic !== "") {
    const flagged = await provider.isFlagged(topic, signal);
    checkDeadline();
    if (flagged) throw new AppError("TOPIC_NOT_ALLOWED");
  }

  const { result, usage } = await provider.generate(topic, signal);
  checkDeadline();
  if (result.status === "rejected") {
    throw new AppError("TOPIC_NOT_ALLOWED");
  }

  const joke = result.joke.trim();
  if (!isAcceptableJokeText(joke)) {
    throw new AppError("GENERATION_FAILED");
  }
  const outputFlagged = await provider.isFlagged(joke, signal);
  checkDeadline();
  if (outputFlagged) {
    throw new AppError("GENERATION_FAILED");
  }

  return { joke, usage };
}
