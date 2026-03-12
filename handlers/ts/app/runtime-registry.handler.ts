// ============================================================
// RuntimeRegistry Concept Implementation
//
// Tracks what concepts and syncs are actually registered and
// running in the kernel. The kernel populates this during boot.
// Answers "is concept X loaded?" and "what syncs are active?"
// ============================================================

import type { ConceptHandler, ConceptStorage } from '@clef/runtime';

export const runtimeRegistryHandler: ConceptHandler = {
  async registerConcept(input, storage) {
    const uri = input.uri as string;
    const hasStorage = input.has_storage as boolean;
    const storageName = input.storage_name as string ?? '';
    const storageType = input.storage_type as string ?? 'standard';

    const existing = await storage.get('concept', uri);
    if (existing) {
      return { variant: 'already_registered' };
    }

    await storage.put('concept', uri, {
      id: uri,
      uri,
      has_storage: hasStorage,
      storage_name: storageName,
      storage_type: storageType,
      registered_at: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async registerSync(input, storage) {
    const syncName = input.sync_name as string;
    const source = input.source as string;
    const suite = (input.suite as string) ?? '';

    const existing = await storage.get('sync', syncName);
    if (existing) {
      return { variant: 'already_registered' };
    }

    await storage.put('sync', syncName, {
      id: syncName,
      sync_name: syncName,
      source,
      suite,
      registered_at: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async getConcept(input, storage) {
    const uri = input.uri as string;
    const concept = await storage.get('concept', uri);
    if (!concept) return { variant: 'notfound' };
    return { variant: 'ok', concept: JSON.stringify(concept) };
  },

  async listConcepts(_input, storage) {
    const concepts = await storage.find('concept', {});
    return { variant: 'ok', concepts: JSON.stringify(concepts) };
  },

  async listSyncs(_input, storage) {
    const syncs = await storage.find('sync', {});
    return { variant: 'ok', syncs: JSON.stringify(syncs) };
  },

  async isLoaded(input, storage) {
    const uri = input.uri as string;
    const concept = await storage.get('concept', uri);
    return { variant: 'ok', loaded: !!concept };
  },
};
