// @clef-handler style=functional
// ============================================================
// SelfUpdate Handler
//
// Binary self-update lifecycle. Checks for newer versions of a
// running binary, downloads and atomically swaps the executable,
// and supports rollback to the previous version on failure.
// See Architecture doc Section 16.11.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `update-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  check(input: Record<string, unknown>) {
    const currentVersion = (input.current_version as string) || '';
    const platform = (input.platform as string) || '';

    if (!currentVersion || currentVersion.trim() === '') {
      return complete(createProgram(), 'error', { message: 'current_version is required' }) as StorageProgram<Result>;
    }
    if (!platform || platform.trim() === '') {
      return complete(createProgram(), 'error', { message: 'platform is required' }) as StorageProgram<Result>;
    }

    const id = nextId();
    const now = new Date().toISOString();

    // Parse version parts to determine if a newer version is simulated.
    // Minor >= 9 simulates "already latest".
    const parts = currentVersion.split('.').map(Number);
    const isLatest = parts.length >= 3 && parts[1] >= 9;
    const nextMinor = (parts[1] || 0) + 1;
    const latestVersion = `${parts[0]}.${nextMinor}.0`;
    const downloadUrl = `https://dl.clef.dev/cli/${latestVersion}/${platform}`;

    let p = createProgram();
    p = put(p, 'self-update', id, {
      id,
      current_version: currentVersion,
      platform,
      status: isLatest ? 'up_to_date' : 'available',
      checked_at: now,
      latest_version: isLatest ? null : latestVersion,
      download_url: isLatest ? null : downloadUrl,
      content_hash: isLatest ? null : 'sha256:simulated',
    });

    if (isLatest) {
      return complete(p, 'ok', {}) as StorageProgram<Result>;
    }

    return complete(p, 'available', {
      update: id,
      latest_version: latestVersion,
      download_url: downloadUrl,
      content_hash: 'sha256:simulated',
      size_bytes: 42000000,
    }) as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    const update = (input.update as string) || '';
    const binaryPath = (input.binary_path as string) || '';

    if (!update || update.trim() === '') {
      return complete(createProgram(), 'error', { message: 'update is required' }) as StorageProgram<Result>;
    }
    if (!binaryPath || binaryPath.trim() === '') {
      return complete(createProgram(), 'error', { message: 'binary_path is required' }) as StorageProgram<Result>;
    }

    const previousPath = `${binaryPath}.bak`;

    let p = createProgram();
    p = get(p, 'self-update', update, 'existing');

    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'self-update', update, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            ...rec,
            binary_path: binaryPath,
            previous_binary_path: previousPath,
            status: 'applied',
            applied_at: new Date().toISOString(),
          };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const contentHash = rec.content_hash as string | null;
          // Integrity check simulation
          if (contentHash && (contentHash.includes('tampered') || contentHash.includes('bad'))) {
            return { _variant: 'hash_mismatch', expected: contentHash, actual: 'sha256:mismatched' };
          }
          return { previous_path: previousPath };
        }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', { update }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  rollback(input: Record<string, unknown>) {
    const update = (input.update as string) || '';

    if (!update || update.trim() === '') {
      return complete(createProgram(), 'error', { message: 'update is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'self-update', update, 'existing');

    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'self-update', update, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return { ...rec, status: 'idle', binary_path: null, previous_binary_path: null };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const prevPath = rec.previous_binary_path as string | null;
          if (!prevPath) {
            return { _variant: 'no_backup' };
          }
          return {};
        }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', { update }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  dismiss(input: Record<string, unknown>) {
    const update = (input.update as string) || '';

    if (!update || update.trim() === '') {
      return complete(createProgram(), 'notfound', {}) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'self-update', update, 'existing');

    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'self-update', update, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return { ...rec, status: 'idle' };
        });
        return complete(b2, 'ok', {}) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', {}) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },
};

export const selfUpdateHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetSelfUpdate(): void {
  idCounter = 0;
}
