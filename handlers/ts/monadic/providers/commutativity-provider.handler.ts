// @clef-handler style=imperative
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, put, pure,
  type StorageProgram,
  complete,
} from '../../../../runtime/storage-program.ts';

/**
 * CommutativityProvider — functional handler.
 *
 * Checks whether two programs commute based on their read/write sets.
 * Returns a StorageProgram that stores the result and returns commutativity info.
 */
export const commutativityProviderHandler: FunctionalConceptHandler = {
  check(input: Record<string, unknown>) {
    const programA = input.programA as string;
    const programB = input.programB as string;
    const readWriteSetsA = input.readWriteSetsA;
    const readWriteSetsB = input.readWriteSetsB;

    // Validate required fields
    if (!programA || (typeof programA === 'string' && programA.trim() === '')) {
      const p = complete(createProgram(), 'error', { message: 'programA is required' });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
    if (!programB || (typeof programB === 'string' && programB.trim() === '')) {
      const p = complete(createProgram(), 'error', { message: 'programB is required' });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
    if (!readWriteSetsA || (typeof readWriteSetsA === 'string' && (readWriteSetsA as string).trim() === '')) {
      const p = complete(createProgram(), 'error', { message: 'readWriteSetsA is required' });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
    if (!readWriteSetsB || (typeof readWriteSetsB === 'string' && (readWriteSetsB as string).trim() === '')) {
      const p = complete(createProgram(), 'error', { message: 'readWriteSetsB is required' });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    try {
      let rwA: { r: string[]; w: string[] };
      let rwB: { r: string[]; w: string[] };

      function parseRWSet(s: unknown): { r: string[]; w: string[] } {
        if (typeof s !== 'string') return s as { r: string[]; w: string[] };
        // Try standard JSON first
        try { return JSON.parse(s); } catch {}
        // Try lenient parsing: replace unquoted keys and array brackets with identifier lists
        try {
          // Extract r: [...] and w: [...] patterns, supporting unquoted keys like {r: [], w: [x,y]}
          const rMatch = s.match(/r\s*:\s*\[([^\]]*)\]/);
          const wMatch = s.match(/w\s*:\s*\[([^\]]*)\]/);
          const r = rMatch ? rMatch[1].split(',').map(x => x.trim()).filter(Boolean) : [];
          const w = wMatch ? wMatch[1].split(',').map(x => x.trim()).filter(Boolean) : [];
          return { r, w };
        } catch {
          return { r: [], w: [] };
        }
      }

      try {
        rwA = parseRWSet(readWriteSetsA);
        rwB = parseRWSet(readWriteSetsB);
      } catch {
        const p = complete(createProgram(), 'error', { message: 'readWriteSets could not be parsed' });
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
      p = complete(p, 'ok', { result: resultId, commutes, reason });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    } catch (e) {
      const p = complete(createProgram(), 'error', { message: `Commutativity check failed: ${(e as Error).message}` });
      return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }
  },
};
