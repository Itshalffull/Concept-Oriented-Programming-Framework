// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import type { ConceptStorage } from '../../../runtime/types.ts';

const _platformBindingCatalogHandler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const binding = String(input.binding ?? '');

    let p = createProgram();
    p = put(p, 'binding', binding, {
      id: binding,
      platform: String(input.platform ?? ''),
      destinationPattern: String(input.destinationPattern ?? ''),
      bindingKind: String(input.bindingKind ?? ''),
      payload: String(input.payload ?? ''),
    });

    return complete(p, 'ok', { binding }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  resolve(_input: Record<string, unknown>) {
    // resolve() requires pattern matching iteration, delegated to imperative override
    let p = createProgram();
    return complete(p, 'notfound', { message: 'delegated' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'binding', {}, 'bindings');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.bindings as Array<Record<string, unknown>>) || [];
      return { bindings: all };
    }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

const _base = autoInterpret(_platformBindingCatalogHandler);

// resolve() requires pattern matching with exact/wildcard fallback, use imperative style.
async function _resolve(input: Record<string, unknown>, storage: ConceptStorage) {
  const platform = String(input.platform ?? '');
  const destination = String(input.destination ?? '');
  const bindingKind = String(input.bindingKind ?? '');

  const all = await storage.find('binding', { platform, bindingKind });
  // Try exact match first
  const exact = all.find((b: any) => b.destinationPattern === destination);
  if (exact) {
    return { variant: 'ok', binding: exact.id, matchedPattern: destination, payload: exact.payload };
  }
  // Fallback to wildcard
  const wildcard = all.find((b: any) => b.destinationPattern === '*');
  if (wildcard) {
    return { variant: 'ok', binding: wildcard.id, matchedPattern: '*', payload: wildcard.payload };
  }
  return { variant: 'notfound', message: `No binding for ${platform}:${destination}:${bindingKind}` };
}

// list() with platform filtering
async function _list(input: Record<string, unknown>, storage: ConceptStorage) {
  const platform = typeof input.platform === 'string' && input.platform.trim() ? String(input.platform) : undefined;
  const all = await storage.find('binding', platform ? { platform } : {});
  return { variant: 'ok', bindings: all };
}

export const platformBindingCatalogHandler = new Proxy(_base, {
  get(target, prop: string) {
    if (prop === 'resolve') return _resolve;
    if (prop === 'list') return _list;
    return (target as Record<string, unknown>)[prop];
  },
}) as typeof _base;

export default platformBindingCatalogHandler;
