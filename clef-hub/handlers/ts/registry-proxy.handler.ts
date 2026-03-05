import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

const REGISTRY_URL = process.env.CLEF_REGISTRY_URL ?? 'http://localhost:4002';

export const registryProxyHandler: ConceptHandler = {
  async search(input: Record<string, unknown>, _storage: ConceptStorage) {
    const { query } = input;
    try {
      const res = await globalThis.fetch(
        `${REGISTRY_URL}/api/registry/search?query=${encodeURIComponent(String(query))}`,
      );
      if (!res.ok) return { variant: 'empty' };
      const data = await res.json();
      if (!data.results?.length) return { variant: 'empty' };
      return { variant: 'ok', results: data.results };
    } catch (err) {
      return { variant: 'unavailable', message: String(err) };
    }
  },

  async lookup(input: Record<string, unknown>, _storage: ConceptStorage) {
    const { name, namespace, version } = input;
    try {
      const res = await globalThis.fetch(
        `${REGISTRY_URL}/api/registry/packages/${namespace}/${name}/${version}`,
      );
      if (!res.ok) return { variant: 'notfound' };
      const data = await res.json();
      return { variant: 'ok', module: data };
    } catch (err) {
      return { variant: 'unavailable', message: String(err) };
    }
  },

  async versions(input: Record<string, unknown>, _storage: ConceptStorage) {
    const { name, namespace } = input;
    try {
      const res = await globalThis.fetch(
        `${REGISTRY_URL}/api/registry/packages/${namespace}/${name}/versions`,
      );
      if (!res.ok) return { variant: 'notfound' };
      const data = await res.json();
      return { variant: 'ok', versions: data.versions };
    } catch (err) {
      return { variant: 'unavailable', message: String(err) };
    }
  },
};
