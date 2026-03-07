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
    const schemas = (input.schemas as Array<{ name: string; concept: string; primary_set: string; manifest: string; fields: Array<{ name: string; type: string; from: string }> }>) ?? [];
    const compositions = (input.compositions as Array<{ source: string; target: string; rule_type: string }>) ?? [];
    const themes = (input.themes as Array<{ name: string; path: string; extends?: string }>) ?? [];

    const key = componentKey(module_id, version);

    await storage.put('components', key, {
      module_id,
      version,
      concepts,
      syncs,
      derived,
      widgets,
      handlers,
      schemas,
      compositions,
      themes,
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
      const widgets = (record.widgets as Array<{ name: string }>) ?? [];
      const schemas = (record.schemas as Array<{ name: string }>) ?? [];
      const themes = (record.themes as Array<{ name: string }>) ?? [];

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
      for (const w of widgets) {
        if (w.name.toLowerCase().includes(capLower)) {
          results.push({ module_id: mid, version: ver, match_type: 'widget', match_name: w.name });
        }
      }
      for (const sc of schemas) {
        if (sc.name.toLowerCase().includes(capLower)) {
          results.push({ module_id: mid, version: ver, match_type: 'schema', match_name: sc.name });
        }
      }
      for (const t of themes) {
        if (t.name.toLowerCase().includes(capLower)) {
          results.push({ module_id: mid, version: ver, match_type: 'theme', match_name: t.name });
        }
      }
    }

    if (results.length === 0) return { variant: 'empty' };
    return { variant: 'ok', results };
  },

  async searchBySchema(input: Record<string, unknown>, storage: ConceptStorage) {
    const schema_name = input.schema_name as string;
    const field_filter = input.field_filter as string;
    const schemaLower = schema_name.toLowerCase();
    const filterLower = field_filter ? field_filter.toLowerCase() : '';

    const allComponents = await storage.find('components');
    const results: Array<{ module_id: string; version: string; schema_name: string }> = [];

    for (const record of allComponents) {
      const mid = record.module_id as string;
      const ver = record.version as string;
      const schemas = (record.schemas as Array<{ name: string; fields: Array<{ name: string; type: string; from: string }> }>) ?? [];

      for (const sc of schemas) {
        const nameMatches = sc.name.toLowerCase().includes(schemaLower);
        if (!nameMatches) continue;

        if (filterLower) {
          const fieldMatches = sc.fields?.some(
            (f) => f.name.toLowerCase().includes(filterLower) || f.type.toLowerCase().includes(filterLower),
          );
          if (!fieldMatches) continue;
        }

        results.push({ module_id: mid, version: ver, schema_name: sc.name });
      }
    }

    if (results.length === 0) return { variant: 'empty' };
    return { variant: 'ok', results };
  },

  async searchByTheme(input: Record<string, unknown>, storage: ConceptStorage) {
    const theme_name = input.theme_name as string;
    const themeLower = theme_name.toLowerCase();

    const allComponents = await storage.find('components');
    const results: Array<{ module_id: string; version: string; theme_name: string }> = [];

    for (const record of allComponents) {
      const mid = record.module_id as string;
      const ver = record.version as string;
      const themes = (record.themes as Array<{ name: string }>) ?? [];

      for (const t of themes) {
        if (t.name.toLowerCase().includes(themeLower)) {
          results.push({ module_id: mid, version: ver, theme_name: t.name });
        }
      }
    }

    if (results.length === 0) return { variant: 'empty' };
    return { variant: 'ok', results };
  },
};
