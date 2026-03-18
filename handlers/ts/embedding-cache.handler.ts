// ============================================================
// EmbeddingCache Handler (Imperative)
//
// File-backed, content-addressed embedding vector cache that
// persists across MCP server restarts. Uses content digests as
// cache keys so only changed entities trigger recomputation.
//
// Imperative style: requires direct filesystem access for
// reading/writing the cache manifest file, incompatible with
// the StorageProgram monad.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

const ENTRIES_RELATION = 'embedding-cache';

// ---------------------------------------------------------------------------
// Cache manifest file schema
// ---------------------------------------------------------------------------

interface CacheManifestEntry {
  digest: string;
  vector: string;
  model: string;
  dimensions: number;
  sourceKind: string;
  sourceKey: string;
  cachedAt: string;
}

interface CacheManifest {
  version: 1;
  manifestDigest: string;
  entries: Record<string, CacheManifestEntry>;
}

/** Compute a simple hash of sorted entry digests for fast staleness check. */
function computeManifestDigest(entries: Record<string, CacheManifestEntry>): string {
  const keys = Object.keys(entries).sort();
  let h = 0;
  for (const k of keys) {
    for (let i = 0; i < k.length; i++) {
      h = (Math.imul(31, h) + k.charCodeAt(i)) | 0;
    }
  }
  return (h >>> 0).toString(16);
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export const embeddingCacheHandler: ConceptHandler = {

  async warm(input: Record<string, unknown>, storage: ConceptStorage) {
    const cachePath = input.path as string;

    let fs: typeof import('fs');
    try {
      fs = await import('fs');
    } catch {
      return { variant: 'corrupt', reason: 'Filesystem module unavailable' };
    }

    if (!fs.existsSync(cachePath)) {
      return { variant: 'fileNotFound', path: cachePath };
    }

    let raw: string;
    try {
      raw = fs.readFileSync(cachePath, 'utf-8');
    } catch (err) {
      return { variant: 'corrupt', reason: `Read error: ${err instanceof Error ? err.message : String(err)}` };
    }

    let manifest: CacheManifest;
    try {
      manifest = JSON.parse(raw);
    } catch {
      return { variant: 'corrupt', reason: 'Invalid JSON in cache manifest' };
    }

    if (!manifest || manifest.version !== 1 || typeof manifest.entries !== 'object') {
      return { variant: 'corrupt', reason: 'Unrecognized manifest schema (expected version 1)' };
    }

    let loaded = 0;
    let skipped = 0;

    for (const [digest, entry] of Object.entries(manifest.entries)) {
      // Validate entry has required fields
      if (!entry.vector || !entry.model || typeof entry.dimensions !== 'number') {
        skipped++;
        continue;
      }

      // Validate vector is parseable JSON array
      try {
        const vec = JSON.parse(entry.vector);
        if (!Array.isArray(vec)) {
          skipped++;
          continue;
        }
      } catch {
        skipped++;
        continue;
      }

      await storage.put(ENTRIES_RELATION, digest, {
        id: digest,
        digest,
        vector: entry.vector,
        model: entry.model,
        dimensions: entry.dimensions,
        sourceKind: entry.sourceKind || 'unknown',
        sourceKey: entry.sourceKey || 'unknown',
        cachedAt: entry.cachedAt || new Date().toISOString(),
      });
      loaded++;
    }

    return { variant: 'ok', loaded, skipped };
  },

  async lookup(input: Record<string, unknown>, storage: ConceptStorage) {
    const digest = input.digest as string;

    const record = await storage.get(ENTRIES_RELATION, digest);
    if (!record) {
      return { variant: 'miss' };
    }

    return {
      variant: 'hit',
      vector: record.vector as string,
      model: record.model as string,
      dimensions: record.dimensions as number,
      sourceKind: record.sourceKind as string,
      sourceKey: record.sourceKey as string,
    };
  },

  async put(input: Record<string, unknown>, storage: ConceptStorage) {
    const digest = input.digest as string;
    const vector = input.vector as string;
    const model = input.model as string;
    const dimensions = input.dimensions as number;
    const sourceKind = input.sourceKind as string;
    const sourceKey = input.sourceKey as string;

    const existing = await storage.get(ENTRIES_RELATION, digest);
    if (existing) {
      return { variant: 'alreadyExists', entry: digest };
    }

    const now = new Date().toISOString();
    await storage.put(ENTRIES_RELATION, digest, {
      id: digest,
      digest,
      vector,
      model,
      dimensions,
      sourceKind,
      sourceKey,
      cachedAt: now,
    });

    return { variant: 'stored', entry: digest };
  },

  async flush(input: Record<string, unknown>, storage: ConceptStorage) {
    const cachePath = input.path as string;

    const allEntries = await storage.find(ENTRIES_RELATION);

    const entries: Record<string, CacheManifestEntry> = {};
    for (const record of allEntries) {
      const digest = record.digest as string;
      entries[digest] = {
        digest,
        vector: record.vector as string,
        model: record.model as string,
        dimensions: record.dimensions as number,
        sourceKind: record.sourceKind as string,
        sourceKey: record.sourceKey as string,
        cachedAt: record.cachedAt as string,
      };
    }

    const manifest: CacheManifest = {
      version: 1,
      manifestDigest: computeManifestDigest(entries),
      entries,
    };

    let fs: typeof import('fs');
    let path: typeof import('path');
    try {
      fs = await import('fs');
      path = await import('path');
    } catch {
      return { variant: 'writeError', reason: 'Filesystem module unavailable' };
    }

    try {
      // Ensure parent directory exists
      const dir = path.dirname(cachePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      // Write atomically: write to temp file then rename
      const tmpPath = cachePath + '.tmp';
      fs.writeFileSync(tmpPath, JSON.stringify(manifest, null, 2), 'utf-8');
      fs.renameSync(tmpPath, cachePath);
    } catch (err) {
      return { variant: 'writeError', reason: err instanceof Error ? err.message : String(err) };
    }

    return { variant: 'ok', count: allEntries.length };
  },

  async evict(input: Record<string, unknown>, storage: ConceptStorage) {
    const digest = input.digest as string;

    const existing = await storage.get(ENTRIES_RELATION, digest);
    if (!existing) {
      return { variant: 'notFound' };
    }

    await storage.del(ENTRIES_RELATION, digest);
    return { variant: 'ok' };
  },

  async stats(_input: Record<string, unknown>, storage: ConceptStorage) {
    const allEntries = await storage.find(ENTRIES_RELATION);

    const models = new Set<string>();
    const sourceKinds = new Set<string>();

    for (const record of allEntries) {
      models.add(record.model as string);
      sourceKinds.add(record.sourceKind as string);
    }

    return {
      variant: 'ok',
      totalEntries: allEntries.length,
      models: JSON.stringify([...models].sort()),
      sourceKinds: JSON.stringify([...sourceKinds].sort()),
    };
  },
};
