// ============================================================
// SearchSpace Handler
//
// Scoped overlay indexes that layer on top of base search indexes.
// Enables version spaces, groups, and tenants to have independent
// search state without polluting shared indexes.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`;
}

export const searchSpaceHandler: ConceptHandler = {
  async index(input: Record<string, unknown>, storage: ConceptStorage) {
    const scope_id = input.scope_id as string;
    const provider = input.provider as string;
    const entity_id = input.entity_id as string;
    const data = input.data as string;

    // Ensure scope exists
    let scope = await storage.get('scopes', scope_id);
    if (!scope) {
      await storage.put('scopes', scope_id, {
        id: scope_id,
        scope_id,
        scope_type: 'version_space',
        scope_parent: null,
      });
    }

    // Check for existing entry and update if found
    const existingEntries = await storage.find('index_entries', {
      entry_scope: scope_id,
      entry_provider: provider,
      entry_entity_id: entity_id,
    });

    if (existingEntries.length > 0) {
      const existing = existingEntries[0];
      await storage.put('index_entries', existing.id as string, {
        ...existing,
        entry_operation: 'index',
        entry_data: data,
      });
      return { variant: 'ok', entry: existing.id as string };
    }

    const entryId = nextId('ssi');
    await storage.put('index_entries', entryId, {
      id: entryId,
      entry_scope: scope_id,
      entry_provider: provider,
      entry_entity_id: entity_id,
      entry_operation: 'index',
      entry_data: data,
    });

    return { variant: 'ok', entry: entryId };
  },

  async tombstone(input: Record<string, unknown>, storage: ConceptStorage) {
    const scope_id = input.scope_id as string;
    const provider = input.provider as string;
    const entity_id = input.entity_id as string;

    // Check for existing entry and update to tombstone
    const existingEntries = await storage.find('index_entries', {
      entry_scope: scope_id,
      entry_provider: provider,
      entry_entity_id: entity_id,
    });

    if (existingEntries.length > 0) {
      const existing = existingEntries[0];
      await storage.put('index_entries', existing.id as string, {
        ...existing,
        entry_operation: 'tombstone',
        entry_data: '',
      });
      return { variant: 'ok', entry: existing.id as string };
    }

    const entryId = nextId('ssi');
    await storage.put('index_entries', entryId, {
      id: entryId,
      entry_scope: scope_id,
      entry_provider: provider,
      entry_entity_id: entity_id,
      entry_operation: 'tombstone',
      entry_data: '',
    });

    return { variant: 'ok', entry: entryId };
  },

  async query(input: Record<string, unknown>, storage: ConceptStorage) {
    const scope_id = input.scope_id as string;
    const provider = input.provider as string;
    const query_expr = input.query_expr as string;

    // Check scope exists
    const scope = await storage.get('scopes', scope_id);
    if (!scope) {
      return { variant: 'no_scope', scope_id };
    }

    // Get all overlay entries for this scope and provider
    const entries = await storage.find('index_entries', {
      entry_scope: scope_id,
      entry_provider: provider,
    });

    // Collect results: indexed entries that match, exclude tombstoned
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
        // Simple text matching for the overlay
        const data = entry.entry_data as string;
        if (data.toLowerCase().includes(query_expr.toLowerCase())) {
          results.push(entry.entry_entity_id as string);
        }
      }
    }

    // Walk parent scopes for nested overlay merging
    if (scope.scope_parent) {
      const parentResults = await this.query(
        { scope_id: scope.scope_parent, provider, query_expr },
        storage,
      );
      if (parentResults.variant === 'ok') {
        for (const r of parentResults.results as string[]) {
          if (!tombstoned.has(r) && !results.includes(r)) {
            results.push(r);
          }
        }
      }
    }

    return { variant: 'ok', results };
  },

  async clear(input: Record<string, unknown>, storage: ConceptStorage) {
    const scope_id = input.scope_id as string;

    const entries = await storage.find('index_entries', {
      entry_scope: scope_id,
    });

    for (const entry of entries) {
      await storage.del('index_entries', entry.id as string);
    }

    // Remove scope
    await storage.del('scopes', scope_id);

    return { variant: 'ok' };
  },

  async materialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const scope_id = input.scope_id as string;

    const entries = await storage.find('index_entries', {
      entry_scope: scope_id,
    });

    let count = 0;
    for (const entry of entries) {
      if (entry.entry_operation === 'index') {
        // In a full implementation, each entry would dispatch to its
        // provider's base-index write action. Here we count them.
        count++;
      }
    }

    // Clear after materialization
    await this.clear({ scope_id }, storage);

    return { variant: 'ok', count };
  },
};

export default searchSpaceHandler;
