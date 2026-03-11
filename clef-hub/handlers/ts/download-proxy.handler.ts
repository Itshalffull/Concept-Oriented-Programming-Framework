import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

const REGISTRY_URL = process.env.CLEF_REGISTRY_URL ?? 'http://localhost:4002';

export const downloadProxyHandler: ConceptHandler = {
  async resolve(input: Record<string, unknown>, _storage: ConceptStorage) {
    const { artifact_id, platform, version_range } = input;
    try {
      const res = await globalThis.fetch(
        `${REGISTRY_URL}/api/downloads/resolve/${artifact_id}/${platform}?version_range=${encodeURIComponent(String(version_range))}`,
      );
      if (!res.ok) return { variant: 'notfound' };
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

  async stats(input: Record<string, unknown>, _storage: ConceptStorage) {
    const { artifact_id } = input;
    try {
      const res = await globalThis.fetch(
        `${REGISTRY_URL}/api/downloads/stats/${artifact_id}`,
      );
      if (!res.ok) return { variant: 'notfound' };
      const data = await res.json();
      return {
        variant: 'ok',
        total_downloads: data.total_downloads,
        by_platform: data.by_platform,
      };
    } catch (err) {
      return { variant: 'unavailable', message: String(err) };
    }
  },
};
