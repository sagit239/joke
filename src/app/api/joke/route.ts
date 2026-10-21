import type { ErrorCode, ErrorResponse, JokeSuccess } from "@/lib/contracts";
import { AppError, statusByCode } from "@/server/errors";
import { createJoke } from "@/server/jokeService";

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

// Milestone 2 replaces this with full validation (Origin, size, media type,
// NFC normalization). For now it only extracts a string topic.
async function readTopic(request: Request): Promise<string> {
  try {
    const body: unknown = await request.json();
    if (typeof body === "object" && body !== null && "topic" in body) {
      const topic = (body as { topic: unknown }).topic;
      return typeof topic === "string" ? topic.trim() : "";
    }
  } catch {
    // Ignored in Milestone 1: an unreadable body is treated as an empty topic.
  }
  return "";
}

export async function POST(request: Request) {
  try {
    const topic = await readTopic(request);
    const joke = await createJoke(topic);
    const body: JokeSuccess = { joke };
    return Response.json(body, { status: 200, headers: baseHeaders });
  } catch (error) {
    if (error instanceof AppError) {
      return errorResponse(error.code);
    }
    console.error("joke_request_failed", { name: (error as Error)?.name });
    return errorResponse("GENERATION_FAILED");
  }
}

function methodNotAllowed() {
  return errorResponse("METHOD_NOT_ALLOWED", { Allow: "POST" });
}

export const GET = methodNotAllowed;
export const PUT = methodNotAllowed;
export const PATCH = methodNotAllowed;
export const DELETE = methodNotAllowed;
