import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "@/securityHeaders";

function headerMap(isDev: boolean) {
  return Object.fromEntries(securityHeaders(isDev).map((h) => [h.key, h.value]));
}

describe("security headers", () => {
  it("includes all required headers", () => {
    const headers = headerMap(false);
    expect(headers["Content-Security-Policy"]).toBeTruthy();
    expect(headers["X-Frame-Options"]).toBe("DENY");
    expect(headers["X-Content-Type-Options"]).toBe("nosniff");
    expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
  });

  it("CSP blocks framing, plugins and external connections", () => {
    const csp = contentSecurityPolicy(false);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("default-src 'self'");
  });

  it("CSP allows no external origins", () => {
    expect(contentSecurityPolicy(false)).not.toMatch(/https?:/);
    expect(contentSecurityPolicy(true)).not.toMatch(/https?:/);
  });

  it("allows eval only in development", () => {
    expect(contentSecurityPolicy(false)).not.toContain("'unsafe-eval'");
    expect(contentSecurityPolicy(true)).toContain("'unsafe-eval'");
  });
});
