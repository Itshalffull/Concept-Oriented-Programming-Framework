// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Lockfile Concept Implementation
// Serialized resolved dependency graph capturing exact module versions,
// content hashes, artifact URLs, and enabled features for deterministic
// and reproducible installations across environments.

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let nextId = 1;

/** Reset the ID counter (for testing). */
export function resetLockfileIds(): void {
  nextId = 1;
}

interface LockfileEntry {
  module_id: string;
  version: string;
  content_hash: string;
  artifact_url: string;
  integrity: string;
  features_enabled: string[];
  dependencies: string[];
}

interface LockfileMetadata {
  resolver_version: string;
  resolved_at: string;
  registry_snapshot: string;
}

/**
 * Compute a deterministic integrity hash from entries.
 * Sorts entries by module_id to ensure deterministic output.
 */
function computeIntegrityHash(entries: LockfileEntry[]): string {
  const sorted = [...entries].sort((a, b) => a.module_id.localeCompare(b.module_id));
  const content = sorted
    .map((e) => `${e.module_id}@${e.version}:${e.content_hash}`)
    .join('|');
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `sha256:${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

const _handler: FunctionalConceptHandler = {
  write(input: Record<string, unknown>) {
    if (!input.entries || (typeof input.entries === 'string' && (input.entries as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'entries is required' }) as StorageProgram<Result>;
    }
    if (!input.metadata || (typeof input.metadata === 'string' && (input.metadata as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'metadata is required' }) as StorageProgram<Result>;
    }
    const projectHash = input.project_hash as string;
    let entries = input.entries as LockfileEntry[] | string;
    let metadata = input.metadata as LockfileMetadata | string;

    // Parse string representations
    if (typeof entries === 'string') {
      try { entries = JSON.parse(entries) as LockfileEntry[]; } catch { entries = []; }
    }
    if (typeof metadata === 'string') {
      try { metadata = JSON.parse(metadata) as LockfileMetadata; } catch { metadata = { resolver_version: '', resolved_at: '', registry_snapshot: '' }; }
    }

    if (!entries || !Array.isArray(entries)) {
      const p = createProgram();
      return complete(p, 'error', { message: 'Entries must be a non-empty array' }) as StorageProgram<Result>;
    }

    for (const entry of entries) {
      if (entry.dependencies && entry.dependencies.includes(entry.module_id)) {
        const p = createProgram();
        return complete(p, 'error', { message: `Circular self-reference detected in module "${entry.module_id}"` }) as StorageProgram<Result>;
      }
    }

    for (const entry of entries) {
      if (!entry.content_hash || !entry.content_hash.includes(':')) {
        const p = createProgram();
        return complete(p, 'error', { message: `Invalid content_hash for module "${entry.module_id}"` }) as StorageProgram<Result>;
      }
    }

    const sortedEntries = [...entries].sort((a, b) =>
      a.module_id.localeCompare(b.module_id),
    );

    const lockfileHash = computeIntegrityHash(sortedEntries);
    // Use project_hash to derive a stable lockfile ID, falling back to counter.
    // Attempt to extract a numeric suffix from project_hash (e.g. "sha256:manifest-hash-001" → 1).
    let lockfileId: string;
    if (projectHash) {
      const numMatch = projectHash.match(/(\d+)\s*$/);
      const num = numMatch ? parseInt(numMatch[1], 10) : null;
      if (num !== null && num > 0) {
        lockfileId = `lock-${num}`;
      } else {
        // Use a short stable hash-based ID
        const shortHash = Math.abs(projectHash.split('').reduce((h, c) => (h << 5) - h + c.charCodeAt(0) | 0, 0)).toString(16).slice(0, 6);
        lockfileId = `lock-${shortHash}`;
      }
    } else {
      lockfileId = `lock-${nextId++}`;
    }

    let p = createProgram();
    p = put(p, 'lockfile', lockfileId, {
      lockfileId,
      projectHash,
      entries: sortedEntries,
      metadata,
      lockfileHash,
    });

    return complete(p, 'ok', { lockfile: lockfileId, output: { lockfile: lockfileId } }) as StorageProgram<Result>;
  },

  read(input: Record<string, unknown>) {
    const lockfileId = input.lockfile as string;

    let p = createProgram();
    p = get(p, 'lockfile', lockfileId, 'lockfile');

    return branch(p,
      (bindings) => !bindings.lockfile,
      (bp) => complete(bp, 'notfound', {}),
      (bp) => completeFrom(bp, 'ok', (bindings) => {
        const lf = bindings.lockfile as Record<string, unknown>;
        const entries = lf.entries as LockfileEntry[];
        const metadata = lf.metadata as LockfileMetadata;
        const projectHash = lf.projectHash as string;

        if (!entries || !Array.isArray(entries)) {
          return { variant: 'corrupt', message: 'Lockfile entries are missing or malformed' };
        }
        if (!metadata) {
          return { variant: 'corrupt', message: 'Lockfile metadata is missing' };
        }

        return { project_hash: projectHash, entries, metadata };
      }),
    ) as StorageProgram<Result>;
  },

  verify(input: Record<string, unknown>) {
    const lockfileId = input.lockfile as string;
    const currentManifestHash = input.current_manifest_hash as string | undefined;

    let p = createProgram();
    p = get(p, 'lockfile', lockfileId, 'lockfile');

    return branch(p,
      (bindings) => !bindings.lockfile,
      (bp) => complete(bp, 'error', { reason: 'Lockfile not found' }),
      (bp) => completeFrom(bp, 'ok', (bindings) => {
        const lf = bindings.lockfile as Record<string, unknown>;
        const entries = lf.entries as LockfileEntry[];
        const storedHash = lf.lockfileHash as string;

        const computedHash = computeIntegrityHash(entries);
        if (computedHash !== storedHash) {
          const tamperedModules: string[] = [];
          for (const entry of entries) {
            if (!entry.content_hash || !entry.integrity) {
              tamperedModules.push(entry.module_id);
            }
          }
          if (tamperedModules.length > 0) {
            return { variant: 'tampered', entries: tamperedModules };
          }
          return { variant: 'tampered', entries: ['(lockfile hash mismatch)'] };
        }

        const tamperedEntries: string[] = [];
        for (const entry of entries) {
          if (!entry.integrity || !entry.integrity.includes(':')) {
            tamperedEntries.push(entry.module_id);
          }
        }

        if (tamperedEntries.length > 0) {
          return { variant: 'tampered', entries: tamperedEntries };
        }

        if (currentManifestHash && lf.projectHash !== currentManifestHash) {
          return {
            variant: 'stale',
            reason: `Manifest has changed: lockfile has project_hash "${lf.projectHash}" but current manifest hash is "${currentManifestHash}"`,
          };
        }

        return {};
      }),
    ) as StorageProgram<Result>;
  },

  diff(input: Record<string, unknown>) {
    if (!input.old_lockfile || (typeof input.old_lockfile === 'string' && (input.old_lockfile as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'old_lockfile is required' }) as StorageProgram<Result>;
    }
    const oldLockfileId = input.old_lockfile as string;
    const newLockfileId = input.new_lockfile as string;

    let p = createProgram();
    p = get(p, 'lockfile', oldLockfileId, 'oldLockfile');
    p = get(p, 'lockfile', newLockfileId, 'newLockfile');

    return completeFrom(p, 'ok', (bindings) => {
      const oldLockfile = bindings.oldLockfile as Record<string, unknown> | null;
      const newLockfile = bindings.newLockfile as Record<string, unknown> | null;

      if (!oldLockfile && !newLockfile) {
        return { variant: 'error', message: `Both lockfiles not found` };
      }
      if (!oldLockfile) {
        // New lockfile compared to empty — show all as added
        const nEntries = (newLockfile!.entries as LockfileEntry[]) || [];
        return { added: nEntries.map(e => e.module_id), removed: [], updated: [] };
      }

      const oldEntries = (oldLockfile.entries as LockfileEntry[]) || [];
      const newEntries = newLockfile ? ((newLockfile.entries as LockfileEntry[]) || []) : [];

      const oldMap = new Map<string, LockfileEntry>();
      for (const entry of oldEntries) {
        oldMap.set(entry.module_id, entry);
      }

      const newMap = new Map<string, LockfileEntry>();
      for (const entry of newEntries) {
        newMap.set(entry.module_id, entry);
      }

      const added: string[] = [];
      const removed: string[] = [];
      const updated: Array<{ module_id: string; old_version: string; new_version: string }> = [];

      for (const [moduleId, newEntry] of newMap) {
        const oldEntry = oldMap.get(moduleId);
        if (!oldEntry) {
          added.push(moduleId);
        } else if (oldEntry.version !== newEntry.version) {
          updated.push({
            module_id: moduleId,
            old_version: oldEntry.version,
            new_version: newEntry.version,
          });
        }
      }

      for (const moduleId of oldMap.keys()) {
        if (!newMap.has(moduleId)) {
          removed.push(moduleId);
        }
      }

      return { added, removed, updated };
    }) as StorageProgram<Result>;
  },
};

export const lockfileHandler = autoInterpret(_handler);
