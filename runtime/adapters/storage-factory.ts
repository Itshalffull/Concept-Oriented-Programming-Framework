// ============================================================
// Clef Kernel - Storage Factory
//
// Smart storage selection for local CLI and deployed runtimes.
//
// Resolution order:
//   1. Explicit storage passed via ConceptRegistration.storage
//   2. deploy.yaml runtime config (DynamoDB, Redis, Firestore, etc.)
//   3. .clef/config.yaml local override (sqlite, file, etc.)
//   4. Default: JSONL file storage under .clef/data/
//   5. Fallback: in-memory (tests, CI, no writable filesystem)
//
// The factory returns a (name: string) => ConceptStorage function
// compatible with KernelBootConfig.makeStorage.
// ============================================================

import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { ConceptStorage } from '../types.js';
import { createInMemoryStorage } from './storage.js';
import { createFileStorage } from './file-storage.js';
import { createSQLiteStorage } from './sqlite-storage.js';

/** Storage backend type selection. */
export type StorageBackend =
  | 'file'
  | 'memory'
  | 'sqlite'
  | 'postgresql'
  | 'dynamodb'
  | 'redis'
  | 'firestore'
  | 'upstash';

/** Configuration for the storage factory. */
export interface StorageFactoryConfig {
  /** Force a specific backend. Overrides auto-detection. */
  backend?: StorageBackend;
  /** Project root directory. Default: process.cwd() */
  projectRoot?: string;
  /** Data directory for file storage. Default: <projectRoot>/.clef/data */
  dataDir?: string;
  /** If true, never write to the filesystem (tests, CI). */
  ephemeral?: boolean;
}

/**
 * Resolved storage configuration after auto-detection.
 * Returned by resolveStorageConfig for inspection/logging.
 */
export interface ResolvedStorageConfig {
  backend: StorageBackend;
  dataDir: string;
  reason: string;
}

/**
 * Resolve which storage backend to use based on environment and config.
 *
 * Does NOT create storage — just determines which backend and returns
 * the config. Useful for logging/debugging storage selection.
 */
export function resolveStorageConfig(config: StorageFactoryConfig = {}): ResolvedStorageConfig {
  const projectRoot = config.projectRoot ?? process.cwd();
  const dataDir = config.dataDir ?? join(projectRoot, '.clef', 'data');

  // 1. Explicit override
  if (config.backend) {
    return { backend: config.backend, dataDir, reason: 'explicit config' };
  }

  // 2. Ephemeral mode (tests, CI)
  if (config.ephemeral) {
    return { backend: 'memory', dataDir, reason: 'ephemeral mode' };
  }

  // 3. Environment variable override
  const envBackend = process.env['CLEF_STORAGE'] as StorageBackend | undefined;
  if (envBackend) {
    return { backend: envBackend, dataDir, reason: `CLEF_STORAGE=${envBackend}` };
  }

  // 4. .clef/config.yaml local override
  const configPath = join(projectRoot, '.clef', 'config.yaml');
  if (existsSync(configPath)) {
    try {
      const raw = readFileSync(configPath, 'utf-8');
      const match = raw.match(/^\s*storage\s*:\s*(\w+)/m);
      if (match) {
        const backend = match[1] as StorageBackend;
        return { backend, dataDir, reason: `.clef/config.yaml: storage: ${backend}` };
      }
    } catch {
      // Config parse failure — fall through to default
    }
  }

  // 5. Default: file storage if we can write to .clef/data/
  try {
    mkdirSync(dataDir, { recursive: true });
    return { backend: 'file', dataDir, reason: 'default (local file storage)' };
  } catch {
    // Filesystem not writable — fall back to in-memory
    return { backend: 'memory', dataDir, reason: 'fallback (filesystem not writable)' };
  }
}

/**
 * Create a storage factory function for use with bootKernel.
 *
 * Returns a `(name: string) => ConceptStorage` function that creates
 * a storage instance per concept, using the resolved backend.
 *
 * For file storage, each concept gets its own namespace so relations
 * don't collide across concepts sharing the same data directory.
 *
 * Usage:
 * ```ts
 * const makeStorage = createStorageFactory({ projectRoot: '/my/app' });
 * bootKernel({ concepts: [...], makeStorage });
 * ```
 */
export function createStorageFactory(
  config: StorageFactoryConfig = {},
): (name: string) => ConceptStorage {
  const resolved = resolveStorageConfig(config);

  // Cache: one storage instance per concept name (avoid reopening files)
  const instances = new Map<string, ConceptStorage>();

  return (name: string): ConceptStorage => {
    const existing = instances.get(name);
    if (existing) return existing;

    const storage = createStorageForBackend(resolved, name);
    instances.set(name, storage);
    return storage;
  };
}

/**
 * Create a single ConceptStorage instance for the given backend and concept name.
 */
function createStorageForBackend(
  resolved: ResolvedStorageConfig,
  name: string,
): ConceptStorage {
  switch (resolved.backend) {
    case 'file':
      return createFileStorage({
        dataDir: resolved.dataDir,
        namespace: sanitizeNamespace(name),
      });

    case 'memory':
      return createInMemoryStorage();

    // Cloud backends — these require additional config from deploy.yaml.
    // The factory creates them lazily when the deploy config is available.
    // For now, fall back to file storage with a warning.
    case 'sqlite':
      return createSQLiteStorage({
        dbPath: resolved.dataDir.endsWith('.db')
          ? resolved.dataDir
          : join(resolved.dataDir, 'clef.db'),
        namespace: sanitizeNamespace(name),
      });

    case 'postgresql':
    case 'dynamodb':
    case 'redis':
    case 'firestore':
    case 'upstash':
      console.warn(
        `[clef/storage] Backend "${resolved.backend}" requested but not yet ` +
        `configured for local use. Falling back to file storage. ` +
        `Set up deploy.yaml for cloud backends.`,
      );
      return createFileStorage({
        dataDir: resolved.dataDir,
        namespace: sanitizeNamespace(name),
      });

    default:
      return createInMemoryStorage();
  }
}

/**
 * Convert a concept URI or name into a safe filesystem namespace.
 * e.g., 'urn:clef/FormalProperty' → 'FormalProperty'
 */
function sanitizeNamespace(name: string): string {
  // Strip URN prefix
  const stripped = name.replace(/^urn:clef\//, '');
  // Replace unsafe characters
  return stripped.replace(/[/\\:*?"<>|]/g, '_').replace(/\s+/g, '_');
}
