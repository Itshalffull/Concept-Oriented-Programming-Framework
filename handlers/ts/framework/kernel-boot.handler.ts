// KernelBoot Concept Handler
// Bootstraps a Clef kernel by discovering concept handlers,
// compiling routing syncs, and exposing the kernel for action dispatch.
//
// Two boot modes:
// 1. Discovery mode (boot action): scans filesystem for handlers + syncs
// 2. Explicit mode (bootKernel utility): accepts handler objects + sync paths directly
//
// The bootKernel() utility is the foundational boot path used by:
// - clef-base main kernel (explicit handler imports)
// - Tests (minimal handler sets)
// - The boot action itself (after filesystem discovery)

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join, relative, basename, dirname } from 'path';
import { pathToFileURL } from 'node:url';
import { createConceptRegistry } from '../../../runtime/adapters/transport.js';
import { createSelfHostedKernel } from '../../../runtime/self-hosted.js';
import { createSyncEngineHandler, SyncEngine } from './sync-engine.handler.js';
import { parseSyncFile } from './sync-parser.handler.js';
import { createInMemoryStorage } from '../../../runtime/adapters/storage.js';
import { createStorageFactory } from '../../../runtime/adapters/storage-factory.js';
import type { ConceptHandler, ConceptStorage, ConceptRegistry } from '../../../runtime/types.js';
import type { Kernel } from '../../../runtime/self-hosted.js';
import type { ActionLog } from './engine.js';

// --- Explicit Boot API ---

export interface ConceptRegistration {
  uri: string;
  handler: ConceptHandler;
  storage?: ConceptStorage;
  storageName?: string;
  storageType?: string;
}

export interface KernelBootConfig {
  /** Concepts to register with the kernel */
  concepts: ConceptRegistration[];
  /** File paths to .sync files to load */
  syncFiles?: string[];
  /** Raw .sync file contents to parse and register */
  syncSources?: string[];
  /** Custom storage factory; defaults to in-memory */
  makeStorage?: (name: string) => ConceptStorage;
}

export interface KernelBootResult {
  kernel: Kernel;
  registry: ConceptRegistry;
  syncEngine: SyncEngine;
  log: ActionLog;
  registrations: RegEntry[];
  loadedSyncs: string[];
}

export interface RegEntry {
  uri: string;
  hasStorage: boolean;
  storageName: string;
  storageType: string;
}

/**
 * Boot a kernel from an explicit list of concepts and syncs.
 *
 * This is the foundational boot path — all other boot modes
 * (filesystem discovery, suite-driven boot) resolve to this.
 */
