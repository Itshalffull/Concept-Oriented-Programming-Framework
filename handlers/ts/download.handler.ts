// @clef-handler style=functional
// ============================================================
// Download Handler
//
// Per-platform binary artifact distribution. Tracks downloadable
// artifacts by platform and version, maintains download counts,
// and supports yanking artifacts from distribution while
// preserving existing installations.
// See Architecture doc Section 16.11.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function downloadKey(artifactId: string, platform: string, version: string): string {
  return `${artifactId}::${platform}::${version}`;
}

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const artifactId = (input.artifact_id as string) || '';
    const platform = (input.platform as string) || '';
    const version = (input.version as string) || '';
    const contentHash = (input.content_hash as string) || '';
    const artifactUrl = (input.artifact_url as string) || '';
    const sizeBytes = (input.size_bytes as number) ?? 0;

    if (!artifactId || artifactId.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'artifact_id is required' }) as StorageProgram<Result>;
    }
    if (!platform || platform.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'platform is required' }) as StorageProgram<Result>;
    }
    if (!version || version.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'version is required' }) as StorageProgram<Result>;
    }

    const key = downloadKey(artifactId, platform, version);
    let p = createProgram();
    p = get(p, 'download', key, 'existing');

    return branch(p, 'existing',
      // Already exists — duplicate
      (b) => complete(b, 'duplicate', {}) as StorageProgram<Result>,
      // New registration
      (b) => {
        const now = new Date().toISOString();
        let b2 = put(b, 'download', key, {
          id: key,
          artifact_id: artifactId,
          platform,
          version,
          content_hash: contentHash,
          artifact_url: artifactUrl,
          size_bytes: sizeBytes,
          download_count: 0,
          yanked: false,
          registered_at: now,
        });
        return complete(b2, 'ok', { download: key }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const artifactId = (input.artifact_id as string) || '';
    const platform = (input.platform as string) || '';
    // version_range is used to filter (simplified: we find latest non-yanked)

    if (!artifactId || artifactId.trim() === '') {
      return complete(createProgram(), 'notfound', {}) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'download', {}, 'all');
    p = mapBindings(p, (bindings) => {
      const all = (bindings.all as Array<Record<string, unknown>>) || [];
      const candidates = all.filter(d =>
        d.artifact_id === artifactId &&
        d.platform === platform,
      );
      // Sort by version descending (numeric-aware)
      candidates.sort((a, b) => {
        const av = a.version as string;
        const bv = b.version as string;
        return bv.localeCompare(av, undefined, { numeric: true });
      });
      const best = candidates.find(d => !d.yanked) || null;
      const yankedOnly = !best && candidates.length > 0 ? candidates[0] : null;
      return { best, yankedOnly };
    }, '_resolved');

    return branch(p, (b) => !!(b._resolved as { best: unknown } | null)?.best,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const resolved = bindings._resolved as { best: Record<string, unknown> };
        return { download: resolved.best.id };
      }) as StorageProgram<Result>,
      (b) => completeFrom(b, 'notfound', (bindings) => {
        const resolved = bindings._resolved as { yankedOnly: Record<string, unknown> | null };
        if (resolved.yankedOnly) {
          return { _variant: 'yanked', download: resolved.yankedOnly.id };
        }
        return {};
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  yank(input: Record<string, unknown>) {
    const download = (input.download as string) || '';

    if (!download || download.trim() === '') {
      return complete(createProgram(), 'notfound', {}) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'download', download, 'existing');

    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'download', download, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return { ...existing, yanked: true };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          if (existing.yanked === true) {
            return { _variant: 'already_yanked' };
          }
          return {};
        }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', {}) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  stats(input: Record<string, unknown>) {
    const artifactId = (input.artifact_id as string) || '';

    if (!artifactId || artifactId.trim() === '') {
      return complete(createProgram(), 'notfound', {}) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'download', {}, 'all');
    p = mapBindings(p, (bindings) => {
      const all = (bindings.all as Array<Record<string, unknown>>) || [];
      const matching = all.filter(d => d.artifact_id === artifactId);
      if (matching.length === 0) return null;

      const totalDownloads = matching.reduce((acc, d) => acc + ((d.download_count as number) || 0), 0);

      const platformMap = new Map<string, number>();
      const versionMap = new Map<string, number>();
      for (const d of matching) {
        const plat = d.platform as string;
        const ver = d.version as string;
        const cnt = (d.download_count as number) || 0;
        platformMap.set(plat, (platformMap.get(plat) || 0) + cnt);
        versionMap.set(ver, (versionMap.get(ver) || 0) + cnt);
      }

      const byPlatform = Array.from(platformMap.entries()).map(([platform, count]) => ({ platform, count }));
      const byVersion = Array.from(versionMap.entries()).map(([version, count]) => ({ version, count }));

      return { totalDownloads, byPlatform, byVersion };
    }, '_stats');

    return branch(p, (b) => b._stats !== null && b._stats !== undefined,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const stats = bindings._stats as { totalDownloads: number; byPlatform: unknown[]; byVersion: unknown[] };
        return {
          total_downloads: stats.totalDownloads,
          by_platform: stats.byPlatform,
          by_version: stats.byVersion,
        };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', {}) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },
};

export const downloadHandler = autoInterpret(_handler);
