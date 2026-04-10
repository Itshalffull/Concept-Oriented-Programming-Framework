// Qualified reference URI parser for namespace and qualifier support.
// Parses the format: [namespace://]entity-id[@qualifier]
// Extraction only — resolution is sync-driven.

export interface QualifiedRef {
  target: string;
  namespace?: string;
  qualifier?: string;
  qualifierKind?: QualifierKind;
}

export type QualifierKind =
  | 'version'
  | 'temporal-date'
  | 'temporal-datetime'
  | 'hash'
  | 'keyword';

/**
 * Classify a qualifier string into its semantic kind.
 *
 * - `sha256:...` → hash
 * - `2026-04-01T...` → temporal-datetime
 * - `2026-04-01` → temporal-date
 * - `latest`, `previous` → keyword
 * - everything else (v3, v12, draft-1, etc.) → version
 */
export function classifyQualifier(q: string): QualifierKind {
  if (q.startsWith('sha256:')) return 'hash';
  if (/^\d{4}-\d{2}-\d{2}T/.test(q)) return 'temporal-datetime';
  if (/^\d{4}-\d{2}-\d{2}$/.test(q)) return 'temporal-date';
  if (q === 'latest' || q === 'previous') return 'keyword';
  return 'version';
}

/**
 * Parse a qualified reference URI string into its constituent parts.
 *
 * Format: `[namespace://]entity-id[@qualifier]`
 *
 * Examples:
 *   `article-1`                    → { target: "article-1" }
 *   `draft-v2://article-1`        → { target: "article-1", namespace: "draft-v2" }
 *   `article-1@v3`                → { target: "article-1", qualifier: "v3", qualifierKind: "version" }
 *   `draft-v2://article-1@v3`     → all three parts
 *   `article-1@2026-04-01`        → temporal-date qualifier
 *   `article-1@sha256:abc123`     → hash qualifier
 *   `article-1@latest`            → keyword qualifier
 *
 * The input may optionally be wrapped in `[[...]]` wikilink brackets,
 * which are stripped before parsing.
 */
export function parseQualifiedRef(ref: string): QualifiedRef {
  // Strip wikilink brackets if present
  let raw = ref.trim();
  if (raw.startsWith('[[') && raw.endsWith(']]')) {
    raw = raw.slice(2, -2);
  }

  if (raw === '') {
    return { target: '' };
  }

  let namespace: string | undefined;
  let remainder = raw;

  // Extract namespace: look for `://` — the namespace is everything before the first `://`
  const nsDelimiter = remainder.indexOf('://');
  if (nsDelimiter !== -1) {
    namespace = remainder.slice(0, nsDelimiter);
    remainder = remainder.slice(nsDelimiter + 3);
  }

  // Extract qualifier: look for the last `@` in the remainder.
  // We use the last `@` so that entity IDs containing `@` (unlikely but defensive)
  // still work, and because qualifiers never contain `@`.
  let qualifier: string | undefined;
  let qualifierKind: QualifierKind | undefined;
  const atIndex = remainder.lastIndexOf('@');
  if (atIndex !== -1 && atIndex < remainder.length - 1) {
    qualifier = remainder.slice(atIndex + 1);
    remainder = remainder.slice(0, atIndex);
    qualifierKind = classifyQualifier(qualifier);
  }

  const result: QualifiedRef = { target: remainder };
  if (namespace !== undefined) result.namespace = namespace;
  if (qualifier !== undefined) {
    result.qualifier = qualifier;
    result.qualifierKind = qualifierKind;
  }
  return result;
}
