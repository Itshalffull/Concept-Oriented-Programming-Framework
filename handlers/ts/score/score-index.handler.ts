// ScoreIndex Concept Implementation
//
// Materialized index backing ScoreApi queries. Maintains
// denormalized views of the five Score layers optimized for
// fast LLM-friendly lookups. Auto-registered as a built-in
// concept in every Clef runtime.

import type { ConceptHandler } from '@clef/runtime';

export const scoreIndexHandler: ConceptHandler = {
  async upsertConcept(input, storage) {
    const name = input.name as string;
    if (!name) {
      return { variant: 'error', message: 'name is required' };
    }

    const id = `concept:${name}`;
    const now = new Date().toISOString();

    await storage.put('concepts', id, {
      conceptName: name,
      purpose: (input.purpose as string) || '',
      actions: (input.actions as string[]) || [],
      stateFields: (input.stateFields as string[]) || [],
      file: (input.file as string) || '',
    });

    await storage.put('meta', 'concepts', {
      kind: 'concepts',
      lastUpdated: now,
    });

    return { variant: 'ok', index: id };
  },

  async upsertSync(input, storage) {
    const name = input.name as string;
    if (!name) {
      return { variant: 'error', message: 'name is required' };
    }

    const id = `sync:${name}`;
    const now = new Date().toISOString();

    await storage.put('syncs', id, {
      syncName: name,
      annotation: (input.annotation as string) || 'eager',
      triggers: (input.triggers as string[]) || [],
      effects: (input.effects as string[]) || [],
      file: (input.file as string) || '',
    });

    await storage.put('meta', 'syncs', {
      kind: 'syncs',
      lastUpdated: now,
    });

    return { variant: 'ok', index: id };
  },

  async upsertSymbol(input, storage) {
    const name = input.name as string;
    const file = input.file as string;
    const line = input.line as number;
    if (!name) {
      return { variant: 'error', message: 'name is required' };
    }

    const id = `symbol:${name}:${file}:${line}`;
    const now = new Date().toISOString();

    await storage.put('symbols', id, {
      symbolName: name,
      symbolKind: (input.kind as string) || 'unknown',
      file: file || '',
      line: line || 0,
      scope: (input.scope as string) || '',
    });

    await storage.put('meta', 'symbols', {
      kind: 'symbols',
      lastUpdated: now,
    });

    return { variant: 'ok', index: id };
  },

  async upsertFile(input, storage) {
    const path = input.path as string;
    if (!path) {
      return { variant: 'error', message: 'path is required' };
    }

    const id = `file:${path}`;
    const now = new Date().toISOString();

    await storage.put('files', id, {
      filePath: path,
      language: (input.language as string) || 'unknown',
      role: (input.role as string) || 'source',
      definitions: (input.definitions as string[]) || [],
    });

    await storage.put('meta', 'files', {
      kind: 'files',
      lastUpdated: now,
    });

    return { variant: 'ok', index: id };
  },

  async removeByFile(input, storage) {
    const path = input.path as string;
    if (!path) {
      return { variant: 'ok', removed: 0 };
    }

    let removed = 0;

    // Remove file entry
    const fileId = `file:${path}`;
    const existing = await storage.get('files', fileId);
    if (existing) {
      await storage.del('files', fileId);
      removed++;
    }

    // Remove symbols from this file
    const symbols = await storage.find('symbols', { file: path });
    for (const sym of symbols) {
      const symId = `symbol:${sym.symbolName}:${sym.file}:${sym.line}`;
      await storage.del('symbols', symId);
      removed++;
    }

    // Remove concepts from this file
    const concepts = await storage.find('concepts', { file: path });
    for (const c of concepts) {
      const cId = `concept:${c.conceptName}`;
      await storage.del('concepts', cId);
      removed++;
    }

    // Remove syncs from this file
    const syncs = await storage.find('syncs', { file: path });
    for (const s of syncs) {
      const sId = `sync:${s.syncName}`;
      await storage.del('syncs', sId);
      removed++;
    }

    return { variant: 'ok', removed };
  },

  async clear(_input, storage) {
    const concepts = await storage.find('concepts');
    const syncs = await storage.find('syncs');
    const symbols = await storage.find('symbols');
    const files = await storage.find('files');

    const total = concepts.length + syncs.length + symbols.length + files.length;

    for (const c of concepts) await storage.del('concepts', `concept:${c.conceptName}`);
    for (const s of syncs) await storage.del('syncs', `sync:${s.syncName}`);
    for (const sym of symbols) await storage.del('symbols', `symbol:${sym.symbolName}:${sym.file}:${sym.line}`);
    for (const f of files) await storage.del('files', `file:${f.filePath}`);

    return { variant: 'ok', cleared: total };
  },

  async stats(_input, storage) {
    const concepts = await storage.find('concepts');
    const syncs = await storage.find('syncs');
    const symbols = await storage.find('symbols');
    const files = await storage.find('files');
    const meta = await storage.get('meta', 'concepts');

    return {
      variant: 'ok',
      conceptCount: concepts.length,
      syncCount: syncs.length,
      symbolCount: symbols.length,
      fileCount: files.length,
      lastUpdated: meta?.lastUpdated || new Date().toISOString(),
    };
  },
};
