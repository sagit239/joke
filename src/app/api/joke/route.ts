import type { ErrorCode, ErrorResponse, JokeSuccess } from "@/lib/contracts";
import { AppError, statusByCode } from "@/server/errors";
import { createJoke } from "@/server/jokeService";
import { logRequest } from "@/server/log";
import { validateJokeRequest } from "@/server/validation";

export const runtime = "nodejs";
export const maxDuration = 30;

const baseHeaders = { "Cache-Control": "no-store" };

function errorResponse(code: ErrorCode, extraHeaders: Record<string, string> = {}) {
  const body: ErrorResponse = { error: { code } };
  return Response.json(body, {
    status: statusByCode[code],
    headers: { ...baseHeaders, ...extraHeaders },
  });
}

export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const startedAt = Date.now();
  try {
    const topic = await validateJokeRequest(request);
    const { joke, usage } = await createJoke(topic);
    const body: JokeSuccess = { joke };
    logRequest({ requestId, statusCode: 200, durationMs: Date.now() - startedAt, usage });
    return Response.json(body, { status: 200, headers: baseHeaders });
  } catch (error) {
    const code: ErrorCode = error instanceof AppError ? error.code : "GENERATION_FAILED";
    logRequest({
      requestId,
      statusCode: statusByCode[code],
      errorCode: code,
      durationMs: Date.now() - startedAt,
    });
    return errorResponse(code);
  }
}

function methodNotAllowed() {
  return errorResponse("METHOD_NOT_ALLOWED", { Allow: "POST" });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
