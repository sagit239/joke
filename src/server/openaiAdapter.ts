import "server-only";
import OpenAI, { APIError } from "openai";
import { getConfig } from "./config";
import {
  JOKE_INSTRUCTIONS,
  JOKE_SCHEMA,
  parseGeneration,
  topicInput,
  type GenerationResult,
} from "./contentPolicy";
import { AppError } from "./errors";

export type { GenerationResult };

export type TokenUsage = { inputTokens: number; outputTokens: number };

export interface AiProvider {
  generate(
    topic: string,
    signal: AbortSignal,
  ): Promise<{ result: GenerationResult; usage?: TokenUsage }>;
  isFlagged(text: string, signal: AbortSignal): Promise<boolean>;
}

// Minimal surface of the SDK client that the adapter uses (lets tests inject a fake).
export type OpenAIClient = Pick<OpenAI, "responses" | "moderations">;

// Basic provider error mapping (full coverage is Milestone 3).
function mapProviderError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  if (error instanceof APIError) {
    // 401 bad key; 429 insufficient_quota when the OpenAI balance is used up.
    if (error.status === 401 || (error.status === 429 && error.code === "insufficient_quota")) {
      return new AppError("SERVICE_UNAVAILABLE");
    }
  }
  return new AppError("GENERATION_FAILED");
}

export function createProvider(client: OpenAIClient, model: string): AiProvider {
  return {
    async generate(topic, signal) {
      try {
        const response = await client.responses.create(
          {
            model,
            instructions: JOKE_INSTRUCTIONS,
            input: topicInput(topic),
            store: false,
            reasoning: { effort: "none" },
            max_output_tokens: 1024,
            text: {
              format: { type: "json_schema", name: "joke", strict: true, schema: JOKE_SCHEMA },
            },
          },
          { signal },
        );
        const usage = response.usage
          ? { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
          : undefined;

        const refused = response.output.some(
          (item) =>
            item.type === "message" && item.content.some((part) => part.type === "refusal"),
        );
        if (refused) return { result: { status: "rejected" }, usage };

        if (response.status !== "completed") throw new AppError("GENERATION_FAILED");
        const result = parseGeneration(response.output_text);
        if (!result) throw new AppError("GENERATION_FAILED");
        return { result, usage };
      } catch (error) {
        throw mapProviderError(error);
      }
    },

    async isFlagged(text, signal) {
      try {
        const moderation = await client.moderations.create(
          { model: "omni-moderation-latest", input: text },
          { signal },
        );
        const flagged = moderation.results?.[0]?.flagged;
        if (typeof flagged !== "boolean") throw new AppError("GENERATION_FAILED");
        return flagged;
      } catch (error) {
        throw mapProviderError(error);
      }
    },
  };
}

// Production provider: built per request from server-only configuration.
export function getOpenAIProvider(): AiProvider {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY?.trim(),
    maxRetries: 0,
    timeout: 25_000,
  });
  return createProvider(client, getConfig().openaiModel);
}
