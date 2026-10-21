// Shared by client and server (ARCHITECTURE.md 2.5): trim, then NFC.
// A topic of whitespace only becomes an empty string.
export function normalizeTopic(topic: string): string {
  return topic.trim().normalize("NFC");
}

export const MAX_TOPIC_CODE_POINTS = 200;
