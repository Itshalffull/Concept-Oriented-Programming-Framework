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

const _personaCompilerHandler: FunctionalConceptHandler = {
  /**
   * Compile a persona page's Outline block tree into a PromptAssembly record.
   * Creates the compilation record immediately and returns ok. The actual
   * Outline walking and PromptAssembly creation happen via syncs triggered
   * by this compilation's completion.
   *
   * notfound / invalid variants are reached via syncs when the Outline walk
   * finds no persona page or no instruction blocks.
   */
  compile(input: Record<string, unknown>) {
    const personaPageId = toStr(input.personaPageId);

    if (!personaPageId || personaPageId.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'personaPageId is required' }) as StorageProgram<Result>;
    }

    const compilationId = `compilation:${personaPageId}`;
    const now = new Date().toISOString();
    const assemblyId = `assembly:${personaPageId}`;
    const sections = '[]';
    const totalTokens = 0;
    const tokenBreakdown = '{}';

    let p = createProgram();
    p = put(p, 'compilation', compilationId, {
      compilationId,
      personaPageId,
      assemblyId,
      sections,
      totalTokens,
      tokenBreakdown,
      status: 'compiled',
      lastCompiledAt: now,
    });
    return complete(p, 'ok', {
      compilation: compilationId,
      assemblyId,
      sections,
      totalTokens,
    }) as StorageProgram<Result>;
  },

  /**
   * Re-walk the Outline block tree and regenerate the PromptAssembly.
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
            assemblyId: (rec.assemblyId as string) || '',
            sections: (rec.sections as string) || '[]',
            totalTokens: (rec.totalTokens as number) || 0,
          };
        });
      },
      (b) => complete(b, 'notfound', { message: `No compilation record found: ${compilationId}` }),
    );
    return p as StorageProgram<Result>;
  },

  /**
   * Mark a compilation as stale — its source Outline blocks have changed.
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
   * Return the cached PromptAssembly ID, current status, and token breakdown.
   */
  getAssembly(input: Record<string, unknown>) {
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
          assemblyId: (rec.assemblyId as string) || '',
          status: (rec.status as string) || 'pending',
          tokenBreakdown: (rec.tokenBreakdown as string) || '{}',
        };
      }),
      (b) => complete(b, 'notfound', { message: `No compilation record found: ${compilationId}` }),
    );
    return p as StorageProgram<Result>;
  },

  /**
   * List all compilation records for a given persona page.
   */
  listByPersona(input: Record<string, unknown>) {
    const personaPageId = toStr(input.personaPageId);

    if (!personaPageId || personaPageId.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'personaPageId is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'compilation', { personaPageId } as Record<string, unknown>, 'results');
    p = branch(p,
      (bindings) => Array.isArray(bindings.results) && (bindings.results as unknown[]).length > 0,
      (b) => completeFrom(b, 'ok', (bindings) => ({
        compilations: JSON.stringify((bindings.results as Array<Record<string, unknown>>) || []),
      })),
      (b) => complete(b, 'notfound', { message: `No compilations found for persona page: ${personaPageId}` }),
    );
    return p as StorageProgram<Result>;
  },
};

export const personaCompilerHandler = autoInterpret(_personaCompilerHandler);
