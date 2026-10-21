// Shared request/response shapes for POST /api/joke (ARCHITECTURE.md 2.5).
// Must not import server code or secrets.

export type JokeRequest = {
  topic?: string;
};

export type JokeSuccess = {
  joke: string;
};

export type ErrorCode =
  | "TOPIC_NOT_ALLOWED"
  | "INVALID_REQUEST"
  | "FORBIDDEN_ORIGIN"
  | "METHOD_NOT_ALLOWED"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "RATE_LIMITED"
  | "GENERATION_FAILED"
  | "SERVICE_UNAVAILABLE"
  | "GENERATION_TIMEOUT";

export type ErrorResponse = {
  error: { code: ErrorCode };
};
