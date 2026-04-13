// @clef-handler style=functional
// ManifestReader Concept Implementation
//
// Registry of format-specific config readers. Each reader translates one
// external config format (e.g., .prettierrc, .editorconfig, native Clef YAML)
// into a normalized list of provider entries. Dispatches read operations to
// the registered reader implementation matched by reader id.
//
// See docs/plans/virtual-provider-registry-prd.md §3.1.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram,
  get,
  find,
  put,
  branch,
  complete,
  completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `manifest-reader-${++idCounter}`;
}

/** Reset ID counter (for testing). */
export function resetManifestReaderIds(): void {
  idCounter = 0;
}

// ---------------------------------------------------------------------------
// Module-level reader dispatch table
//
// ManifestReader stores the reader id and format patterns in concept state,
// but the actual translation function lives in a provider module. Provider
// modules self-register their implementation here as an import-time
// side-effect; ManifestReader/read looks up the function by reader id and
// invokes it at interpret time via completeFrom.
// ---------------------------------------------------------------------------

export type ReaderFn = (path: string) => string;

const readerRegistry: Map<string, ReaderFn> = new Map();

/** Register a reader implementation by its registered id string. */
export function registerReader(name: string, fn: ReaderFn): void {
  readerRegistry.set(name, fn);
}

/** Look up a registered reader implementation. */
export function getReader(name: string): ReaderFn | undefined {
  return readerRegistry.get(name);
}

/** Clear the reader registry (for testing). */
export function clearReaders(): void {
  readerRegistry.clear();
}

export const manifestReaderHandler: FunctionalConceptHandler = {

  register(input: Record<string, unknown>) {
    const reader = input.reader != null ? String(input.reader) : '';
    const formats = Array.isArray(input.formats)
      ? (input.formats as unknown[]).map(String)
      : [];
    const priority = input.priority != null ? Number(input.priority) : 0;

    // Validate required non-empty fields
    if (!reader || reader.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'reader is required',
      }) as StorageProgram<Result>;
    }
    if (formats.length === 0) {
      return complete(createProgram(), 'error', {
        message: 'formats must not be empty',
      }) as StorageProgram<Result>;
    }

    // Check for duplicate reader id
    let p = createProgram();
    p = get(p, 'byReaderId', reader, 'existing');
    return branch(
      p,
      (b) => b.existing != null,
      (b) => complete(b, 'duplicate', { reader }) as StorageProgram<Result>,
      (b) => {
        const id = nextId();
        let b2 = put(b, 'byReaderId', reader, { id });
        b2 = put(b2, 'readers', id, { id, readerId: reader, formats, priority });
        return complete(b2, 'ok', { id }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  read(input: Record<string, unknown>) {
    const reader = input.reader != null ? String(input.reader) : '';
    const path   = input.path   != null ? String(input.path)   : '';

    if (!path || path.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'path is required',
      }) as StorageProgram<Result>;
    }

    // Look up reader registration by id
    let p = createProgram();
    p = get(p, 'byReaderId', reader, 'readerRef');
    return branch(
      p,
      (b) => b.readerRef != null,
      (b) => {
        const ref = b.readerRef as { id?: string } | null;
        const id = ref?.id ?? '';
        let q = createProgram();
        q = get(q, 'readers', id, 'readerRec');
        return completeFrom(q, 'ok', (bindings) => {
          const rec = bindings.readerRec as
            | { readerId?: string }
            | null;
          const readerId = rec?.readerId ?? '';
          const fn = readerRegistry.get(readerId);
          if (fn == null) {
            // Reader registered in state but no implementation loaded —
            // return stable placeholder bytes so callers get a usable result.
            const placeholder = Buffer.from(
              JSON.stringify({ entries: [], reader: readerId, path, unbound: true }),
            ).toString('base64');
            return { variant: 'ok', entries: placeholder };
          }
          try {
            const entries = fn(path);
            return { variant: 'ok', entries };
          } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            return { variant: 'error', message };
          }
        }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'not_found', { reader }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  listReaders(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'readers', {}, 'allReaders');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allReaders ?? []) as Array<Record<string, unknown>>;
      const readers = all
        .map((entry) => entry.readerId as string)
        .sort();
      return { variant: 'ok', readers };
    }) as StorageProgram<Result>;
  },

};

export const handler = autoInterpret(manifestReaderHandler);
export default handler;
