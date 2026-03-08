import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

const REGISTRY_URL = process.env.CLEF_REGISTRY_URL ?? 'http://localhost:4002';

export const schemaProxyHandler: ConceptHandler = {
  async lookupSchemas(input: Record<string, unknown>, _storage: ConceptStorage) {
    const { module_id, version } = input;
    try {
      const res = await globalThis.fetch(
        `${REGISTRY_URL}/api/components/${module_id}/${version}/schemas`,
      );
      if (!res.ok) return { variant: 'notfound' };
      const data = await res.json();
      if (!data.schemas?.length) return { variant: 'notfound' };
      return { variant: 'ok', schemas: data.schemas };
    } catch (err) {
      return { variant: 'unavailable', message: String(err) };
    }
  },

  async searchBySchema(input: Record<string, unknown>, _storage: ConceptStorage) {
    const { query, field_filter } = input;
    try {
      const params = new URLSearchParams();
      params.set('query', String(query));
      if (field_filter) params.set('field_filter', String(field_filter));
      const res = await globalThis.fetch(
        `${REGISTRY_URL}/api/components/schemas/search?${params.toString()}`,
      );
      if (!res.ok) return { variant: 'empty' };
      const data = await res.json();
      if (!data.results?.length) return { variant: 'empty' };
      return { variant: 'ok', results: data.results };
    } catch (err) {
      return { variant: 'unavailable', message: String(err) };
    }
  },
};
