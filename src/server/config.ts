import "server-only";

// Reads server configuration from the environment on every call, so tests and
// redeploys pick up changes. The API key value never leaves the server modules.
export function getConfig() {
  return {
    generationEnabled: process.env.GENERATION_ENABLED === "true",
    // Accepts a gateway-style id ("openai/gpt-6-luna") as the plain OpenAI id.
    openaiModel: (process.env.OPENAI_MODEL?.trim() ?? "").replace(/^openai\//, ""),
    hasApiKey: (process.env.OPENAI_API_KEY?.trim() ?? "") !== "",
  };
}
