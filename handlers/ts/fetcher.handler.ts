// Fetcher Concept Implementation (Package Distribution Suite)
// Download package artifacts from registries and caches. Manages individual
// and batch downloads with integrity verification, progress tracking,
// and cancellation support.
import type { ConceptHandler } from '@clef/runtime';
import { createHash } from 'crypto';

let nextId = 1;
export function resetFetcherIds() { nextId = 1; }

export const fetcherHandler: ConceptHandler = {
  async fetch(input, storage) {
    const moduleId = input.module_id as string;
    const version = input.version as string;
    const sourceUrl = input.source_url as string;
    const expectedHash = input.expected_hash as string;

    // Check ContentStore for a cached blob with matching hash
    const cached = await storage.find('blob', { hash: expectedHash });
    if (cached.length > 0) {
      return { variant: 'cached' };
    }

    // Check if we already have a completed download with this hash
    const existingDownloads = await storage.find('download', {
      module_id: moduleId,
      version,
      expected_hash: expectedHash,
      status: 'complete',
    });
    if (existingDownloads.length > 0) {
      return { variant: 'cached' };
    }

    const id = `dl-${nextId++}`;
    const startedAt = new Date().toISOString();

    // Simulate download: compute content hash from source URL as a stand-in
    const simulatedData = `${moduleId}@${version}`;
    const actualHash = createHash('sha256').update(simulatedData).digest('hex');
    const bytesTotal = simulatedData.length;

    // Verify integrity
    if (actualHash !== expectedHash) {
      await storage.put('download', id, {
        id,
        module_id: moduleId,
        version,
        source_url: sourceUrl,
        expected_hash: expectedHash,
        status: 'failed',
        bytes_downloaded: bytesTotal,
        bytes_total: bytesTotal,
        error: 'integrity check failed',
        started_at: startedAt,
        completed_at: new Date().toISOString(),
      });
      return { variant: 'integrity_failure', expected: expectedHash, actual: actualHash };
    }

    const completedAt = new Date().toISOString();

    await storage.put('download', id, {
      id,
      module_id: moduleId,
      version,
      source_url: sourceUrl,
      expected_hash: expectedHash,
      status: 'complete',
      bytes_downloaded: bytesTotal,
      bytes_total: bytesTotal,
      error: null,
      started_at: startedAt,
      completed_at: completedAt,
    });

    return { variant: 'ok', download: id };
  },

  async fetchBatch(input, storage) {
    const items = input.items as Array<{
      module_id: string;
      version: string;
      source_url: string;
      expected_hash: string;
    }>;

    const completed: string[] = [];
    const failed: string[] = [];

    for (const item of items) {
      // Check cache first
      const cached = await storage.find('blob', { hash: item.expected_hash });
      if (cached.length > 0) {
        // Already cached, count as completed
        const id = `dl-${nextId++}`;
        await storage.put('download', id, {
          id,
          module_id: item.module_id,
          version: item.version,
          source_url: item.source_url,
          expected_hash: item.expected_hash,
          status: 'complete',
          bytes_downloaded: 0,
          bytes_total: 0,
          error: null,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });
        completed.push(id);
        continue;
      }

      const id = `dl-${nextId++}`;
      const startedAt = new Date().toISOString();

      // Simulate download
      const simulatedData = `${item.module_id}@${item.version}`;
      const actualHash = createHash('sha256').update(simulatedData).digest('hex');
      const bytesTotal = simulatedData.length;

      if (actualHash !== item.expected_hash) {
        await storage.put('download', id, {
          id,
          module_id: item.module_id,
          version: item.version,
          source_url: item.source_url,
          expected_hash: item.expected_hash,
          status: 'failed',
          bytes_downloaded: bytesTotal,
          bytes_total: bytesTotal,
          error: 'integrity check failed',
          started_at: startedAt,
          completed_at: new Date().toISOString(),
        });
        failed.push(id);
      } else {
        await storage.put('download', id, {
          id,
          module_id: item.module_id,
          version: item.version,
          source_url: item.source_url,
          expected_hash: item.expected_hash,
          status: 'complete',
          bytes_downloaded: bytesTotal,
          bytes_total: bytesTotal,
          error: null,
          started_at: startedAt,
          completed_at: new Date().toISOString(),
        });
        completed.push(id);
      }
    }

    if (failed.length > 0) {
      return {
        variant: 'partial',
        completed: JSON.stringify(completed),
        failed: JSON.stringify(failed),
      };
    }

    return { variant: 'ok', results: JSON.stringify(completed) };
  },

  async cancel(input, storage) {
    const download = input.download as string;

    const existing = await storage.get('download', download);
    if (existing) {
      await storage.put('download', download, {
        ...existing,
        status: 'cancelled',
        error: 'cancelled',
        completed_at: new Date().toISOString(),
      });
    }

    return { variant: 'ok' };
  },
};
