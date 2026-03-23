// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// WidgetRegistry Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _widgetRegistryHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const entry = input.entry as string; const widget = input.widget as string; const interactor = input.interactor as string;
    const concept = input.concept as string | null; const suite = input.suite as string | null;
    const tags = input.tags as string; const specificity = input.specificity as number;
    const contractVersion = input.contractVersion as number; const contractSlots = input.contractSlots as string;
    const contractActions = input.contractActions as string; const secondaryRoles = input.secondaryRoles as string;
    let p = createProgram(); p = spGet(p, 'widgetRegistry', entry, 'existing');
    p = branch(p, 'existing', (b) => complete(b, 'duplicate', { message: `Entry "${entry}" already registered` }),
      (b) => {
        let b2 = put(b, 'widgetRegistry', entry, { entry, widget, interactor, concept: concept || null, suite: suite || null, tags: tags || '[]', specificity, contractVersion: contractVersion || 1, contractSlots: contractSlots || '[]', contractActions: contractActions || '[]', secondaryRoles: secondaryRoles || '[]', registeredAt: new Date().toISOString() });
        return complete(b2, 'ok', { entry });
      });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  query(input: Record<string, unknown>) {
    const concept = input.concept as string | null; const suite = input.suite as string | null; const interactor = input.interactor as string | null;
    const queryKey = concept || suite || interactor || '';
    let p = createProgram(); p = find(p, 'widgetRegistry', queryKey, 'results');
    p = mapBindings(p, (bindings) => {
      const allEntries = Array.isArray(bindings.results) ? bindings.results : [];
      const filtered = allEntries.filter((entry: any) => {
        if (concept && entry.concept !== concept) return false;
        if (suite && entry.suite !== suite) return false;
        if (interactor && entry.interactor !== interactor) return false;
        return true;
      });
      filtered.sort((a: any, b: any) => (b.specificity as number) - (a.specificity as number));
      return filtered.length === 0 ? null : JSON.stringify(filtered.map((e: any) => ({ entry: e.entry, widget: e.widget, interactor: e.interactor, concept: e.concept, suite: e.suite, specificity: e.specificity, contractVersion: e.contractVersion, contractSlots: e.contractSlots, contractActions: e.contractActions, secondaryRoles: e.secondaryRoles })));
    }, 'entriesJson');
    p = branch(p, 'entriesJson', (b) => completeFrom(b, 'ok', (bindings) => ({ entries: bindings.entriesJson as string })),
      (b) => complete(b, 'none', { message: 'No matching entity affordances found' }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
  remove(input: Record<string, unknown>) {
    if (!input.entry || (typeof input.entry === 'string' && (input.entry as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'entry is required' }) as StorageProgram<Result>;
    }
    const entry = input.entry as string;
    let p = createProgram(); p = spGet(p, 'widgetRegistry', entry, 'existing');
    p = branch(p, 'existing', (b) => { let b2 = put(b, 'widgetRegistry', entry, { __deleted: true }); return complete(b2, 'ok', { entry }); },
      (b) => complete(b, 'notfound', { message: `Entry "${entry}" not found` }));
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const widgetRegistryHandler = autoInterpret(_widgetRegistryHandler);

