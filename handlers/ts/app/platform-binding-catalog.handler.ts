// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

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

    return complete(p, 'ok', { binding }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const platform = String(input.platform ?? '');
    const destination = String(input.destination ?? '');
    const bindingKind = String(input.bindingKind ?? '');

    let p = createProgram();
    p = find(p, 'binding', { platform, bindingKind }, 'matchingBindings');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.matchingBindings as Array<Record<string, unknown>>) || [];

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
    }) as StorageProgram<Result>;
  },

  list(input: Record<string, unknown>) {
    const platform = typeof input.platform === 'string' && input.platform.trim() ? String(input.platform) : undefined;

    let p = createProgram();
    p = find(p, 'binding', platform ? { platform } : {}, 'bindings');

    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.bindings as Array<Record<string, unknown>>) || [];
      return { bindings: all };
    }) as StorageProgram<Result>;
  },
};

// All actions are now fully functional — no imperative overrides needed.
export const platformBindingCatalogHandler = autoInterpret(_platformBindingCatalogHandler);

export default platformBindingCatalogHandler;
