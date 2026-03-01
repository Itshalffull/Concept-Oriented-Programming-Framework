// Layout Concept Implementation
// Structural containers that organize child components with directional flow, grid, and responsive rules.
import type { ConceptHandler } from '@clef/runtime';

const VALID_KINDS = ['stack', 'grid', 'split', 'overlay', 'flow', 'sidebar', 'center'];

let layoutCounter = 0;

export const layoutHandler: ConceptHandler = {
  async create(input, storage) {
    const layout = input.layout as string;
    const name = input.name as string;
    const kind = input.kind as string;

    if (!VALID_KINDS.includes(kind)) {
      return {
        variant: 'invalid',
        message: `Invalid layout kind "${kind}". Must be one of: ${VALID_KINDS.join(', ')}`,
      };
    }

    const existing = await storage.get('layout', layout);
    if (existing) {
      return { variant: 'invalid', message: 'A layout with this identity already exists' };
    }

    layoutCounter++;

    await storage.put('layout', layout, {
      layout,
      name: name || `layout-${layoutCounter}`,
      kind,
      direction: kind === 'stack' ? 'vertical' : '',
      gap: '0',
      columns: kind === 'grid' ? '12' : '',
      rows: '',
      areas: JSON.stringify([]),
      children: JSON.stringify([]),
      responsive: JSON.stringify({}),
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async configure(input, storage) {
    const layout = input.layout as string;
    const config = input.config as string;

    const existing = await storage.get('layout', layout);
    if (!existing) {
      return { variant: 'notfound', message: 'Layout not found' };
    }

    const parsedConfig = JSON.parse(config || '{}');

    await storage.put('layout', layout, {
      ...existing,
      direction: parsedConfig.direction ?? existing.direction,
      gap: parsedConfig.gap ?? existing.gap,
      columns: parsedConfig.columns ?? existing.columns,
      rows: parsedConfig.rows ?? existing.rows,
      areas: parsedConfig.areas ? JSON.stringify(parsedConfig.areas) : existing.areas,
    });

    return { variant: 'ok' };
  },

  async nest(input, storage) {
    const parent = input.parent as string;
    const child = input.child as string;

    const parentLayout = await storage.get('layout', parent);
    if (!parentLayout) {
      return { variant: 'cycle', message: 'Parent layout not found' };
    }

    // Detect cycles: walk up the parent chain to ensure child is not an ancestor
    const visited = new Set<string>();
    visited.add(child);

    let current = parent;
    while (current) {
      if (visited.has(current)) {
        return { variant: 'cycle', message: `Nesting "${child}" under "${parent}" would create a cycle` };
      }
      visited.add(current);

      // Check if current layout is a child of another layout
      const results = await storage.find('layout', current);
      const layouts = Array.isArray(results) ? results : [];
      let foundParent = '';
      for (const l of layouts) {
        const children: string[] = JSON.parse((l.children as string) || '[]');
        if (children.includes(current) && (l.layout as string) !== current) {
          foundParent = l.layout as string;
          break;
        }
      }
      current = foundParent;
    }

    const children: string[] = JSON.parse((parentLayout.children as string) || '[]');

    if (!children.includes(child)) {
      children.push(child);
    }

    await storage.put('layout', parent, {
      ...parentLayout,
      children: JSON.stringify(children),
    });

    return { variant: 'ok' };
  },

  async setResponsive(input, storage) {
    const layout = input.layout as string;
    const breakpoints = input.breakpoints as string;

    const existing = await storage.get('layout', layout);
    if (!existing) {
      return { variant: 'notfound', message: 'Layout not found' };
    }

    const parsedBreakpoints = JSON.parse(breakpoints || '{}');

    await storage.put('layout', layout, {
      ...existing,
      responsive: JSON.stringify(parsedBreakpoints),
    });

    return { variant: 'ok' };
  },

  async remove(input, storage) {
    const layout = input.layout as string;

    const existing = await storage.get('layout', layout);
    if (!existing) {
      return { variant: 'notfound', message: 'Layout not found' };
    }

    await storage.put('layout', layout, {
      __deleted: true,
    });

    return { variant: 'ok' };
  },
};
