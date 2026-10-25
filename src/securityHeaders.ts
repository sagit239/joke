// Security headers for every route (ARCHITECTURE.md 2.8, ADR-10).
// Kept free of Next.js and server-only imports so next.config.ts and tests can use it.

export type Header = { key: string; value: string };

export function contentSecurityPolicy(isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    // Next.js injects small inline scripts; dev mode (React Refresh) also needs eval.
    `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    // Fonts are self-hosted by next/font (ADR-7).
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  return directives.join("; ");
}

export function securityHeaders(isDev: boolean): Header[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(isDev) },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  ];
}
