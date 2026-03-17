import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.ts';

export const commutativityProviderHandler: ConceptHandler = {
  async check(input: Record<string, unknown>, storage: ConceptStorage) {
    const readWriteSetsA = input.readWriteSetsA as string;
    const readWriteSetsB = input.readWriteSetsB as string;

    try {
      let rwA: { r: string[]; w: string[] };
      let rwB: { r: string[]; w: string[] };

      try {
        rwA = JSON.parse(readWriteSetsA);
        rwB = JSON.parse(readWriteSetsB);
      } catch {
        // If no pre-computed sets provided, assume non-commutative
        const resultId = `comm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        await storage.put('results', resultId, { commutes: false, reason: 'no read/write sets provided' });
        return { variant: 'ok', result: resultId, commutes: false, reason: 'no read/write sets provided' };
      }

      const readsA = new Set(rwA.r || []);
      const writesA = new Set(rwA.w || []);
      const readsB = new Set(rwB.r || []);
      const writesB = new Set(rwB.w || []);

      // Two programs commute if:
      // 1. Their write sets are disjoint
      // 2. Neither program's write set overlaps the other's read set
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
      await storage.put('results', resultId, { commutes, reason });

      return { variant: 'ok', result: resultId, commutes, reason };
    } catch (e) {
      return { variant: 'error', message: `Commutativity check failed: ${(e as Error).message}` };
    }
  },
};
