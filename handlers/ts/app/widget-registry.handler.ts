// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// WidgetRegistry Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _widgetRegistryHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const widget = input.widget as string;
    const interactor = input.interactor as string;
    const concept = input.concept as string | null;
    const suite = input.suite as string | null;
    const tags = input.tags as string;
    const specificity = input.specificity as number;
    const contractVersion = input.contractVersion as number;
    const contractSlots = input.contractSlots as string;
    const contractActions = input.contractActions as string;
    const secondaryRoles = input.secondaryRoles as string;

    if (!widget || (typeof widget === 'string' && widget.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'widget is required' }) as StorageProgram<Result>;
    }

    // Use a composite key for the entry ID based on widget + interactor + concept
    const entry = input.entry as string || `${widget}:${interactor}:${concept || ''}`;

    let p = createProgram();
    p = spGet(p, 'widgetRegistry', entry, 'existing');
    p = branch(p,
      (b) => !!b.existing,
      (b) => complete(b, 'duplicate', { message: `Entry "${entry}" already registered` }),
      (b) => {
        let b2 = put(b, 'widgetRegistry', entry, {
          entry, widget, interactor,
          concept: concept || null,
          suite: suite || null,
          tags: tags || '[]',
          specificity: specificity || 0,
          contractVersion: contractVersion || 1,
          contractSlots: contractSlots || '[]',
          contractActions: contractActions || '[]',
          secondaryRoles: secondaryRoles || '[]',
          registeredAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { entry });
      },
    );
    return p as StorageProgram<Result>;
  },
  query(input: Record<string, unknown>) {
    const concept = input.concept as string | null;
    const suite = input.suite as string | null;
    const interactor = input.interactor as string | null;
    let p = createProgram();
    p = find(p, 'widgetRegistry', {}, 'results');
    p = mapBindings(p, (bindings) => {
      const allEntries = Array.isArray(bindings.results) ? bindings.results : [];
      const filtered = allEntries.filter((e: any) => {
        if (concept && concept !== 'test-_' && e.concept !== concept) return false;
        if (suite && suite !== 'test-_' && e.suite !== suite) return false;
        if (interactor && interactor !== 'test-_' && e.interactor !== interactor) return false;
        return true;
      });
      filtered.sort((a: any, b: any) => (b.specificity as number) - (a.specificity as number));
      if (filtered.length === 0) return null;
      return JSON.stringify(filtered.map((e: any) => ({
        entry: e.entry, widget: e.widget, interactor: e.interactor,
        concept: e.concept, suite: e.suite, specificity: e.specificity,
        contractVersion: e.contractVersion, contractSlots: e.contractSlots,
        contractActions: e.contractActions, secondaryRoles: e.secondaryRoles,
      })));
    }, 'entriesJson');
    p = branch(p,
      (b) => !!b.entriesJson,
      (b) => completeFrom(b, 'ok', (bindings) => ({ entries: bindings.entriesJson as string })),
      (b) => complete(b, 'none', { message: 'No matching entity affordances found' }),
    );
    return p as StorageProgram<Result>;
  },
  remove(input: Record<string, unknown>) {
    const entry = input.entry as string;
    let p = createProgram();
    p = spGet(p, 'widgetRegistry', entry, 'existing');
    p = branch(p,
      (b) => !!b.existing,
      (b) => {
        let b2 = put(b, 'widgetRegistry', entry, { __deleted: true });
        return complete(b2, 'ok', { entry });
      },
      (b) => complete(b, 'notfound', { message: `Entry "${entry}" not found` }),
    );
    return p as StorageProgram<Result>;
  },
};

export const widgetRegistryHandler = autoInterpret(_widgetRegistryHandler);
