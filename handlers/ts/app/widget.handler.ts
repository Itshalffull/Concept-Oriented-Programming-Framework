// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Widget Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let widgetCounter = 0;

const _widgetHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const widget = (input.widget as string) || `widget-${++widgetCounter}`; const name = input.name as string; const ast = input.ast as string; const category = input.category as string;
    let p = createProgram(); p = spGet(p, 'widget', widget, 'existing');
    p = branch(p, 'existing', (b) => complete(b, 'duplicate', { message: 'A widget with this identity already exists' }),
      (b) => { try { JSON.parse(ast); } catch { return complete(b, 'invalid', { message: 'Widget AST must be valid JSON' }); }
        let b2 = put(b, 'widget', widget, { widget, name, category: category || 'general', ast, version: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() }); return complete(b2, 'ok', { widget }); });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  get(input: Record<string, unknown>) {
    if (!input.widget || (typeof input.widget === 'string' && (input.widget as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'widget is required' }) as StorageProgram<Result>;
    }
    const widget = input.widget as string;
    let p = createProgram(); p = spGet(p, 'widget', widget, 'existing');
    p = branch(p, 'existing', (b) => complete(b, 'ok', { ast: '', name: '' }), (b) => complete(b, 'notfound', { message: 'Widget not found' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  list(input: Record<string, unknown>) {
    const category = input.category as string;
    let p = createProgram(); p = find(p, 'widget', category || '', 'results');
    p = mapBindings(p, (bindings) => {
      const allWidgets = Array.isArray(bindings.results) ? bindings.results : [];
      const filtered = category ? allWidgets.filter((w: any) => w.category === category) : allWidgets;
      return JSON.stringify(filtered.map((w: any) => ({ widget: w.widget, name: w.name, category: w.category, version: w.version })));
    }, 'widgetsJson');
    return complete(p, 'ok', { widgets: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  unregister(input: Record<string, unknown>) {
    const widget = input.widget as string;
    let p = createProgram(); p = spGet(p, 'widget', widget, 'existing');
    p = branch(p, 'existing', (b) => { let b2 = put(b, 'widget', widget, { __deleted: true }); return complete(b2, 'ok', {}); },
      (b) => complete(b, 'notfound', { message: 'Widget not found' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const widgetHandler = autoInterpret(_widgetHandler);

