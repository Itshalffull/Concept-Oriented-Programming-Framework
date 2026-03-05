import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

const REGISTRY_URL = process.env.CLEF_REGISTRY_URL ?? 'http://localhost:4002';

export const downloadProxyHandler: ConceptHandler = {
  async resolve(input: Record<string, unknown>, _storage: ConceptStorage) {
    const artifactId = input.artifact_id as string;
    const platform = input.platform as string;
    const versionRange = input.version_range as string;

    try {
      const res = await globalThis.fetch(
        `${REGISTRY_URL}/api/downloads/resolve/${artifactId}/${platform}?version_range=${encodeURIComponent(versionRange)}`,
      );
      if (!res.ok) {
        return { variant: 'notfound' };
      }
      const data = await res.json() as Record<string, unknown>;
      return { variant: 'ok', download: JSON.stringify(data) };
    } catch {
      return { variant: 'notfound' };
    }
  },
};
