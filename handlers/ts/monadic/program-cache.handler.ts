import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.ts';

export const programCacheHandler: ConceptHandler = {
  async lookup(input: Record<string, unknown>, storage: ConceptStorage) {
    const programHash = input.programHash as string;
    const stateHash = input.stateHash as string;
    const cacheKey = `${programHash}::${stateHash}`;

    const entry = await storage.get('entries', cacheKey);
    if (!entry) return { variant: 'miss' };

    const hits = ((entry.hits as number) || 0) + 1;
    await storage.put('entries', cacheKey, { ...entry, hits });
    return { variant: 'hit', entry: cacheKey, result: entry.result as string };
  },

  async store(input: Record<string, unknown>, storage: ConceptStorage) {
    const programHash = input.programHash as string;
    const stateHash = input.stateHash as string;
    const result = input.result as string;
    const cacheKey = `${programHash}::${stateHash}`;

    const existing = await storage.get('entries', cacheKey);
    if (existing) return { variant: 'exists' };

    await storage.put('entries', cacheKey, {
      programHash,
      stateHash,
      result,
      hits: 0,
      storedAt: new Date().toISOString(),
    });
    return { variant: 'ok', entry: cacheKey };
  },

  async invalidateByState(input: Record<string, unknown>, storage: ConceptStorage) {
    const stateHash = input.stateHash as string;
    const evicted = await storage.delMany('entries', { stateHash });
    return { variant: 'ok', evicted };
  },

  async invalidateByProgram(input: Record<string, unknown>, storage: ConceptStorage) {
    const programHash = input.programHash as string;
    const evicted = await storage.delMany('entries', { programHash });
    return { variant: 'ok', evicted };
  },

  async stats(input: Record<string, unknown>, storage: ConceptStorage) {
    const entries = await storage.find('entries');
    const totalEntries = entries.length;
    let totalHits = 0;
    let totalLookups = 0;
    for (const e of entries) {
      totalHits += (e.hits as number) || 0;
      totalLookups += ((e.hits as number) || 0) + 1;
    }
    const hitRate = totalLookups > 0 ? `${((totalHits / totalLookups) * 100).toFixed(1)}%` : '0.0%';
    return { variant: 'ok', totalEntries, hitRate, memoryBytes: JSON.stringify(entries).length };
  },
};
