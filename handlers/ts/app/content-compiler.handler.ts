// @clef-handler style=functional
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

/**
 * Safely coerce an input value to a string, returning empty string for
 * non-string types (e.g. ref placeholder objects passed by structural tests).
 */
function toStr(value: unknown): string {
  if (typeof value === 'string') return value;
  return '';
}

const _contentCompilerHandler: FunctionalConceptHandler = {
  /**
   * Compile a schema-overlaid content page into a structured output.
   * Creates the compilation record immediately and returns ok. The actual
   * schema lookup and provider dispatch happen via syncs triggered by this
   * compilation's completion.
   *
   * notfound / invalid variants are reached via syncs when the routing sync
   * finds no page or the provider returns an error.
   */
  compile(input: Record<string, unknown>) {
    const pageId = toStr(input.pageId);

    if (!pageId || pageId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'pageId is required' }) as StorageProgram<Result>;
    }

    // Check for an existing page record in our compilation index. A page that
    // has never been registered (no prior record under the 'page' relation)
    // is treated as not found. The 'page' relation is seeded by syncs when a
    // ContentNode page with a Schema overlay is discovered. The special sentinel
    // value 'empty-page' indicates a page that exists but has no content blocks,
    // so the provider returns invalid.
    let p = createProgram();
    p = spGet(p, 'page', pageId, 'pageRecord');
    p = branch(p, 'pageRecord',
      (b) => {
        // Page exists — check if it signals an invalid (empty) state
        const rec = (b.pageRecord || {}) as Record<string, unknown>;
        if ((rec.empty as boolean) === true) {
          return complete(b, 'invalid', { message: `Page '${pageId}' has no content blocks` });
        }

        const compilationId = `comp-${pageId}-${Date.now()}`;
        const now = new Date().toISOString();
        const schema = toStr(input.schema) || (rec.schema as string) || 'unknown';
        const outputRef = `output:${compilationId}`;
        const metadata = toStr(input.metadata) || '{}';

        let b2 = put(b, 'compilation', compilationId, {
          compilationId,
          pageId,
          schema,
          outputRef,
          status: 'compiled',
          lastCompiledAt: now,
          metadata,
        });
        return complete(b2, 'ok', {
          compilation: compilationId,
          schema,
          outputRef,
          metadata,
        });
      },
      (b) => complete(b, 'notfound', { message: `No page found with identifier: ${pageId}` }),
    );
    return p as StorageProgram<Result>;
  },

  /**
   * Re-walk the block tree and regenerate the output via the provider.
   * Updates status from "stale" to "compiled" and refreshes lastCompiledAt.
   */
  recompile(input: Record<string, unknown>) {
    const compilationId = toStr(input.compilation);

    if (!compilationId || compilationId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'compilation is required' }) as StorageProgram<Result>;
    }

    const now = new Date().toISOString();

    let p = createProgram();
    p = spGet(p, 'compilation', compilationId, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'compilation', compilationId, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return { ...rec, status: 'compiled', lastCompiledAt: now };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            compilation: compilationId,
            outputRef: (rec.outputRef as string) || '',
            metadata: (rec.metadata as string) || '{}',
          };
        });
      },
      (b) => complete(b, 'notfound', { message: `No compilation record found: ${compilationId}` }),
    );
    return p as StorageProgram<Result>;
  },

  /**
   * Mark a compilation as stale — its source blocks have changed.
   * Called by syncs when blocks are edited, reordered, or when a
   * SyncedContent transclusion source is updated.
   */
  markStale(input: Record<string, unknown>) {
    const compilationId = toStr(input.compilation);

    if (!compilationId || compilationId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'compilation is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'compilation', compilationId, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'compilation', compilationId, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return { ...rec, status: 'stale' };
        });
        return complete(b2, 'ok', { compilation: compilationId });
      },
      (b) => complete(b, 'notfound', { message: `No compilation record found: ${compilationId}` }),
    );
    return p as StorageProgram<Result>;
  },

  /**
   * Return the cached output reference, schema name, current status, and
   * provider metadata. When status is "stale" the output is present but
   * outdated relative to the current block tree.
   */
  getOutput(input: Record<string, unknown>) {
    const compilationId = toStr(input.compilation);

    if (!compilationId || compilationId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'compilation is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'compilation', compilationId, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          outputRef: (rec.outputRef as string) || '',
          schema: (rec.schema as string) || 'unknown',
          status: (rec.status as string) || 'compiled',
          metadata: (rec.metadata as string) || '{}',
        };
      }),
      (b) => complete(b, 'notfound', { message: `No compilation record found: ${compilationId}` }),
    );
    return p as StorageProgram<Result>;
  },

  /**
   * Returns all compilation records for the given page as a JSON array.
   * Enables diffing output evolution across recompile cycles.
   */
  listByPage(input: Record<string, unknown>) {
    const pageId = toStr(input.pageId);

    if (!pageId || pageId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'pageId is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'compilation', { pageId } as Record<string, unknown>, 'results');
    p = branch(p,
      (bindings) => Array.isArray(bindings.results) && (bindings.results as unknown[]).length > 0,
      (b) => completeFrom(b, 'ok', (bindings) => ({
        compilations: JSON.stringify((bindings.results as Array<Record<string, unknown>>) || []),
      })),
      (b) => complete(b, 'notfound', { message: `No compilations found for page: ${pageId}` }),
    );
    return p as StorageProgram<Result>;
  },

  /**
   * Returns all compilation records that used the given schema name as a
   * JSON array. Enables queries such as "all compiled agent personas" or
   * "all compiled meeting notes" without scanning every compilation record.
   */
  listBySchema(input: Record<string, unknown>) {
    const schema = toStr(input.schema);

    let p = createProgram();
    p = find(p, 'compilation', { schema } as Record<string, unknown>, 'results');
    return completeFrom(p, 'ok', (bindings) => ({
      compilations: JSON.stringify((bindings.results as Array<Record<string, unknown>>) || []),
    })) as StorageProgram<Result>;
  },
};

export const contentCompilerHandler = autoInterpret(_contentCompilerHandler);
