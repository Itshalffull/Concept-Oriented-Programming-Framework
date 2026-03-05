import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

function componentKey(module_id: string, version: string): string {
  return `${module_id}@${version}`;
}

export const componentManifestHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const module_id = input.module_id as string;
    const version = input.version as string;
    const concepts = (input.concepts as Array<{ name: string; spec_path: string; type_params: string[] }>) ?? [];
    const syncs = (input.syncs as Array<{ name: string; path: string; annotation: string }>) ?? [];
    const derived = (input.derived as Array<{ name: string; path: string; composes: string[] }>) ?? [];
    const widgets = (input.widgets as Array<{ name: string; path: string; concept: string; provider: string }>) ?? [];
    const handlers = (input.handlers as Array<{ name: string; path: string; language: string; concept: string }>) ?? [];

    const key = componentKey(module_id, version);

    await storage.put('components', key, {
      module_id,
      version,
      concepts,
      syncs,
      derived,
      widgets,
      handlers,
      registered_at: new Date().toISOString(),
    });

    return { variant: 'ok', component: key };
  },

  async lookup(input: Record<string, unknown>, storage: ConceptStorage) {
    const module_id = input.module_id as string;
    const version = input.version as string;

    const key = componentKey(module_id, version);
    const record = await storage.get('components', key);
    if (!record) return { variant: 'notfound' };
    return { variant: 'ok', component: record };
  },

  async search(input: Record<string, unknown>, storage: ConceptStorage) {
    const capability = input.capability as string;
    const capLower = capability.toLowerCase();

    const allComponents = await storage.find('components');
    const results: Array<{ module_id: string; version: string; match_type: string; match_name: string }> = [];

    for (const record of allComponents) {
      const mid = record.module_id as string;
      const ver = record.version as string;
      const concepts = (record.concepts as Array<{ name: string }>) ?? [];
      const syncs = (record.syncs as Array<{ name: string }>) ?? [];
      const derived = (record.derived as Array<{ name: string }>) ?? [];

      for (const c of concepts) {
        if (c.name.toLowerCase().includes(capLower)) {
          results.push({ module_id: mid, version: ver, match_type: 'concept', match_name: c.name });
        }
      }
      for (const s of syncs) {
        if (s.name.toLowerCase().includes(capLower)) {
          results.push({ module_id: mid, version: ver, match_type: 'sync', match_name: s.name });
        }
      }
      for (const d of derived) {
        if (d.name.toLowerCase().includes(capLower)) {
          results.push({ module_id: mid, version: ver, match_type: 'derived', match_name: d.name });
        }
      }
    }

    if (results.length === 0) return { variant: 'empty' };
    return { variant: 'ok', results };
  },
};
