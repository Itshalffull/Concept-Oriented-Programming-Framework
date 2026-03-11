import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

const registryUrl = process.env.CLEF_REGISTRY_URL ?? 'http://localhost:4002';

export const registryProxyHandler: ConceptHandler = {
  async resolve(input: Record<string, unknown>, _storage: ConceptStorage) {
    const { artifact_id, platform, version_range } = input as {
      artifact_id: string; platform: string; version_range: string;
    };

    try {
      const res = await globalThis.fetch(
        `${registryUrl}/api/downloads/resolve/${artifact_id}/${platform}?version_range=${encodeURIComponent(version_range)}`,
      );
      if (!res.ok) return { variant: 'notfound', artifact_id };

      const data = await res.json();
      return {
        variant: 'ok',
        download_url: data.artifact_url,
        version: data.version,
        content_hash: data.content_hash,
        size_bytes: data.size_bytes,
      };
    } catch (err) {
      return { variant: 'unavailable', message: String(err) };
    }
  },

  async fetchReadme(input: Record<string, unknown>, _storage: ConceptStorage) {
    const { module_id, version } = input as { module_id: string; version: string };

    try {
      const res = await globalThis.fetch(
        `${registryUrl}/api/registry/packages/${module_id}/${version}/readme`,
      );
      if (!res.ok) return { variant: 'notfound', module_id, version };

      const data = await res.json();
      return { variant: 'ok', readme: data.readme };
    } catch (err) {
      return { variant: 'unavailable', message: String(err) };
    }
  },

  async versions(input: Record<string, unknown>, _storage: ConceptStorage) {
    const { name, namespace } = input as { name: string; namespace: string };

    try {
      const res = await globalThis.fetch(
        `${registryUrl}/api/registry/packages/${namespace}/${name}/versions`,
      );
      if (!res.ok) return { variant: 'notfound', name, namespace };

      const data = await res.json();
      return { variant: 'ok', versions: data.versions };
    } catch (err) {
      return { variant: 'unavailable', message: String(err) };
    }
  },
};
