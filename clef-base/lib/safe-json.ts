/**
 * Safe JSON parsing helpers.
 *
 * Kernel responses and seeded string fields sometimes arrive as empty strings
 * ("") when the underlying field is genuinely empty or not yet populated.
 * Calling JSON.parse("") throws "unexpected end of data" and crashes the UI.
 *
 * Use these helpers at every kernel-response parse site. They trim, check
 * empty, try/catch, and return a fallback.
 */

/** Parse a JSON string, returning fallback on empty-or-invalid input. */
export function safeParseJson<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (Array.isArray(raw) || (typeof raw === 'object' && raw !== null)) {
    return raw as unknown as T;
  }
  if (typeof raw !== 'string') return fallback;
  const s = raw.trim();
  if (s === '') return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
}

/** Parse a JSON array, returning [] on empty-or-invalid input. */
export function safeParseJsonArray<T>(raw: unknown): T[] {
  return safeParseJson<T[]>(raw, []);
}

/** Parse a JSON object, returning {} on empty-or-invalid input. */
export function safeParseJsonObject<T extends Record<string, unknown>>(raw: unknown): T {
  return safeParseJson<T>(raw, {} as T);
}
