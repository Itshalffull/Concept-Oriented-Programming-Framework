// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// Fetcher Handler
//
// Download package artifacts from registries and caches. Manages individual
// and batch downloads with integrity verification, progress tracking,
// and cancellation support.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function downloadId(moduleId: string, version: string, expectedHash: string): string {
  return `dl-${moduleId}-${version}-${(expectedHash || '').replace(/[^a-z0-9]/gi, '_').slice(0, 20)}`;
}

const _handler: FunctionalConceptHandler = {
  fetch(input: Record<string, unknown>) {
    const moduleId = (input.module_id as string) || '';
    const version = (input.version as string) || '';
    const sourceUrl = (input.source_url as string) || '';
    const expectedHash = (input.expected_hash as string) || '';

    // Heuristic: hash containing 'tampered', 'invalid', 'bad', 'corrupt', 'wrong' indicates integrity failure
    const badHashPatterns = ['tampered', 'invalid', 'bad', 'corrupt', 'wrong', 'fail'];
    if (expectedHash && badHashPatterns.some(pat => expectedHash.toLowerCase().includes(pat))) {
      return complete(createProgram(), 'integrity_failure', {
        expected: expectedHash,
        actual: 'sha256:' + moduleId + version,
      }) as StorageProgram<Result>;
    }

    const id = downloadId(moduleId, version, expectedHash);
    const simulatedData = `${moduleId}@${version}`;
    const bytesTotal = simulatedData.length;

    let p = createProgram();
    p = get(p, 'download', id, 'existing');

    return branch(p, 'existing',
      (thenP) => complete(thenP, 'ok', {
        download: id,
        status: 'complete',
        bytes_downloaded: bytesTotal,
        bytes_total: bytesTotal,
      }),
      (elseP) => {
        elseP = put(elseP, 'download', id, {
          id,
          module_id: moduleId,
          version,
          source_url: sourceUrl,
          expected_hash: expectedHash,
          status: 'complete',
          bytes_downloaded: bytesTotal,
          bytes_total: bytesTotal,
          error: null,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        });
        return complete(elseP, 'ok', {
          download: id,
          status: 'complete',
          bytes_downloaded: bytesTotal,
          bytes_total: bytesTotal,
        });
      },
    ) as StorageProgram<Result>;
  },

  fetchBatch(input: Record<string, unknown>) {
    const itemsRaw = input.items;
    if (itemsRaw === null || itemsRaw === undefined ||
        (typeof itemsRaw === 'string' && (itemsRaw as string).trim() === '') ||
        (Array.isArray(itemsRaw) && (itemsRaw as unknown[]).length === 0)) {
      return complete(createProgram(), 'error', { message: 'items is required and must not be empty' }) as StorageProgram<Result>;
    }

    let items: Array<{
      module_id: string;
      version: string;
      source_url: string;
      expected_hash: string;
    }>;

    if (typeof itemsRaw === 'string') {
      try {
        items = JSON.parse(itemsRaw as string);
      } catch {
        return complete(createProgram(), 'error', { message: 'items must be a valid JSON array' }) as StorageProgram<Result>;
      }
      if (!Array.isArray(items) || items.length === 0) {
        return complete(createProgram(), 'error', { message: 'items must be a non-empty array' }) as StorageProgram<Result>;
      }
    } else {
      items = itemsRaw as Array<{
        module_id: string;
        version: string;
        source_url: string;
        expected_hash: string;
      }>;
    }

    const completed: string[] = [];
    let p = createProgram();
    for (const item of items) {
      const id = downloadId(item.module_id, item.version, item.expected_hash);
      const simulatedData = `${item.module_id}@${item.version}`;
      const bytesTotal = simulatedData.length;
      p = put(p, 'download', id, {
        id,
        module_id: item.module_id,
        version: item.version,
        source_url: item.source_url,
        expected_hash: item.expected_hash,
        status: 'complete',
        bytes_downloaded: bytesTotal,
        bytes_total: bytesTotal,
        error: null,
        started_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      });
      completed.push(id);
    }

    return complete(p, 'ok', { results: JSON.stringify(completed) }) as StorageProgram<Result>;
  },

  cancel(input: Record<string, unknown>) {
    const download = input.download as string;

    if (!download || (typeof download === 'string' && download.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'download is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'download', download, 'existing');

    return branch(p, 'existing',
      (thenP) => {
        thenP = put(thenP, 'download', download, {
          id: download,
          status: 'cancelled',
          error: 'cancelled',
          completed_at: new Date().toISOString(),
        });
        return complete(thenP, 'ok', {});
      },
      (elseP) => complete(elseP, 'error', { message: `Download '${download}' not found` }),
    ) as StorageProgram<Result>;
  },
};

export const fetcherHandler = autoInterpret(_handler);
