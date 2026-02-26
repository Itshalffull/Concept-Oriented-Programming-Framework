// Provenance Concept Implementation
import type { ConceptHandler } from '@clef/kernel';

export const provenanceHandler: ConceptHandler = {
  async record(input, storage) {
    const entity = input.entity as string;
    const activity = input.activity as string;
    const agent = input.agent as string;
    const inputs = input.inputs as string || '';

    const recordId = `prov-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const batchId = input.batchId as string || `batch-${new Date().toISOString().slice(0, 10)}`;

    await storage.put('provenanceRecord', recordId, {
      recordId,
      entity,
      activity,
      agent,
      inputs,
      timestamp: new Date().toISOString(),
      batchId,
    });

    // Update map table for batch tracking
    const mapTable = await storage.get('provenanceMapTable', batchId) || { entries: [] };
    const entries = (mapTable.entries as any[]) || [];
    entries.push({ recordId, entity, activity });
    await storage.put('provenanceMapTable', batchId, { batchId, entries });

    return { variant: 'ok', recordId };
  },

  async trace(input, storage) {
    const entityId = input.entityId as string;

    const allRecords = await storage.find('provenanceRecord');
    const chain = allRecords
      .filter((r: any) => r.entity === entityId)
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      .map((r: any) => ({
        recordId: r.recordId,
        activity: r.activity,
        agent: r.agent,
        timestamp: r.timestamp,
        inputs: r.inputs,
      }));

    if (chain.length === 0) {
      return { variant: 'notfound', message: `No provenance records for "${entityId}"` };
    }

    return { variant: 'ok', chain: JSON.stringify(chain) };
  },

  async audit(input, storage) {
    const batchId = input.batchId as string;

    const mapTable = await storage.get('provenanceMapTable', batchId);
    if (!mapTable) {
      return { variant: 'notfound', message: `Batch "${batchId}" not found` };
    }

    const entries = (mapTable.entries as any[]) || [];
    const graph = {
      batchId,
      nodeCount: entries.length,
      entries,
    };

    return { variant: 'ok', graph: JSON.stringify(graph) };
  },

  async rollback(input, storage) {
    const batchId = input.batchId as string;

    const mapTable = await storage.get('provenanceMapTable', batchId);
    if (!mapTable) {
      return { variant: 'notfound', message: `Batch "${batchId}" not found` };
    }

    const entries = (mapTable.entries as any[]) || [];
    let rolled = 0;

    // Reverse all writes from the batch
    for (const entry of entries.reverse()) {
      if (entry.activity === 'storage' || entry.activity === 'import' || entry.activity === 'capture') {
        await storage.delete('provenanceRecord', entry.recordId);
        rolled++;
      }
    }

    return { variant: 'ok', rolled };
  },

  async diff(input, storage) {
    const entityId = input.entityId as string;
    const version1 = input.version1 as string;
    const version2 = input.version2 as string;

    const record1 = await storage.get('provenanceRecord', version1);
    const record2 = await storage.get('provenanceRecord', version2);

    if (!record1 || !record2) {
      return { variant: 'notfound', message: 'One or both versions not found' };
    }

    const changes: Record<string, { before: unknown; after: unknown }> = {};
    const keys = new Set([...Object.keys(record1), ...Object.keys(record2)]);

    for (const key of keys) {
      if (JSON.stringify(record1[key]) !== JSON.stringify(record2[key])) {
        changes[key] = { before: record1[key], after: record2[key] };
      }
    }

    return { variant: 'ok', changes: JSON.stringify(changes) };
  },

  async reproduce(input, storage) {
    const entityId = input.entityId as string;

    const allRecords = await storage.find('provenanceRecord');
    const chain = allRecords
      .filter((r: any) => r.entity === entityId)
      .sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    if (chain.length === 0) {
      return { variant: 'notfound', message: `No provenance records for "${entityId}"` };
    }

    const plan = chain.map((r: any, i: number) => ({
      step: i + 1,
      action: r.activity,
      agent: r.agent,
      inputs: r.inputs,
    }));

    return { variant: 'ok', plan: JSON.stringify(plan) };
  },
};
