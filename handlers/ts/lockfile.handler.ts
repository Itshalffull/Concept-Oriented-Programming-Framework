// Lockfile Concept Implementation
// Serialized resolved dependency graph capturing exact module versions,
// content hashes, artifact URLs, and enabled features for deterministic
// and reproducible installations across environments.
import type { ConceptHandler } from '@clef/runtime';

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
  // Simple hash for handler purposes
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `sha256:${Math.abs(hash).toString(16).padStart(8, '0')}`;
}

export const lockfileHandler: ConceptHandler = {
  async write(input, storage) {
    const projectHash = input.project_hash as string;
    const entries = input.entries as LockfileEntry[];
    const metadata = input.metadata as LockfileMetadata;

    // Validate entries
    if (!entries || !Array.isArray(entries)) {
      return { variant: 'error', message: 'Entries must be a non-empty array' };
    }

    // Check for circular references (simplified: check for self-referencing dependencies)
    for (const entry of entries) {
      if (entry.dependencies && entry.dependencies.includes(entry.module_id)) {
        return { variant: 'error', message: `Circular self-reference detected in module "${entry.module_id}"` };
      }
    }

    // Validate content hashes
    for (const entry of entries) {
      if (!entry.content_hash || !entry.content_hash.includes(':')) {
        return { variant: 'error', message: `Invalid content_hash for module "${entry.module_id}"` };
      }
    }

    // Sort entries deterministically by module_id for reproducible output
    const sortedEntries = [...entries].sort((a, b) =>
      a.module_id.localeCompare(b.module_id),
    );

    const lockfileId = `lock-${nextId++}`;
    const lockfileHash = computeIntegrityHash(sortedEntries);

    await storage.put('lockfile', lockfileId, {
      lockfileId,
      projectHash,
      entries: sortedEntries,
      metadata,
      lockfileHash,
    });

    return { variant: 'ok', lockfile: lockfileId };
  },

  async read(input, storage) {
    const lockfileId = input.lockfile as string;

    const lockfile = await storage.get('lockfile', lockfileId);
    if (!lockfile) {
      return { variant: 'notfound' };
    }

    const entries = lockfile.entries as LockfileEntry[];
    const metadata = lockfile.metadata as LockfileMetadata;
    const projectHash = lockfile.projectHash as string;

    // Verify structure integrity
    if (!entries || !Array.isArray(entries)) {
      return { variant: 'corrupt', message: 'Lockfile entries are missing or malformed' };
    }

    if (!metadata) {
      return { variant: 'corrupt', message: 'Lockfile metadata is missing' };
    }

    return {
      variant: 'ok',
      project_hash: projectHash,
      entries,
      metadata,
    };
  },

  async verify(input, storage) {
    const lockfileId = input.lockfile as string;

    const lockfile = await storage.get('lockfile', lockfileId);
    if (!lockfile) {
      return { variant: 'stale', reason: 'Lockfile not found' };
    }

    const entries = lockfile.entries as LockfileEntry[];
    const storedHash = lockfile.lockfileHash as string;

    // Recompute the integrity hash and compare
    const computedHash = computeIntegrityHash(entries);
    if (computedHash !== storedHash) {
      const tamperedModules: string[] = [];
      // Identify which entries might be tampered
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

    // Verify each entry has valid integrity data
    const tamperedEntries: string[] = [];
    for (const entry of entries) {
      if (!entry.integrity || !entry.integrity.includes(':')) {
        tamperedEntries.push(entry.module_id);
      }
    }

    if (tamperedEntries.length > 0) {
      return { variant: 'tampered', entries: tamperedEntries };
    }

    // Check if project_hash is still current (if a current manifest hash is provided)
    const currentManifestHash = input.current_manifest_hash as string | undefined;
    if (currentManifestHash && lockfile.projectHash !== currentManifestHash) {
      return {
        variant: 'stale',
        reason: `Manifest has changed: lockfile has project_hash "${lockfile.projectHash}" but current manifest hash is "${currentManifestHash}"`,
      };
    }

    return { variant: 'ok' };
  },

  async diff(input, storage) {
    const oldLockfileId = input.old_lockfile as string;
    const newLockfileId = input.new_lockfile as string;

    const oldLockfile = await storage.get('lockfile', oldLockfileId);
    const newLockfile = await storage.get('lockfile', newLockfileId);

    if (!oldLockfile) {
      return { variant: 'error', message: `Old lockfile "${oldLockfileId}" not found` };
    }
    if (!newLockfile) {
      return { variant: 'error', message: `New lockfile "${newLockfileId}" not found` };
    }

    const oldEntries = oldLockfile.entries as LockfileEntry[];
    const newEntries = newLockfile.entries as LockfileEntry[];

    // Build lookup maps by module_id
    const oldMap = new Map<string, LockfileEntry>();
    for (const entry of oldEntries) {
      oldMap.set(entry.module_id, entry);
    }

    const newMap = new Map<string, LockfileEntry>();
    for (const entry of newEntries) {
      newMap.set(entry.module_id, entry);
    }

    // Compute diff
    const added: string[] = [];
    const removed: string[] = [];
    const updated: Array<{ module_id: string; old_version: string; new_version: string }> = [];

    // Find added and updated
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

    // Find removed
    for (const moduleId of oldMap.keys()) {
      if (!newMap.has(moduleId)) {
        removed.push(moduleId);
      }
    }

    return { variant: 'ok', added, removed, updated };
  },
};
