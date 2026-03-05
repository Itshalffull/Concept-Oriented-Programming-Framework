import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

const REGISTRY_URL = process.env.CLEF_REGISTRY_URL ?? 'http://localhost:4002';

export const componentManifestProxyHandler: ConceptHandler = {
  async lookup(input: Record<string, unknown>, _storage: ConceptStorage) {
    const { module_id, version } = input;
    try {
      const res = await globalThis.fetch(
        `${REGISTRY_URL}/api/components/${module_id}/${version}`,
      );
      if (!res.ok) return { variant: 'notfound' };
      const data = await res.json();
      return { variant: 'ok', component: data };
    } catch (err) {
      return { variant: 'unavailable', message: String(err) };
    }
  },

  async search(input: Record<string, unknown>, _storage: ConceptStorage) {
    const { capability } = input;
    try {
      const res = await globalThis.fetch(
        `${REGISTRY_URL}/api/components/search?capability=${encodeURIComponent(String(capability))}`,
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
