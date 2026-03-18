// ============================================================
// WidgetEntity Concept Implementation (Functional)
//
// Queryable representation of a parsed widget spec — anatomy,
// state machines, props, slots, accessibility, affordances,
// and composition. Independent concept — concept bindings
// and generated components populated by syncs.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.js';
import {
  createProgram, get, find, put, branch, complete, pureFrom, mapBindings,
} from '../../../runtime/storage-program.js';

export const widgetEntityHandler: FunctionalConceptHandler = {

  register(input) {
    const name = input.name as string;
    const source = input.source as string;
    const ast = input.ast as string;
    const id = crypto.randomUUID();
    const key = `widget:${name}`;
    const parsed = ast ? JSON.parse(ast) : {};

    let p = createProgram();
    p = get(p, 'widget', key, 'existing');

    return branch(p,
      (b) => b.existing != null,
      complete(createProgram(), 'alreadyRegistered', { existing: key }),
      complete(
        put(createProgram(), 'widget', key, {
          id, name,
          symbol: `clef/widget/${name}`,
          sourceFile: source,
          purposeText: parsed.purpose || '',
          version: parsed.version || 1,
          category: parsed.category || '',
          anatomyParts: JSON.stringify(parsed.anatomy || []),
          states: JSON.stringify(parsed.states || []),
          props: JSON.stringify(parsed.props || []),
          slots: JSON.stringify(parsed.slots || []),
          composedWidgets: JSON.stringify(parsed.compose || []),
          affordances: JSON.stringify(parsed.affordance || []),
          accessibilityRole: parsed.accessibility?.role || '',
          hasFocusTrap: String(parsed.accessibility?.focusTrap || false),
          keyboardBindings: JSON.stringify(parsed.accessibility?.keyboard || []),
          // Populated by syncs from WidgetImplementationEntity
          generatedComponentsCache: '[]',
        }),
        'ok', { entity: id },
      ),
    );
  },

  get(input) {
    const name = input.name as string;

    let p = createProgram();
    p = get(p, 'widget', `widget:${name}`, 'existing');

    return branch(p,
      (b) => b.existing != null,
      pureFrom(createProgram(), (b) => ({
        variant: 'ok',
        entity: (b.existing as Record<string, unknown>).id,
      })),
      complete(createProgram(), 'notfound', {}),
    );
  },

  findByAffordance(input) {
    const interactor = input.interactor as string;

    let p = createProgram();
    p = find(p, 'widget', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const matching = all.filter(w => {
        const affordances: Array<{ interactor?: string; type?: string }> =
          JSON.parse(w.affordances as string || '[]');
        return affordances.some(a => a.interactor === interactor || a.type === interactor);
      });
      return JSON.stringify(matching.map(w => w.name));
    }, 'result');

    return pureFrom(p, (b) => ({ variant: 'ok', widgets: b.result }));
  },

  findComposing(input) {
    const widget = input.widget as string;

    let p = createProgram();
    p = find(p, 'widget', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const target = all.find(w => w.id === widget);
      if (!target) return '[]';

      const parents = all.filter(w => {
        const composed: Array<string | { name?: string }> =
          JSON.parse(w.composedWidgets as string || '[]');
        return composed.some(c =>
          (typeof c === 'string' ? c : c.name) === target.name,
        );
      });
      return JSON.stringify(parents.map(w => w.name));
    }, 'parents');

    return pureFrom(p, (b) => ({ variant: 'ok', parents: b.parents }));
  },

  findComposedBy(input) {
    const widget = input.widget as string;

    let p = createProgram();
    p = find(p, 'widget', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(w => w.id === widget);
      return entry ? (entry.composedWidgets as string || '[]') : '[]';
    }, 'children');

    return pureFrom(p, (b) => ({ variant: 'ok', children: b.children }));
  },

  generatedComponents(input) {
    const widget = input.widget as string;

    let p = createProgram();
    p = find(p, 'widget', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(w => w.id === widget);
      return entry ? (entry.generatedComponentsCache as string || '[]') : '[]';
    }, 'components');

    return pureFrom(p, (b) => ({ variant: 'ok', components: b.components }));
  },

  accessibilityAudit(input) {
    const widget = input.widget as string;

    let p = createProgram();
    p = find(p, 'widget', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(w => w.id === widget);
      if (!entry) return { complete: false, missing: ['widget not found'] };

      const missing: string[] = [];
      if (!entry.accessibilityRole) missing.push('role');
      const keyboard: unknown[] = JSON.parse(entry.keyboardBindings as string || '[]');
      if (keyboard.length === 0) missing.push('keyboard bindings');

      return {
        complete: missing.length === 0,
        missing,
        report: { role: entry.accessibilityRole, focusTrap: entry.hasFocusTrap, keyboardBindings: keyboard.length },
      };
    }, 'audit');

    return branch(p,
      (b) => (b.audit as Record<string, unknown>).complete === true,
      pureFrom(createProgram(), (b) => {
        const a = b.audit as Record<string, unknown>;
        return { variant: 'ok', allPassing: 'true', report: JSON.stringify(a.report) };
      }),
      pureFrom(createProgram(), (b) => {
        const a = b.audit as Record<string, unknown>;
        return { variant: 'incomplete', missing: JSON.stringify(a.missing) };
      }),
    );
  },

  traceToConcept(input) {
    const widget = input.widget as string;

    let p = createProgram();
    p = find(p, 'widget', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(w => w.id === widget);
      if (!entry) return null;

      const affordances: Array<Record<string, unknown>> =
        JSON.parse(entry.affordances as string || '[]');
      if (affordances.length === 0) return null;

      return affordances.map(a => ({ concept: a.concept || 'unknown', via: 'affordance' }));
    }, 'concepts');

    return branch(p,
      (b) => b.concepts != null,
      pureFrom(createProgram(), (b) => ({
        variant: 'ok', concepts: JSON.stringify(b.concepts),
      })),
      complete(createProgram(), 'noConceptBinding', {}),
    );
  },
};
