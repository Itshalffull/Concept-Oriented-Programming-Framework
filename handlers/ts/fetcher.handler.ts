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
import { createHash } from 'crypto';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let nextId = 1;
export function resetFetcherIds() { nextId = 1; }

const _handler: FunctionalConceptHandler = {
  fetch(input: Record<string, unknown>) {
    const moduleId = input.module_id as string;
    const version = input.version as string;
    const sourceUrl = input.source_url as string;
    const expectedHash = input.expected_hash as string;

    let p = createProgram();
    p = find(p, 'blob', { hash: expectedHash }, 'cached');
    p = find(p, 'download', {
      module_id: moduleId,
      version,
      expected_hash: expectedHash,
      status: 'complete',
    }, 'existingDownloads');

    return branch(p,
      (bindings) => {
        const cached = bindings.cached as unknown[];
        const existingDownloads = bindings.existingDownloads as unknown[];
        return cached.length > 0 || existingDownloads.length > 0;
      },
      (thenP) => complete(thenP, 'ok', {}),
      (elseP) => {
        const id = `dl-${nextId++}`;
        const startedAt = new Date().toISOString();
        const simulatedData = `${moduleId}@${version}`;
        const actualHash = createHash('sha256').update(simulatedData).digest('hex');
        const bytesTotal = simulatedData.length;

        if (actualHash !== expectedHash) {
          elseP = put(elseP, 'download', id, {
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
          return complete(elseP, 'integrity_failure', { expected: expectedHash, actual: actualHash });
        }

        const completedAt = new Date().toISOString();
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
          started_at: startedAt,
          completed_at: completedAt,
        });
        return complete(elseP, 'ok', { download: id });
      },
    ) as StorageProgram<Result>;
  },

  fetchBatch(input: Record<string, unknown>) {
    if (!input.items || (typeof input.items === 'string' && (input.items as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'items is required' }) as StorageProgram<Result>;
    }
    const items = input.items as Array<{
      module_id: string;
      version: string;
      source_url: string;
      expected_hash: string;
    }>;

    // For batch, we fetch all blobs upfront and do the logic in a single program
    let p = createProgram();
    p = find(p, 'blob', {}, 'allBlobs');

    return completeFrom(p, 'dynamic', (bindings) => {
      const allBlobs = bindings.allBlobs as Record<string, unknown>[];
      const blobHashes = new Set(allBlobs.map(b => b.hash as string));

      const completed: string[] = [];
      const failed: string[] = [];

      for (const item of items) {
        const id = `dl-${nextId++}`;

        if (blobHashes.has(item.expected_hash)) {
          completed.push(id);
          continue;
        }

        const simulatedData = `${item.module_id}@${item.version}`;
        const actualHash = createHash('sha256').update(simulatedData).digest('hex');

        if (actualHash !== item.expected_hash) {
          failed.push(id);
        } else {
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
    }) as StorageProgram<Result>;
  },

  cancel(input: Record<string, unknown>) {
    const download = input.download as string;

    let p = createProgram();
    p = get(p, 'download', download, 'existing');

    return branch(p, 'existing',
      (thenP) => {
        thenP = putFrom(thenP, 'download', download, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            ...existing,
            status: 'cancelled',
            error: 'cancelled',
            completed_at: new Date().toISOString(),
          };
        });
        return complete(thenP, 'ok', {});
      },
      (elseP) => complete(elseP, 'ok', {}),
    ) as StorageProgram<Result>;
  },
};

export const fetcherHandler = autoInterpret(_handler);
