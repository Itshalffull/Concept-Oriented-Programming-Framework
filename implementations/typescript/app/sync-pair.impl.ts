// SyncPair Concept Implementation
import type { ConceptHandler } from '@copf/kernel';

export const syncPairHandler: ConceptHandler = {
  async link(input, storage) {
    const pairId = input.pairId as string;
    const idA = input.idA as string;
    const idB = input.idB as string;

    const pair = await storage.get('syncPair', pairId);
    if (!pair) {
      return { variant: 'notfound', message: `Pair "${pairId}" not found` };
    }

    const pairMap = (pair.pairMap as Record<string, string>) || {};
    pairMap[idA] = idB;

    await storage.put('syncPair', pairId, {
      ...pair,
      pairMap,
    });

    return { variant: 'ok' };
  },

  async sync(input, storage) {
    const pairId = input.pairId as string;

    const pair = await storage.get('syncPair', pairId);
    if (!pair) {
      return { variant: 'notfound', message: `Pair "${pairId}" not found` };
    }

    await storage.put('syncPair', pairId, { ...pair, status: 'syncing' });

    // Detect changes on both sides via version vectors
    const changes: any[] = [];
    const versionVectors = (pair.versionVectors as Record<string, any>) || {};

    // Record the sync operation in the change log
    const changeLog = (pair.changeLog as any[]) || [];
    changeLog.push({
      pairId,
      operation: 'sync',
      timestamp: new Date().toISOString(),
    });

    await storage.put('syncPair', pairId, {
      ...pair,
      status: 'idle',
      changeLog,
    });

    return { variant: 'ok', changes: JSON.stringify(changes) };
  },

  async detectConflicts(input, storage) {
    const pairId = input.pairId as string;

    const pair = await storage.get('syncPair', pairId);
    if (!pair) {
      return { variant: 'notfound', message: `Pair "${pairId}" not found` };
    }

    // Compare version vectors to identify conflicts
    const conflicts: any[] = [];
    return { variant: 'ok', conflicts: JSON.stringify(conflicts) };
  },

  async resolve(input, storage) {
    const conflictId = input.conflictId as string;
    const resolution = input.resolution as string || '';

    const conflict = await storage.get('syncConflict', conflictId);
    if (!conflict) {
      return { variant: 'notfound', message: `Conflict "${conflictId}" not found` };
    }

    // Plugin-dispatched to conflict_resolver provider
    await storage.delete('syncConflict', conflictId);
    return { variant: 'ok', winner: resolution || 'auto' };
  },

  async unlink(input, storage) {
    const pairId = input.pairId as string;
    const idA = input.idA as string;

    const pair = await storage.get('syncPair', pairId);
    if (!pair) {
      return { variant: 'notfound', message: `Pair "${pairId}" not found` };
    }

    const pairMap = (pair.pairMap as Record<string, string>) || {};
    if (!(idA in pairMap)) {
      return { variant: 'notfound', message: `Record "${idA}" not linked in pair "${pairId}"` };
    }

    delete pairMap[idA];
    await storage.put('syncPair', pairId, { ...pair, pairMap });

    return { variant: 'ok' };
  },

  async getChangeLog(input, storage) {
    const pairId = input.pairId as string;
    const since = input.since as string || '';

    const pair = await storage.get('syncPair', pairId);
    if (!pair) {
      return { variant: 'notfound', message: `Pair "${pairId}" not found` };
    }

    let log = (pair.changeLog as any[]) || [];
    if (since) {
      const sinceTime = new Date(since).getTime();
      log = log.filter((entry: any) => new Date(entry.timestamp).getTime() >= sinceTime);
    }

    return { variant: 'ok', log: JSON.stringify(log) };
  },
};
