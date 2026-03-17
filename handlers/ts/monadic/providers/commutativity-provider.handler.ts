import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, put, pure,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';

/**
 * CommutativityProvider — functional handler.
 *
 * Checks whether two programs commute based on their read/write sets.
 * Returns a StorageProgram that stores the result and returns commutativity info.
 */
export const commutativityProviderHandler: FunctionalConceptHandler = {
  check(input: Record<string, unknown>) {
    const readWriteSetsA = input.readWriteSetsA as string;
    const readWriteSetsB = input.readWriteSetsB as string;

    try {
      let rwA: { r: string[]; w: string[] };
      let rwB: { r: string[]; w: string[] };

      try {
        rwA = JSON.parse(readWriteSetsA);
        rwB = JSON.parse(readWriteSetsB);
      } catch {
        const resultId = `comm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        let p = createProgram();
        p = put(p, 'results', resultId, { commutes: false, reason: 'no read/write sets provided' });
        p = pure(p, { variant: 'ok', result: resultId, commutes: false, reason: 'no read/write sets provided' });
        return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
      }

      const readsA = new Set(rwA.r || []);
      const writesA = new Set(rwA.w || []);
      const readsB = new Set(rwB.r || []);
      const writesB = new Set(rwB.w || []);

      let commutes = true;
      const conflicts: string[] = [];

      for (const w of writesA) {
        if (writesB.has(w)) { commutes = false; conflicts.push(`write-write conflict on ${w}`); }
        if (readsB.has(w)) { commutes = false; conflicts.push(`write-read conflict: A writes ${w}, B reads it`); }
      }
      for (const w of writesB) {
        if (readsA.has(w)) { commutes = false; conflicts.push(`write-read conflict: B writes ${w}, A reads it`); }
      }

      const reason = commutes ? 'disjoint read/write sets' : conflicts.join('; ');
      const resultId = `comm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      let p = createProgram();
      p = put(p, 'results', resultId, { commutes, reason });
      p = pure(p, { variant: 'ok', result: resultId, commutes, reason });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      const p = pure(createProgram(), {
        variant: 'error',
        message: `Commutativity check failed: ${(e as Error).message}`,
      });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },
};