export function bootKernel(config: KernelBootConfig): KernelBootResult {
  const registry = createConceptRegistry();
  const { handler: syncEngineHandler, engine: syncEngineInstance, log } = createSyncEngineHandler(registry);
  const kernel = createSelfHostedKernel(syncEngineHandler, log, registry);

  const storageFactory = config.makeStorage ?? createStorageFactory();
  const registrations: RegEntry[] = [];

  for (const entry of config.concepts) {
    const storage = entry.storage ?? storageFactory(entry.storageName ?? entry.uri);
    kernel.registerConcept(entry.uri, entry.handler, storage);
    registrations.push({
      uri: entry.uri,
      hasStorage: !!entry.storage || !!entry.storageName,
      storageName: entry.storageName ?? '',
      storageType: entry.storageType ?? (entry.storage ? 'custom' : 'in-memory'),
    });
  }

  const loadedSyncs: string[] = [];

  if (config.syncFiles) {
    for (const filePath of config.syncFiles) {
      try {
        const source = readFileSync(filePath, 'utf-8');
        const syncs = parseSyncFile(source);
        for (const sync of syncs) {
          kernel.registerSync(sync);
          loadedSyncs.push(sync.name ?? filePath);
        }
      } catch (err) {
        // Sync load failure is non-fatal — caller can check loadedSyncs
        console.warn(`[KernelBoot] Failed to load sync: ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  if (config.syncSources) {
    for (const source of config.syncSources) {
      const syncs = parseSyncFile(source);
      for (const sync of syncs) {
        kernel.registerSync(sync);
        loadedSyncs.push(sync.name ?? '<inline>');
      }
    }
  }

  return { kernel, registry, syncEngine: syncEngineInstance, log, registrations, loadedSyncs };
}

// --- Filesystem Discovery (used by the boot action) ---

const RELATION = 'kernel-boot';

/**
 * Load .env file into process.env if it exists.
 * Simple KEY=VALUE parser — no external dependencies.
 */
function loadEnvFile(projectRoot: string): void {
  const envPath = resolve(projectRoot, '.env');
  if (!existsSync(envPath)) return;

  try {
    const content = readFileSync(envPath, 'utf-8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // Strip surrounding quotes
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      // Don't overwrite existing env vars
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // .env read failed — not fatal
  }
}

// Known handler paths relative to project root, grouped by category.
// Each entry maps a concept URI to its handler module path and export name.
interface HandlerEntry {
  uri: string;
  modulePath: string;
  exportName: string;
}

/**
 * Build the handler registry from known locations.
 * This scans handler directories for *.handler.ts files and maps them
 * to concept URIs using naming conventions.
 */
function discoverHandlers(projectRoot: string): HandlerEntry[] {
  const entries: HandlerEntry[] = [];
  const seenUris = new Set<string>();

  // Order matters: more specific directories first.
  // First handler registered for a URI wins — later duplicates are skipped.
  const handlerDirs = [
    'handlers/ts/deploy',
    'handlers/ts/framework',
    'handlers/ts/score',
    'handlers/ts/code-parse',
    'handlers/ts/app',
    'handlers/ts',
  ];

  for (const dir of handlerDirs) {
    const absDir = resolve(projectRoot, dir);
    if (!existsSync(absDir)) continue;

    try {
      const files = readdirSync(absDir);
      for (const file of files) {
        if (!file.endsWith('.handler.ts') && !file.endsWith('.handler.js')) continue;
        const fullPath = resolve(absDir, file);
        if (!statSync(fullPath).isFile()) continue;

        // Derive concept name from filename: deploy-plan.handler.ts -> DeployPlan
        const stem = file.replace(/\.handler\.(ts|js)$/, '');
        const conceptName = stem
          .split('-')
          .map(part => part.charAt(0).toUpperCase() + part.slice(1))
          .join('');

        const uri = `urn:clef/${conceptName}`;

        // Skip duplicates — first handler for a URI wins
        if (seenUris.has(uri)) continue;
        seenUris.add(uri);

        // Derive export name: deploy-plan -> deployPlanHandler
        const exportName = stem
          .split('-')
          .map((part, i) => i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1))
          .join('') + 'Handler';

        entries.push({
          uri,
          modulePath: fullPath,
          exportName,
        });
      }
    } catch {
      // Directory not readable — skip
    }
  }

  return entries;
}

/**
 * Recursively discover all .sync files under a set of directories.
 */
function discoverSyncs(projectRoot: string): string[] {
  const syncPaths: string[] = [];
  const syncDirs = [
    'syncs',
    'repertoire/concepts/deployment/syncs',
    'framework/core/syncs',
    'framework/scaffolding/syncs',
    'bind/interface/syncs',
    'score/semantic/syncs',
    'score/auto/syncs',
  ];

  function walkDir(dir: string): void {
    if (!existsSync(dir)) return;
    try {
      const entries = readdirSync(dir);
      for (const entry of entries) {
        const full = resolve(dir, entry);
        try {
          const stat = statSync(full);
          if (stat.isDirectory()) {
            walkDir(full);
          } else if (entry.endsWith('.sync')) {
            syncPaths.push(full);
          }
        } catch {
          // Skip unreadable entries
        }
      }
    } catch {
      // Directory not readable
    }
  }

  for (const dir of syncDirs) {
    walkDir(resolve(projectRoot, dir));
  }

  return syncPaths;
}

// In-memory kernel instance store
const kernelInstances = new Map<string, {
  kernel: Kernel;
  status: string;
  concepts: string[];
  syncs: string[];
  bootedAt: string;
  projectRoot: string;
}>();

export const kernelBootHandler: ConceptHandler = {
  async boot(input, storage) {
    const projectRoot = resolve(input.projectRoot as string || '.');

    // Load .env file for credentials (VERCEL_TOKEN, etc.)
    loadEnvFile(projectRoot);

    // Discover handlers on disk
    const handlerEntries = discoverHandlers(projectRoot);
    if (handlerEntries.length === 0) {
      return { variant: 'noHandlers', projectRoot };
    }

    // Dynamically import discovered handlers into ConceptRegistration list
    const concepts: ConceptRegistration[] = [];
    for (const entry of handlerEntries) {
      try {
        let modulePath = entry.modulePath;
        if (modulePath.endsWith('.ts')) {
          modulePath = modulePath.replace(/\.ts$/, '.js');
        }
        if (!existsSync(modulePath)) {
          modulePath = entry.modulePath;
        }
        const moduleUrl = pathToFileURL(modulePath).href;
        const mod = await import(moduleUrl);
        const handler = mod[entry.exportName] || mod.default;
        if (handler && typeof handler === 'object') {
          concepts.push({ uri: entry.uri, handler: handler as ConceptHandler });
        }
      } catch {
        // Handler failed to load — not fatal, just skip
      }
    }

    // Discover sync files on disk
    const syncFiles = discoverSyncs(projectRoot);

    // Boot via the shared utility
    const result = bootKernel({ concepts, syncFiles });

    // Store kernel instance
    const instanceId = `kernel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const registeredConcepts = result.registrations.map(r => r.uri);
    kernelInstances.set(instanceId, {
      kernel: result.kernel,
      status: 'running',
      concepts: registeredConcepts,
      syncs: result.loadedSyncs,
      bootedAt: new Date().toISOString(),
      projectRoot,
    });

    // Set globalThis.kernel for CLI commands
    (globalThis as Record<string, unknown>).kernel = result.kernel;

    await storage.put(RELATION, instanceId, {
      status: 'running',
      concepts: JSON.stringify(registeredConcepts),
      syncs: JSON.stringify(result.loadedSyncs),
      bootedAt: new Date().toISOString(),
      projectRoot,
    });

    return {
      variant: 'ok',
      kernel: instanceId,
      concepts: registeredConcepts,
      syncs: result.loadedSyncs,
    };
  },

  async status(input, storage) {
    const kernelId = input.kernel as string;
    const instance = kernelInstances.get(kernelId);

    if (!instance) {
      return { variant: 'notfound', kernel: kernelId };
    }

    return {
      variant: 'ok',
      kernel: kernelId,
      status: instance.status,
      concepts: instance.concepts,
      syncs: instance.syncs,
    };
  },

  async shutdown(input, storage) {
    const kernelId = input.kernel as string;
    const instance = kernelInstances.get(kernelId);

    if (!instance) {
      return { variant: 'notfound', kernel: kernelId };
    }

    instance.status = 'shutdown';
    kernelInstances.delete(kernelId);

    if ((globalThis as Record<string, unknown>).kernel === instance.kernel) {
      delete (globalThis as Record<string, unknown>).kernel;
    }

    await storage.del(RELATION, kernelId);
    return { variant: 'ok', kernel: kernelId };
  },
};
