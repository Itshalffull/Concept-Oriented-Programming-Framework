// @clef-handler style=imperative
// @migrated dsl-constructs 2026-03-18
// ============================================================
// SearchSpace Handler
//
// Scoped overlay indexes that layer on top of base search indexes.
// Enables version spaces, groups, and tenants to have independent
// search state without polluting shared indexes.
//
// Uses imperative style because index/tombstone need dynamic storage
// keys derived from find results.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.ts';

type Result = { variant: string; [key: string]: unknown };

function entryId(scope_id: string, provider: string, entity_id: string): string {
  return `ssi-${scope_id}-${provider}-${entity_id}`;
}

const handler: ConceptHandler = {
  async index(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const scope_id = input.scope_id as string;
    const provider = input.provider as string;
    const entity_id = input.entity_id as string;
    const data = input.data as string;

    // Ensure scope exists
    const existingScope = await storage.get('scopes', scope_id);
    if (!existingScope) {
      await storage.put('scopes', scope_id, { id: scope_id, created: new Date().toISOString() });
    }

    // Check for existing entry
    const existingEntries = await storage.find('index_entries', {
      entry_scope: scope_id,
      entry_provider: provider,
      entry_entity_id: entity_id,
    });

    if (existingEntries.length > 0) {
      // Update existing entry
      const entry = existingEntries[0];
      const entryId = entry.id as string;
      await storage.put('index_entries', entryId, {
        ...entry,
        entry_data: data,
        entry_operation: 'index',
      });
      return { variant: 'ok', entry: entryId };
    }

    // Create new entry
    const entryId = nextId('ssi');
    await storage.put('index_entries', entryId, {
      id: entryId,
      entry_scope: scope_id,
      entry_provider: provider,
      entry_entity_id: entity_id,
      entry_data: data,
      entry_operation: 'index',
    });
    return { variant: 'ok', entry: entryId };
  },

  async tombstone(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const scope_id = input.scope_id as string;
    const provider = input.provider as string;
    const entity_id = input.entity_id as string;

    // Ensure scope exists
    const existingScope = await storage.get('scopes', scope_id);
    if (!existingScope) {
      await storage.put('scopes', scope_id, { id: scope_id, created: new Date().toISOString() });
    }

    // Check for existing entry
    const existingEntries = await storage.find('index_entries', {
      entry_scope: scope_id,
      entry_provider: provider,
      entry_entity_id: entity_id,
    });

    if (existingEntries.length > 0) {
      // Update existing entry to tombstone
      const entry = existingEntries[0];
      const entryId = entry.id as string;
      await storage.put('index_entries', entryId, {
        ...entry,
        entry_operation: 'tombstone',
      });
      return { variant: 'ok', entry: entryId };
    }

    // Create new tombstone entry
    const entryId = nextId('ssi');
    await storage.put('index_entries', entryId, {
      id: entryId,
      entry_scope: scope_id,
      entry_provider: provider,
      entry_entity_id: entity_id,
      entry_data: '',
      entry_operation: 'tombstone',
    });
    return { variant: 'ok', entry: entryId };
  },

  async query(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const scope_id = input.scope_id as string;
    const provider = input.provider as string;
    const query_expr = input.query_expr as string;

    const scope = await storage.get('scopes', scope_id);
    if (!scope) {
      return { variant: 'no_scope', scope_id };
    }

    const entries = await storage.find('index_entries', {
      entry_scope: scope_id,
      entry_provider: provider,
    });

    const results: string[] = [];
    const tombstoned = new Set<string>();

    for (const entry of entries) {
      if (entry.entry_operation === 'tombstone') {
        tombstoned.add(entry.entry_entity_id as string);
      }
    }

    for (const entry of entries) {
      if (entry.entry_operation === 'index' &&
          !tombstoned.has(entry.entry_entity_id as string)) {
        const data = entry.entry_data as string;
        if (data.toLowerCase().includes(query_expr.toLowerCase())) {
          results.push(entry.entry_entity_id as string);
        }
      }
    }

    return { variant: 'ok', results };
  },

  async clear(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const scope_id = input.scope_id as string;

    // Delete all entries for this scope
    const entries = await storage.find('index_entries', { entry_scope: scope_id });
    for (const entry of entries) {
      await storage.del('index_entries', entry.id as string);
    }

    // Delete the scope itself
    await storage.del('scopes', scope_id);

    return { variant: 'ok' };
  },

  async materialize(input: Record<string, unknown>, storage: ConceptStorage): Promise<Result> {
    const scope_id = input.scope_id as string;

    const entries = await storage.find('index_entries', { entry_scope: scope_id });
    let count = 0;
    for (const entry of entries) {
      if (entry.entry_operation === 'index') {
        count++;
      }
    }

    // Clear scope and entries after materialization
    for (const entry of entries) {
      await storage.del('index_entries', entry.id as string);
    }
    await storage.del('scopes', scope_id);

    return { variant: 'ok', count };
  },
};

export const searchSpaceHandler = handler;

export default searchSpaceHandler;
