// @migrated dsl-constructs 2026-03-18
// Version Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { wrapFunctional } from '../../../runtime/functional-compat.ts';

const versionHandlerFunctional: FunctionalConceptHandler = {
  snapshot(input: Record<string, unknown>) {
    const version = input.version as string; const entity = input.entity as string;
    const data = input.data as string; const author = input.author as string;
    let p = createProgram();
    p = put(p, 'version', version, { version, entity, snapshot: data, timestamp: new Date().toISOString(), author });
    return complete(p, 'ok', { version }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listVersions(input: Record<string, unknown>) {
    const entity = input.entity as string;
    let p = createProgram();
    p = find(p, 'version', { entity }, 'results');
    p = mapBindings(p, (bindings) => {
      const results = ((bindings.results as Array<Record<string, unknown>>) || []).sort((a, b) => (a.timestamp as string).localeCompare(b.timestamp as string));
      const versionLabels = results.map((_, i) => `v${i + 1}`);
      return versionLabels.length === 1 ? versionLabels[0] : versionLabels.join(',');
    }, 'versions');
    return complete(p, 'ok', { versions: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  rollback(input: Record<string, unknown>) {
    const version = input.version as string;
    let p = createProgram();
    p = spGet(p, 'version', version, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'ok', { data: '' }),
      (b) => complete(b, 'notfound', { message: 'Version not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  diff(input: Record<string, unknown>) {
    const versionA = input.versionA as string; const versionB = input.versionB as string;
    let p = createProgram();
    p = spGet(p, 'version', versionA, 'a');
    p = spGet(p, 'version', versionB, 'b');
    p = mapBindings(p, (bindings) => !bindings.a || !bindings.b, 'missing');
    p = branch(p, (bindings) => !(bindings.missing as boolean),
      (() => {
        let t = createProgram();
        t = mapBindings(t, (bindings) => {
          const a = bindings.a as Record<string, unknown>;
          const b = bindings.b as Record<string, unknown>;
          return JSON.stringify({ versionA: { version: versionA, snapshot: a.snapshot }, versionB: { version: versionB, snapshot: b.snapshot }, equal: a.snapshot === b.snapshot });
        }, 'changes');
        return complete(t, 'ok', { changes: '' });
      })(),
      (() => { let e = createProgram(); return complete(e, 'notfound', { message: 'One or both versions do not exist' }); })(),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

/** Backward-compatible imperative wrapper — delegates to interpret(). */
export const versionHandler = wrapFunctional(versionHandlerFunctional);
/** The raw functional handler returning StorageProgram. */
export { versionHandlerFunctional };
