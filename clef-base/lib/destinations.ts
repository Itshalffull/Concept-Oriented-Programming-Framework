/**
 * Navigator destination registry for clef-base.
 * Each destination maps a name to a targetConcept + targetView,
 * which the Navigator concept tracks for history/guards.
 * The href is the Next.js route path (used by the NextjsAdapter
 * to sync Navigator state ↔ App Router).
 */

export interface Destination {
  name: string;
  targetConcept: string;
  targetView: string;
  href: string;
  icon: string;
  group: string;
}

export const destinations: Destination[] = [
  // Content group
  { name: 'dashboard', targetConcept: 'AppShell', targetView: 'dashboard', href: '/', icon: '◫', group: 'Content' },
  { name: 'content', targetConcept: 'ContentNode', targetView: 'list', href: '/content', icon: '📄', group: 'Content' },

  // Structure group
  { name: 'schemas', targetConcept: 'Schema', targetView: 'list', href: '/schemas', icon: '⬡', group: 'Structure' },
  { name: 'views', targetConcept: 'View', targetView: 'builder', href: '/view-builder', icon: '⊞', group: 'Structure' },
  { name: 'taxonomy', targetConcept: 'Taxonomy', targetView: 'browser', href: '/taxonomy', icon: '🌳', group: 'Structure' },

  // Surface group
  { name: 'mappings', targetConcept: 'ComponentMapping', targetView: 'list', href: '/mappings', icon: '⇋', group: 'Surface' },
  { name: 'display-modes', targetConcept: 'DisplayMode', targetView: 'list', href: '/display-modes', icon: '◩', group: 'Surface' },
  { name: 'themes', targetConcept: 'Theme', targetView: 'browser', href: '/themes', icon: '🎨', group: 'Surface' },

  // Platform group
  { name: 'concepts', targetConcept: 'ConceptBrowser', targetView: 'browser', href: '/concepts', icon: '⬢', group: 'Platform' },
  { name: 'syncs', targetConcept: 'SyncEngine', targetView: 'list', href: '/syncs', icon: '⇄', group: 'Platform' },
  { name: 'score', targetConcept: 'Score', targetView: 'dashboard', href: '/score', icon: '📊', group: 'Platform' },

  // System group
  { name: 'multiverse', targetConcept: 'VersionSpace', targetView: 'manager', href: '/multiverse', icon: '⎇', group: 'System' },
  { name: 'workflows', targetConcept: 'Workflow', targetView: 'list', href: '/workflows', icon: '⤷', group: 'System' },
  { name: 'automations', targetConcept: 'AutomationRule', targetView: 'list', href: '/automations', icon: '⚡', group: 'System' },
];

/** Look up a destination by its Next.js href path */
export function destinationByHref(href: string): Destination | undefined {
  return destinations.find(d => d.href === href);
}

/** Look up a destination by name */
export function destinationByName(name: string): Destination | undefined {
  return destinations.find(d => d.name === name);
}

/** Group destinations by their group label (for sidebar rendering) */
export function groupedDestinations(): { label: string; items: Destination[] }[] {
  const groups = new Map<string, Destination[]>();
  for (const d of destinations) {
    const existing = groups.get(d.group) ?? [];
    existing.push(d);
    groups.set(d.group, existing);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}
