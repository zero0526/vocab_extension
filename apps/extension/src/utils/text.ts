/**
 * Normalizes an English word by trimming and lowercasing.
 */
export function normalizeWord(word: string): string {
  return word.trim().toLocaleLowerCase("en-US");
}

/**
 * Generate a unique ID (UUIDv4)
 */
export function generateUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
