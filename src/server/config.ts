import "server-only";

// Reads server configuration from the environment on every call, so tests and
// redeploys pick up changes. The API key value never leaves this module.
export function getConfig() {
  return {
    generationEnabled: process.env.GENERATION_ENABLED === "true",
    openaiModel: process.env.OPENAI_MODEL?.trim() ?? "",
    hasApiKey: (process.env.OPENAI_API_KEY?.trim() ?? "") !== "",
  };
}
