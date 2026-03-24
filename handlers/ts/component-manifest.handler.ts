// @clef-handler style=functional
// ============================================================
// ComponentManifest Handler
//
// Describes what a published module exposes: concept specs,
// syncs, derived compositions, widgets, and handlers. Allows
// the registry to index module capabilities for search and
// dependency analysis.
// See Architecture doc Section 16.11.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function componentKey(moduleId: string, version: string): string {
  return `${moduleId}@${version}`;
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const moduleId = (input.module_id as string) || '';
    const version = (input.version as string) || '';
    const concepts = (input.concepts as unknown[]) || [];
    const syncs = (input.syncs as unknown[]) || [];
    const derived = (input.derived as unknown[]) || [];
    const widgets = (input.widgets as unknown[]) || [];
    const handlers = (input.handlers as unknown[]) || [];

    if (!moduleId || moduleId.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'module_id is required' }) as StorageProgram<Result>;
    }
    if (!version || version.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'version is required' }) as StorageProgram<Result>;
    }

    const key = componentKey(moduleId, version);
    const now = new Date().toISOString();

    let p = createProgram();
    p = put(p, 'component-manifest', key, {
      id: key,
      module_id: moduleId,
      version,
      concepts,
      syncs,
      derived,
      widgets,
      handlers,
      registered_at: now,
    });

    return complete(p, 'ok', { component: key }) as StorageProgram<Result>;
  },

  lookup(input: Record<string, unknown>) {
    const moduleId = (input.module_id as string) || '';
    const version = (input.version as string) || '';

    if (!moduleId || moduleId.trim() === '') {
      return complete(createProgram(), 'notfound', {}) as StorageProgram<Result>;
    }

    const key = componentKey(moduleId, version);
    let p = createProgram();
    p = get(p, 'component-manifest', key, 'existing');

    return branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return { component: rec.id };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', {}) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  search(input: Record<string, unknown>) {
    const capability = (input.capability as string) || '';

    if (!capability || capability.trim() === '') {
      return complete(createProgram(), 'error', { message: 'capability is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'component-manifest', {}, 'all');
    p = mapBindings(p, (bindings) => {
      const all = (bindings.all as Array<Record<string, unknown>>) || [];
      const results: Array<{ module_id: string; version: string; match_type: string; match_name: string }> = [];
      const capLower = capability.toLowerCase();

      for (const comp of all) {
        const moduleId = comp.module_id as string;
        const version = comp.version as string;
        if (!moduleId) continue;

        const checkItems = (items: Array<{ name: string }>, matchType: string) => {
          for (const item of items || []) {
            if (item.name && item.name.toLowerCase().includes(capLower)) {
              results.push({ module_id: moduleId, version, match_type: matchType, match_name: item.name });
            }
          }
        };

        checkItems(comp.concepts as Array<{ name: string }>, 'concept');
        checkItems(comp.syncs as Array<{ name: string }>, 'sync');
        checkItems(comp.derived as Array<{ name: string }>, 'derived');
        checkItems(comp.widgets as Array<{ name: string }>, 'widget');
        checkItems(comp.handlers as Array<{ name: string }>, 'handler');
      }

      return results;
    }, '_results');

    return branch(p, (b) => ((b._results as unknown[]) || []).length > 0,
      (b) => completeFrom(b, 'ok', (bindings) => ({ results: bindings._results })) as StorageProgram<Result>,
      (b) => complete(b, 'empty', {}) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },
};

export const componentManifestHandler = autoInterpret(_handler);
