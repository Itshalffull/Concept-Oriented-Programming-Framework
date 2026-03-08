import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

const HUB_URL = process.env.CLEF_HUB_URL ?? 'http://localhost:4003';

export const hubProxyHandler: ConceptHandler = {
  async search(input: Record<string, unknown>, _storage: ConceptStorage) {
    const query = input.query as string;
    const kind = (input.kind as string) || 'all';
    try {
      const url = `${HUB_URL}/api/hub/search?query=${encodeURIComponent(query)}&kind=${encodeURIComponent(kind)}`;
      const res = await globalThis.fetch(url);
      if (!res.ok) return { variant: 'empty' };
      const data = await res.json();
      if (!data.results?.length) return { variant: 'empty' };
      return { variant: 'ok', results: data.results };
    } catch (err) {
      return { variant: 'unavailable', message: String(err) };
    }
  },

  async preview(input: Record<string, unknown>, _storage: ConceptStorage) {
    const packageName = input.package_name as string;
    const version = input.version as string;
    try {
      const url = `${HUB_URL}/api/hub/packages/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}/preview`;
      const res = await globalThis.fetch(url);
      if (!res.ok) return { variant: 'notfound', package_name: packageName };
      const data = await res.json();
      return {
        variant: 'ok',
        manifest: JSON.stringify(data.manifest || {}),
        dependencies: data.dependencies || [],
        concepts: data.concepts || [],
        syncs: data.syncs || [],
        widgets: data.widgets || [],
      };
    } catch (err) {
      return { variant: 'unavailable', message: String(err) };
    }
  },

  async download(input: Record<string, unknown>, _storage: ConceptStorage) {
    const packageName = input.package_name as string;
    const version = input.version as string;
    try {
      const url = `${HUB_URL}/api/hub/packages/${encodeURIComponent(packageName)}/${encodeURIComponent(version)}/download`;
      const res = await globalThis.fetch(url);
      if (!res.ok) return { variant: 'notfound', package_name: packageName };
      const data = await res.json();
      return {
        variant: 'ok',
        content: data.content || '',
        content_hash: data.content_hash || '',
      };
    } catch (err) {
      return { variant: 'unavailable', message: String(err) };
    }
  },
};
