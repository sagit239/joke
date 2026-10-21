import "server-only";
import { AppError } from "./errors";

export type GenerationResult =
  | { status: "ok"; joke: string }
  | { status: "rejected" };

export interface JokeGenerator {
  generate(topic: string, signal: AbortSignal): Promise<GenerationResult>;
}

// Milestone 1 skeleton: the OpenAI SDK is added in Milestone 2.
export const openaiGenerator: JokeGenerator = {
  async generate() {
    throw new AppError("SERVICE_UNAVAILABLE");
  },
};
