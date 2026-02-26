// ============================================================
// Ref Handler
//
// Provide mutable, human-readable names for immutable content-
// addressed objects. The only mutable state in the versioning
// system is naming -- all content and history are immutable once
// created.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `ref-${++idCounter}`;
}

export const refHandler: ConceptHandler = {
  async create(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const hash = input.hash as string;

    // Check if ref name already exists
    const existing = await storage.find('ref', { name });
    if (existing.length > 0) {
      return { variant: 'exists', message: `A ref with name '${name}' already exists` };
    }

    const id = nextId();
    const now = new Date().toISOString();
    await storage.put('ref', id, {
      id,
      name,
      target: hash,
    });

    // Add reflog entry
    await storage.put('ref-log', `${name}-${now}`, {
      name,
      oldHash: '',
      newHash: hash,
      timestamp: now,
      agent: 'system',
    });

    return { variant: 'ok', ref: id };
  },

  async update(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const newHash = input.newHash as string;
    const expectedOldHash = input.expectedOldHash as string;

    const existing = await storage.find('ref', { name });
    if (existing.length === 0) {
      return { variant: 'notFound', message: `No ref with name '${name}'` };
    }

    const record = existing[0];
    const currentHash = record.target as string;

    // Compare-and-swap: current must equal expected
    if (currentHash !== expectedOldHash) {
      return { variant: 'conflict', current: currentHash };
    }

    const now = new Date().toISOString();
    await storage.put('ref', record.id as string, {
      ...record,
      target: newHash,
    });

    // Record in reflog
    await storage.put('ref-log', `${name}-${now}`, {
      name,
      oldHash: currentHash,
      newHash,
      timestamp: now,
      agent: 'system',
    });

    return { variant: 'ok' };
  },

  async delete(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;

    const existing = await storage.find('ref', { name });
    if (existing.length === 0) {
      return { variant: 'notFound', message: `No ref with name '${name}'` };
    }

    const record = existing[0];

    // Check for protected refs (names starting with "protected/" or "HEAD")
    if (name === 'HEAD' || name.startsWith('protected/')) {
      return { variant: 'protected', message: `Ref '${name}' is protected and cannot be deleted` };
    }

    const now = new Date().toISOString();
    const oldHash = record.target as string;

    await storage.del('ref', record.id as string);

    // Record deletion in reflog
    await storage.put('ref-log', `${name}-${now}`, {
      name,
      oldHash,
      newHash: '',
      timestamp: now,
      agent: 'system',
    });

    return { variant: 'ok' };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;

    const results = await storage.find('ref', { name });
    if (results.length === 0) {
      return { variant: 'notFound', message: `No ref with name '${name}'` };
    }

    return { variant: 'ok', hash: results[0].target as string };
  },

  async log(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;

    // Check if ref exists or has existed
    const refs = await storage.find('ref', { name });
    const logEntries = await storage.find('ref-log', { name });

    if (refs.length === 0 && logEntries.length === 0) {
      return { variant: 'notFound', message: `No ref with name '${name}'` };
    }

    const entries = logEntries.map(entry => ({
      oldHash: entry.oldHash as string,
      newHash: entry.newHash as string,
      timestamp: entry.timestamp as string,
      agent: entry.agent as string,
    }));

    // Sort by timestamp descending (most recent first)
    entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return { variant: 'ok', entries };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetRefCounter(): void {
  idCounter = 0;
}
