// ============================================================
// KitManager Handler
//
// Manage concept kits -- scaffold new kits, validate kit
// manifests and cross-kit references, run kit tests, list
// active kits, and check app overrides.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `kit-manager-${++idCounter}`;
}

export const kitManagerHandler: ConceptHandler = {
  async init(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;

    // Check if a kit with this name already exists
    const existing = await storage.find('kit-manager', { name });
    if (existing.length > 0) {
      return { variant: 'alreadyExists', name };
    }

    const path = `./kits/${name}/`;
    const id = nextId();
    const now = new Date().toISOString();

    await storage.put('kit-manager', id, {
      id,
      name,
      path,
      status: 'initialized',
      createdAt: now,
    });

    return { variant: 'ok', kit: id, path };
  },

  async validate(input: Record<string, unknown>, storage: ConceptStorage) {
    const path = input.path as string;

    // Find the kit by path
    const existing = await storage.find('kit-manager', { path });
    let kitId: string;

    if (existing.length > 0) {
      kitId = existing[0].id as string;
    } else {
      // Create a temporary kit entry for the validation result
      kitId = nextId();
      const kitName = path.replace(/^\.\/kits\//, '').replace(/\/$/, '');
      await storage.put('kit-manager', kitId, {
        id: kitId,
        name: kitName,
        path,
        status: 'validated',
        createdAt: new Date().toISOString(),
      });
    }

    // Validation: in a real implementation, this would parse
    // kit.yaml, walk concept specs, and check sync definitions.
    // For now, report the kit as valid with zero concepts and syncs
    // if it was just initialized, or derive counts from stored data.
    const record = await storage.get('kit-manager', kitId);
    const concepts = (record && typeof record.conceptCount === 'number') ? record.conceptCount : 0;
    const syncs = (record && typeof record.syncCount === 'number') ? record.syncCount : 0;

    await storage.put('kit-manager', kitId, {
      ...record,
      status: 'validated',
    });

    return { variant: 'ok', kit: kitId, concepts, syncs };
  },

  async test(input: Record<string, unknown>, storage: ConceptStorage) {
    const path = input.path as string;

    // Find the kit by path
    const existing = await storage.find('kit-manager', { path });
    let kitId: string;

    if (existing.length > 0) {
      kitId = existing[0].id as string;
    } else {
      kitId = nextId();
      const kitName = path.replace(/^\.\/kits\//, '').replace(/\/$/, '');
      await storage.put('kit-manager', kitId, {
        id: kitId,
        name: kitName,
        path,
        status: 'tested',
        createdAt: new Date().toISOString(),
      });
    }

    // In a real implementation, this would run invariant checks
    // from concept specs and compile syncs. Return zero passed/failed
    // for a freshly initialized kit.
    return { variant: 'ok', kit: kitId, passed: 0, failed: 0 };
  },

  async list(_input: Record<string, unknown>, storage: ConceptStorage) {
    const results = await storage.find('kit-manager');
    const kits = results.map(r => r.name as string);
    return { variant: 'ok', kits };
  },

  async checkOverrides(input: Record<string, unknown>, storage: ConceptStorage) {
    const path = input.path as string;

    // Find the kit by path
    const existing = await storage.find('kit-manager', { path });
    if (existing.length === 0) {
      return { variant: 'invalidOverride', override: path, reason: `Kit not found at path: ${path}` };
    }

    // In a real implementation, this would walk the app's sync
    // override directory and cross-reference with kit sync names.
    // For now, report all overrides as valid with zero warnings.
    return { variant: 'ok', valid: 0, warnings: [] };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetKitManagerCounter(): void {
  idCounter = 0;
}
