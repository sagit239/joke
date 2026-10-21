import "server-only";
import { MAX_TOPIC_CODE_POINTS, normalizeTopic } from "@/lib/normalizeTopic";
import { AppError } from "./errors";

const MAX_BODY_BYTES = 4096;

function hostOf(url: string): string | null {
  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

// Same-origin check (ADR-4): the Origin host must equal the request's Host,
// and Sec-Fetch-Site, when present, must be "same-origin".
function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host") ?? hostOf(request.url);
  const originHost = origin ? hostOf(origin) : null;
  if (!originHost || !host || originHost !== host) {
    throw new AppError("FORBIDDEN_ORIGIN");
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite !== null && fetchSite !== "same-origin") {
    throw new AppError("FORBIDDEN_ORIGIN");
  }
}

function checkContentType(request: Request) {
  const mediaType = (request.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  if (mediaType !== "application/json") {
    throw new AppError("UNSUPPORTED_MEDIA_TYPE");
  }
}

async function readLimitedBody(request: Request): Promise<string> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE");
  }
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    throw new AppError("PAYLOAD_TOO_LARGE");
  }
  return text;
}

function extractTopic(text: string): string {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new AppError("INVALID_REQUEST");
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw new AppError("INVALID_REQUEST");
  }
  const topic = (body as { topic?: unknown }).topic;
  if (topic === undefined) return "";
  if (typeof topic !== "string") {
    throw new AppError("INVALID_REQUEST");
  }
  const normalized = normalizeTopic(topic);
  if ([...normalized].length > MAX_TOPIC_CODE_POINTS) {
    throw new AppError("INVALID_REQUEST");
  }
  return normalized;
}

// Entry controls for POST /api/joke (ARCHITECTURE.md 2.5, 2.8).
// Returns the normalized topic ("" means a general joke) or throws AppError.
export async function validateJokeRequest(request: Request): Promise<string> {
  checkOrigin(request);
  checkContentType(request);
  const text = await readLimitedBody(request);
  return extractTopic(text);
}
