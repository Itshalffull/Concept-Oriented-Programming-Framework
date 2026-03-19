// @migrated dsl-constructs 2026-03-18
// ============================================================
// WidgetEntity Handler
//
// Queryable representation of a parsed widget spec -- the Clef Surface
// counterpart to ConceptEntity. Links anatomy, state machines,
// props, slots, accessibility contracts, affordance declarations,
// and composition references as a traversable structure.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import type { WidgetManifest } from '../../runtime/types.js';
import {
  createProgram, get, find, put, del, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `widget-entity-${++idCounter}`;
}

/**
 * Build a WidgetManifest from parsed AST (pure helper).
 */
function buildManifest(name: string, ast: string): WidgetManifest {
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

  return manifest;
}

/**
 * Build affordances array from AST (pure helper).
 */
function buildAffordances(ast: string, manifest: WidgetManifest): unknown[] {
  try {
    const parsed = JSON.parse(ast);
    if (Array.isArray(parsed.affordances)) return parsed.affordances;
  } catch { /* use fallback */ }
  return manifest.affordance ? [manifest.affordance] : [];
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const name = input.name as string;
    const source = input.source as string;
    const ast = input.ast as string;

    let p = createProgram();
    p = find(p, 'widget-entity', { name }, 'existing');

    return branch(p,
      (bindings) => (bindings.existing as unknown[]).length > 0,
      (thenP) => completeFrom(thenP, 'alreadyRegistered', (bindings) => ({
        existing: (bindings.existing as Record<string, unknown>[])[0].id as string,
      })),
      (elseP) => {
        const id = nextId();
        const symbol = `clef/widget/${name}`;
        const manifest = buildManifest(name, ast);
        const affordances = buildAffordances(ast, manifest);

        elseP = put(elseP, 'widget-entity', id, {
          id,
          name,
          symbol,
          sourceFile: source,
          ast,
          manifest: JSON.stringify(manifest),
          purposeText: manifest.purpose,
          version: manifest.version || 0,
          category: manifest.category || '',
          anatomyParts: JSON.stringify(manifest.anatomy),
          states: JSON.stringify(manifest.states),
          props: JSON.stringify(manifest.props),
          slots: JSON.stringify(manifest.slots),
          composedWidgets: JSON.stringify(manifest.composedWidgets),
          affordances: JSON.stringify(affordances),
          accessibilityRole: manifest.accessibility.role,
          hasFocusTrap: manifest.accessibility.focus.trap ? 'true' : 'false',
          keyboardBindings: JSON.stringify(manifest.accessibility.keyboard),
        });

        return complete(elseP, 'ok', { entity: id });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;

    let p = createProgram();
    p = find(p, 'widget-entity', { name }, 'results');

    return branch(p,
      (bindings) => (bindings.results as unknown[]).length === 0,
      (thenP) => complete(thenP, 'notfound', {}),
      (elseP) => completeFrom(elseP, 'ok', (bindings) => ({
        entity: (bindings.results as Record<string, unknown>[])[0].id as string,
      })),
    ) as StorageProgram<Result>;
  },

  findByAffordance(input: Record<string, unknown>) {
    const interactor = input.interactor as string;

    let p = createProgram();
    p = find(p, 'widget-entity', {}, 'allWidgets');

    return completeFrom(p, 'ok', (bindings) => {
      const allWidgets = bindings.allWidgets as Record<string, unknown>[];
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
      return { widgets: JSON.stringify(matching) };
    }) as StorageProgram<Result>;
  },

  findComposing(input: Record<string, unknown>) {
    const widget = input.widget as string;

    let p = createProgram();
    p = get(p, 'widget-entity', widget, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = find(thenP, 'widget-entity', {}, 'allWidgets');
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const widgetName = record.name as string;
          const allWidgets = bindings.allWidgets as Record<string, unknown>[];
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
          return { parents: JSON.stringify(parents) };
        });
      },
      (elseP) => complete(elseP, 'ok', { parents: '[]' }),
    ) as StorageProgram<Result>;
  },

  findComposedBy(input: Record<string, unknown>) {
    const widget = input.widget as string;

    let p = createProgram();
    p = get(p, 'widget-entity', widget, 'record');

    return branch(p, 'record',
      (thenP) => completeFrom(thenP, 'ok', (bindings) => {
        const record = bindings.record as Record<string, unknown>;
        try {
          const composed = JSON.parse(record.composedWidgets as string || '[]');
          const children = composed.map((c: Record<string, unknown> | string) =>
            typeof c === 'string' ? { name: c } : c,
          );
          return { children: JSON.stringify(children) };
        } catch {
          return { children: '[]' };
        }
      }),
      (elseP) => complete(elseP, 'ok', { children: '[]' }),
    ) as StorageProgram<Result>;
  },

  generatedComponents(input: Record<string, unknown>) {
    const widget = input.widget as string;

    let p = createProgram();
    p = get(p, 'widget-entity', widget, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = find(thenP, 'provenance', {}, 'allProvenance');
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const symbol = record.symbol as string;
          const allProvenance = bindings.allProvenance as Record<string, unknown>[];
          const matching = allProvenance.filter(p => p.sourceSymbol === symbol);
          return { components: JSON.stringify(matching) };
        });
      },
      (elseP) => complete(elseP, 'ok', { components: '[]' }),
    ) as StorageProgram<Result>;
  },

  accessibilityAudit(input: Record<string, unknown>) {
    const widget = input.widget as string;

    let p = createProgram();
    p = get(p, 'widget-entity', widget, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = find(thenP, 'anatomy-part-entity', {}, 'parts');
        return completeFrom(thenP, 'ok', (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const missing: string[] = [];

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

          const parts = (bindings.parts as Record<string, unknown>[]).filter(
            (pt) => pt.widget === record.name,
          );
          const partsWithAria = parts.filter((pt) => {
            try {
              const aria = JSON.parse(pt.ariaAttrs as string || '[]');
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
            report: JSON.stringify({
              role: record.accessibilityRole,
              hasFocusTrap: record.hasFocusTrap === 'true',
              keyboardBindings: JSON.parse(record.keyboardBindings as string || '[]'),
              partsWithAria: partsWithAria.length,
              totalParts: parts.length,
            }),
          };
        });
      },
      (elseP) => complete(elseP, 'ok', { report: '{}' }),
    ) as StorageProgram<Result>;
  },

  traceToConcept(input: Record<string, unknown>) {
    const widget = input.widget as string;

    let p = createProgram();
    p = get(p, 'widget-entity', widget, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = find(thenP, 'binding', {}, 'bindings');
        return completeFrom(thenP, 'ok', (bnd) => {
          const record = bnd.record as Record<string, unknown>;
          const allBindings = (bnd.bindings as Record<string, unknown>[]).filter(
            (b) => b.widgetSymbol === record.symbol,
          );

          if (allBindings.length === 0) {
            try {
              const affordances = JSON.parse(record.affordances as string || '[]');
              if (affordances.length === 0) {
                return { variant: 'noConceptBinding' };
              }
              const concepts = affordances.map((a: Record<string, unknown> | string) => ({
                concept: typeof a === 'object' ? a.concept || 'unknown' : 'unknown',
                via: 'affordance',
              }));
              return { concepts: JSON.stringify(concepts) };
            } catch {
              return { variant: 'noConceptBinding' };
            }
          }

          const concepts = allBindings.map((b) => ({
            concept: b.concept || b.conceptName,
            via: b.bindingType || 'direct',
          }));
          return { concepts: JSON.stringify(concepts) };
        });
      },
      (elseP) => complete(elseP, 'noConceptBinding', {}),
    ) as StorageProgram<Result>;
  },
};

export const widgetEntityHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetWidgetEntityCounter(): void {
  idCounter = 0;
}
