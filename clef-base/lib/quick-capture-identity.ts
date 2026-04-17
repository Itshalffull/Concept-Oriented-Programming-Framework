import { slugifyWith } from './slug';

const FALLBACK_BASENAME = 'untitled';

function slugifySegment(input: string): string {
  // Quick-capture node IDs cap at 48 chars (shorter than the framework default
  // of 64) so the prefix + slug stays compact in URLs and lists.
  const slug = slugifyWith(input, { maxLength: 48 });
  return slug || FALLBACK_BASENAME;
}

export function buildQuickCaptureNodeId(title: string, attempt = 0): string {
  const base = slugifySegment(title);
  if (attempt <= 0) {
    return `capture:${base}`;
  }
  return `capture:${base}-${attempt + 1}`;
}

/**
 * resolveEntityTitle — formatter for use in list/card/detail views.
 *
 * Returns the human-readable label for a content entity: prefers the stored
 * title, then falls back to the node ID with its type prefix stripped.
 * This is the single source of truth for title resolution — use it in any
 * view projection that needs a display label instead of re-implementing the
 * fallback logic inline.
 *
 * @param nodeId  The entity's node ID (e.g. "agent-persona:my-agent-z1jcmh")
 * @param title   The entity's stored title field (may be empty/undefined)
 * @returns       Human-readable display label
 */
export function resolveEntityTitle(nodeId: string, title: unknown): string {
  const explicit = typeof title === 'string' ? title.trim() : '';
  if (explicit) return explicit;
  return String(nodeId).replace(
    /^(concept|schema|sync|suite|theme|view|widget|display-mode|workflow|automation-rule|taxonomy|agent-persona):/,
    '',
  );
}

export function getEntityDisplayName(
  nodeId: string,
  title: unknown,
): { title: string; rawIdentity: string; hasExplicitTitle: boolean } {
  const rawIdentity = String(nodeId).replace(
    /^(concept|schema|sync|suite|theme|view|widget|display-mode|workflow|automation-rule|taxonomy|agent-persona):/,
    '',
  );
  const explicitTitle = typeof title === 'string' ? title.trim() : '';

  if (explicitTitle) {
    return {
      title: explicitTitle,
      rawIdentity,
      hasExplicitTitle: explicitTitle !== rawIdentity,
    };
  }

  return {
    title: rawIdentity,
    rawIdentity,
    hasExplicitTitle: false,
  };
}
