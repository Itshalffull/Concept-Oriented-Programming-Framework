// ============================================================
// WidgetEntity Handler
//
// Queryable representation of a parsed widget spec -- the Clef Surface
// counterpart to ConceptEntity. Links anatomy, state machines,
// props, slots, accessibility contracts, affordance declarations,
// and composition references as a traversable structure.
// ============================================================

import type { ConceptHandler, ConceptStorage, WidgetManifest } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `widget-entity-${++idCounter}`;
}

export const widgetEntityHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const source = input.source as string;
    const ast = input.ast as string;

    // Check for duplicate by name
    const existing = await storage.find('widget-entity', { name });
    if (existing.length > 0) {
      return { variant: 'alreadyRegistered', existing: existing[0].id as string };
    }

    const id = nextId();
    const symbol = `clef/widget/${name}`;

    // Build typed WidgetManifest from parsed AST
    const manifest: WidgetManifest = {
      name,
      purpose: '',
      anatomy: [],
      states: [],
      props: [],
      slots: [],
      accessibility: { role: '', keyboard: [], focus: {} },
      composedWidgets: [],
    };

    try {
      const parsed = JSON.parse(ast);
      manifest.purpose = parsed.purpose || '';
      manifest.version = parsed.version || undefined;
      manifest.category = parsed.category || undefined;
      manifest.anatomy = parsed.anatomy || [];
      manifest.states = parsed.states || [];
      manifest.props = parsed.props || [];
      manifest.slots = parsed.slots || [];
      manifest.composedWidgets = parsed.compose || parsed.composedWidgets || [];
      if (parsed.affordances?.[0] || parsed.affordance) {
        const aff = parsed.affordance || parsed.affordances?.[0];
        manifest.affordance = {
          serves: aff?.serves || aff?.interactor || '',
          specificity: aff?.specificity,
          when: aff?.when,
          binds: aff?.binds || aff?.bind || [],
        };
      }
      manifest.accessibility = {
        role: parsed.accessibility?.role || '',
        keyboard: parsed.accessibility?.keyboard || parsed.keyboardBindings || [],
        focus: {
          trap: parsed.accessibility?.focusTrap,
          initial: parsed.accessibility?.focus?.initial,
          roving: parsed.accessibility?.focus?.roving,
        },
        ariaAttrs: parsed.accessibility?.ariaAttrs,
      };
    } catch {
      // AST may be empty or non-JSON; store defaults
    }

    await storage.put('widget-entity', id, {
      id,
      name,
      symbol,
      sourceFile: source,
      ast,
      manifest: JSON.stringify(manifest),
      // Keep legacy fields for backward compatibility with existing queries
      purposeText: manifest.purpose,
      version: manifest.version || 0,
      category: manifest.category || '',
      anatomyParts: JSON.stringify(manifest.anatomy),
      states: JSON.stringify(manifest.states),
      props: JSON.stringify(manifest.props),
      slots: JSON.stringify(manifest.slots),
      composedWidgets: JSON.stringify(manifest.composedWidgets),
      affordances: JSON.stringify(
        (() => {
          try {
            const parsed = JSON.parse(ast);
            if (Array.isArray(parsed.affordances)) return parsed.affordances;
          } catch { /* use fallback */ }
          return manifest.affordance ? [manifest.affordance] : [];
        })(),
      ),
      accessibilityRole: manifest.accessibility.role,
      hasFocusTrap: manifest.accessibility.focus.trap ? 'true' : 'false',
      keyboardBindings: JSON.stringify(manifest.accessibility.keyboard),
    });

    return { variant: 'ok', entity: id };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;

    const results = await storage.find('widget-entity', { name });
    if (results.length === 0) {
      return { variant: 'notfound' };
    }

    return { variant: 'ok', entity: results[0].id as string };
  },

  async findByAffordance(input: Record<string, unknown>, storage: ConceptStorage) {
    const interactor = input.interactor as string;

    const allWidgets = await storage.find('widget-entity');
    const matching = allWidgets.filter((w) => {
      try {
        const affordances = JSON.parse(w.affordances as string || '[]');
        return affordances.some(
          (a: Record<string, unknown> | string) =>
            (typeof a === 'string' && a === interactor) ||
            (typeof a === 'object' && a.interactor === interactor),
        );
      } catch {
        return false;
      }
    });

    return { variant: 'ok', widgets: JSON.stringify(matching) };
  },

  async findComposing(input: Record<string, unknown>, storage: ConceptStorage) {
    const widget = input.widget as string;

    const record = await storage.get('widget-entity', widget);
    if (!record) {
      return { variant: 'ok', parents: '[]' };
    }

    const widgetName = record.name as string;

    // Find all widgets whose composedWidgets list includes this widget
    const allWidgets = await storage.find('widget-entity');
    const parents = allWidgets.filter((w) => {
      if (w.id === widget) return false;
      try {
        const composed = JSON.parse(w.composedWidgets as string || '[]');
        return composed.some(
          (c: Record<string, unknown> | string) =>
            (typeof c === 'string' && c === widgetName) ||
            (typeof c === 'object' && c.name === widgetName),
        );
      } catch {
        return false;
      }
    });

    return { variant: 'ok', parents: JSON.stringify(parents) };
  },

  async findComposedBy(input: Record<string, unknown>, storage: ConceptStorage) {
    const widget = input.widget as string;

    const record = await storage.get('widget-entity', widget);
    if (!record) {
      return { variant: 'ok', children: '[]' };
    }

    // Parse composedWidgets and look them up
    try {
      const composed = JSON.parse(record.composedWidgets as string || '[]');
      const childNames = composed.map((c: Record<string, unknown> | string) =>
        typeof c === 'string' ? c : (c.name as string),
      );

      const children: Record<string, unknown>[] = [];
      for (const childName of childNames) {
        const found = await storage.find('widget-entity', { name: childName });
        if (found.length > 0) children.push(found[0]);
      }

      return { variant: 'ok', children: JSON.stringify(children) };
    } catch {
      return { variant: 'ok', children: '[]' };
    }
  },

  async generatedComponents(input: Record<string, unknown>, storage: ConceptStorage) {
    const widget = input.widget as string;

    const record = await storage.get('widget-entity', widget);
    if (!record) {
      return { variant: 'ok', components: '[]' };
    }

    // Look up provenance records for this widget's generated components
    const generated = await storage.find('provenance', { sourceSymbol: record.symbol });
    const components = generated.map((g) => ({
      framework: g.framework || g.language || 'react',
      file: g.targetFile || g.file,
    }));

    return { variant: 'ok', components: JSON.stringify(components) };
  },

  async accessibilityAudit(input: Record<string, unknown>, storage: ConceptStorage) {
    const widget = input.widget as string;

    const record = await storage.get('widget-entity', widget);
    if (!record) {
      return { variant: 'ok', report: '{}' };
    }

    const missing: string[] = [];

    // Check required accessibility properties
    if (!record.accessibilityRole || record.accessibilityRole === '') {
      missing.push('role');
    }

    try {
      const keyboard = JSON.parse(record.keyboardBindings as string || '[]');
      if (!Array.isArray(keyboard) || keyboard.length === 0) {
        missing.push('keyboard-bindings');
      }
    } catch {
      missing.push('keyboard-bindings');
    }

    // Check anatomy parts for ARIA attributes
    const parts = await storage.find('anatomy-part-entity', { widget: record.name });
    const partsWithAria = parts.filter((p) => {
      try {
        const aria = JSON.parse(p.ariaAttrs as string || '[]');
        return Array.isArray(aria) && aria.length > 0;
      } catch {
        return false;
      }
    });
    if (parts.length > 0 && partsWithAria.length === 0) {
      missing.push('aria-attributes');
    }

    if (missing.length > 0) {
      return { variant: 'incomplete', missing: JSON.stringify(missing) };
    }

    return {
      variant: 'ok',
      report: JSON.stringify({
        role: record.accessibilityRole,
        hasFocusTrap: record.hasFocusTrap === 'true',
        keyboardBindings: JSON.parse(record.keyboardBindings as string || '[]'),
        partsWithAria: partsWithAria.length,
        totalParts: parts.length,
      }),
    };
  },

  async traceToConcept(input: Record<string, unknown>, storage: ConceptStorage) {
    const widget = input.widget as string;

    const record = await storage.get('widget-entity', widget);
    if (!record) {
      return { variant: 'noConceptBinding' };
    }

    // Look up bindings from this widget to concepts
    const bindings = await storage.find('binding', { widgetSymbol: record.symbol });
    if (bindings.length === 0) {
      // Also check via affordance matching
      try {
        const affordances = JSON.parse(record.affordances as string || '[]');
        if (affordances.length === 0) {
          return { variant: 'noConceptBinding' };
        }

        const concepts = affordances.map((a: Record<string, unknown> | string) => ({
          concept: typeof a === 'object' ? a.concept || 'unknown' : 'unknown',
          via: 'affordance',
        }));

        return { variant: 'ok', concepts: JSON.stringify(concepts) };
      } catch {
        return { variant: 'noConceptBinding' };
      }
    }

    const concepts = bindings.map((b) => ({
      concept: b.concept || b.conceptName,
      via: b.bindingType || 'direct',
    }));

    return { variant: 'ok', concepts: JSON.stringify(concepts) };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetWidgetEntityCounter(): void {
  idCounter = 0;
}
