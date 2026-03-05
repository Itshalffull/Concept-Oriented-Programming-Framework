import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

function downloadKey(artifact_id: string, platform: string, version: string): string {
  return `${artifact_id}:${platform}:${version}`;
}

export const downloadHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const artifact_id = input.artifact_id as string;
    const platform = input.platform as string;
    const version = input.version as string;
    const content_hash = input.content_hash as string;
    const artifact_url = input.artifact_url as string;
    const size_bytes = input.size_bytes as number;

    const key = downloadKey(artifact_id, platform, version);
    const existing = await storage.get('downloads', key);
    if (existing) {
      return { variant: 'exists' };
    }

    await storage.put('downloads', key, {
      artifact_id,
      platform,
      version,
      content_hash,
      artifact_url,
      size_bytes,
      download_count: 0,
      yanked: false,
      registered_at: new Date().toISOString(),
    });

    return { variant: 'ok', download: key };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const artifact_id = input.artifact_id as string;
    const platform = input.platform as string;

    const allDownloads = await storage.find('downloads', { artifact_id, platform });
    const active = allDownloads.filter((r) => !(r.yanked as boolean));

    if (active.length === 0) return { variant: 'notfound' };

    // Pick the highest version (simple string comparison)
    active.sort((a, b) => (a.version as string) > (b.version as string) ? -1 : 1);
    const best = active[0];
    const bestKey = downloadKey(
      best.artifact_id as string,
      best.platform as string,
      best.version as string,
    );

    // Increment download count
    await storage.put('downloads', bestKey, {
      ...best,
      download_count: (best.download_count as number) + 1,
    });

    return { variant: 'ok', download: bestKey };
  },

  async yank(input: Record<string, unknown>, storage: ConceptStorage) {
    const download = input.download as string;

    const record = await storage.get('downloads', download);
    if (!record) return { variant: 'notfound' };
    if (record.yanked as boolean) return { variant: 'already_yanked' };

    await storage.put('downloads', download, { ...record, yanked: true });
    return { variant: 'ok' };
  },

  async stats(input: Record<string, unknown>, storage: ConceptStorage) {
    const artifact_id = input.artifact_id as string;

    const allDownloads = await storage.find('downloads', { artifact_id });
    if (allDownloads.length === 0) return { variant: 'notfound' };

    const byPlatform = new Map<string, number>();
    let total = 0;
    for (const record of allDownloads) {
      const count = record.download_count as number;
      const plat = record.platform as string;
      total += count;
      byPlatform.set(plat, (byPlatform.get(plat) ?? 0) + count);
    }

    return {
      variant: 'ok',
      total_downloads: total,
      by_platform: [...byPlatform].map(([platform, count]) => ({ platform, count })),
    };
  },
};
