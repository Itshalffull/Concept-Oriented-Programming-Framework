// ============================================================
// Layout Concept Implementation
//
// Spatial arrangement engine. Manages layout definitions (stack,
// grid, split, etc.), configures layout properties, supports
// nesting with cycle detection, and stores responsive breakpoint
// overrides.
// Relation: 'layout' keyed by layout (Y).
// ============================================================

import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'layout';

const VALID_KINDS = [
  'stack',
  'grid',
  'split',
  'overlay',
  'flow',
  'sidebar',
  'center',
];

/**
 * Walk the parent chain of a layout to detect cycles.
 * Returns true if adding childKey as a child of parentKey would create a cycle.
 */
async function wouldCycle(
  storage: { get(relation: string, key: string): Promise<Record<string, unknown> | null> },
  parentKey: string,
  childKey: string,
): Promise<boolean> {
  // A cycle occurs if walking up from parentKey eventually reaches childKey
  if (parentKey === childKey) {
    return true;
  }

  const visited = new Set<string>();
  let current: string | null = parentKey;

  while (current !== null) {
    if (visited.has(current)) {
      break; // already a cycle in existing data; stop
    }
    visited.add(current);

    const record = await storage.get(RELATION, current);
    if (!record) {
      break;
    }

    const parentRef = record.parent as string | null | undefined;
    if (!parentRef) {
      break;
    }

    if (parentRef === childKey) {
      return true;
    }

    current = parentRef;
  }

  return false;
}

export const layoutHandler: ConceptHandler = {
  /**
   * create(layout, name, kind) -> ok(layout) | invalid(message)
   *
   * Creates a new layout with the given name and kind. Validates
   * that the kind is one of the supported layout types.
   */
  async create(input, storage) {
    const layout = input.layout as string;
    const name = input.name as string;
    const kind = input.kind as string;

    if (!VALID_KINDS.includes(kind)) {
      return {
        variant: 'invalid',
        message: `Layout kind "${kind}" is not valid. Valid kinds: ${VALID_KINDS.join(', ')}`,
      };
    }

    await storage.put(RELATION, layout, {
      layout,
      name,
      kind,
      direction: kind === 'stack' ? 'vertical' : 'horizontal',
      gap: '0',
      columns: '',
      rows: '',
      areas: '',
      children: '[]',
      responsive: '{}',
      parent: null,
    });

    return { variant: 'ok', layout };
  },

  /**
   * configure(layout, config) -> ok(layout) | notfound(message)
   *
   * Updates layout properties via a read-modify-write with a JSON
   * config object. The config fields are merged into the existing record.
   */
  async configure(input, storage) {
    const layout = input.layout as string;
    const config = input.config as string;

    const record = await storage.get(RELATION, layout);
    if (!record) {
      return {
        variant: 'notfound',
        message: `Layout "${layout}" not found`,
      };
    }

    // Parse config JSON and merge fields
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(config) as Record<string, unknown>;
    } catch {
      parsed = {};
    }

    const updated: Record<string, unknown> = { ...record };

    // Only merge known layout fields
    const configurableFields = [
      'direction', 'gap', 'columns', 'rows', 'areas',
    ];
    for (const field of configurableFields) {
      if (field in parsed) {
        updated[field] = parsed[field];
      }
    }

    await storage.put(RELATION, layout, updated);

    return { variant: 'ok', layout };
  },

  /**
   * nest(parent, child) -> ok(parent) | cycle(message)
   *
   * Nests a child layout inside a parent layout. Checks that the
   * nesting would not create a cycle in the layout hierarchy.
   */
  async nest(input, storage) {
    const parent = input.parent as string;
    const child = input.child as string;

    const parentRecord = await storage.get(RELATION, parent);
    if (!parentRecord) {
      return {
        variant: 'cycle',
        message: `Parent layout "${parent}" not found`,
      };
    }

    const childRecord = await storage.get(RELATION, child);
    if (!childRecord) {
      return {
        variant: 'cycle',
        message: `Child layout "${child}" not found`,
      };
    }

    // Check for cycle: would nesting child under parent create a loop?
    const hasCycle = await wouldCycle(storage, parent, child);
    if (hasCycle) {
      return {
        variant: 'cycle',
        message: `Nesting "${child}" under "${parent}" would create a cycle`,
      };
    }

    // Add child to parent's children list
    let children: string[];
    try {
      children = JSON.parse(parentRecord.children as string) as string[];
    } catch {
      children = [];
    }

    if (!children.includes(child)) {
      children.push(child);
    }

    await storage.put(RELATION, parent, {
      ...parentRecord,
      children: JSON.stringify(children),
    });

    // Set the child's parent reference
    await storage.put(RELATION, child, {
      ...childRecord,
      parent,
    });

    return { variant: 'ok', parent };
  },

  /**
   * setResponsive(layout, breakpoints) -> ok(layout) | notfound(message)
   *
   * Stores responsive breakpoint overrides for a layout as a JSON string.
   */
  async setResponsive(input, storage) {
    const layout = input.layout as string;
    const breakpoints = input.breakpoints as string;

    const record = await storage.get(RELATION, layout);
    if (!record) {
      return {
        variant: 'notfound',
        message: `Layout "${layout}" not found`,
      };
    }

    await storage.put(RELATION, layout, {
      ...record,
      responsive: breakpoints,
    });

    return { variant: 'ok', layout };
  },

  /**
   * remove(layout) -> ok(layout) | notfound(message)
   *
   * Removes a layout from storage.
   */
  async remove(input, storage) {
    const layout = input.layout as string;

    const record = await storage.get(RELATION, layout);
    if (!record) {
      return {
        variant: 'notfound',
        message: `Layout "${layout}" not found`,
      };
    }

    await storage.del(RELATION, layout);

    return { variant: 'ok', layout };
  },
};
