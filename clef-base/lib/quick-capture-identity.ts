const FALLBACK_BASENAME = 'untitled';
const MAX_BASENAME_LENGTH = 48;

function slugifySegment(input: string): string {
  const normalized = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!normalized) return FALLBACK_BASENAME;
  return normalized.slice(0, MAX_BASENAME_LENGTH).replace(/-+$/g, '') || FALLBACK_BASENAME;
}

export function buildQuickCaptureNodeId(title: string, attempt = 0): string {
  const base = slugifySegment(title);
  if (attempt <= 0) {
    return `capture:${base}`;
  }
  return `capture:${base}-${attempt + 1}`;
}

export function getEntityDisplayName(
  nodeId: string,
  title: unknown,
): { title: string; rawIdentity: string; hasExplicitTitle: boolean } {
  const rawIdentity = String(nodeId).replace(
    /^(concept|schema|sync|suite|theme|view|widget|display-mode|workflow|automation-rule|taxonomy):/,
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
