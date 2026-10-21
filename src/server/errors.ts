import "server-only";
import type { ErrorCode } from "@/lib/contracts";

export const statusByCode: Record<ErrorCode, number> = {
  INVALID_REQUEST: 400,
  FORBIDDEN_ORIGIN: 403,
  METHOD_NOT_ALLOWED: 405,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  TOPIC_NOT_ALLOWED: 422,
  RATE_LIMITED: 429,
  GENERATION_FAILED: 502,
  SERVICE_UNAVAILABLE: 503,
  GENERATION_TIMEOUT: 504,
};

export class AppError extends Error {
  constructor(public readonly code: ErrorCode) {
    super(code);
    this.name = "AppError";
  }
}
