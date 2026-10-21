import "server-only";
import type { ErrorCode } from "@/lib/contracts";
import type { TokenUsage } from "./openaiAdapter";

export type OperationalEvent = {
  requestId: string;
  statusCode: number;
  errorCode?: ErrorCode;
  durationMs: number;
  usage?: TokenUsage;
};

// One log line per request. Never pass topic, joke, body, headers or raw SDK errors.
export function logRequest(event: OperationalEvent) {
  console.info("joke_request", event);
}
