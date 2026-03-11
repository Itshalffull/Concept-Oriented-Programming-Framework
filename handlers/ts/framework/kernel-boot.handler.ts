// KernelBoot Concept Handler
// Bootstraps a Clef kernel by discovering concept handlers,
// compiling routing syncs, and exposing the kernel for action dispatch.

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, join, relative, basename, dirname } from 'path';
import { pathToFileURL } from 'node:url';
import { createConceptRegistry } from '../../../runtime/adapters/transport.js';
import { createSelfHostedKernel } from '../../../runtime/self-hosted.js';
import { createSyncEngineHandler } from './sync-engine.handler.js';
import { parseSyncFile } from './sync-parser.handler.js';
import type { ConceptHandler } from '../../../runtime/types.js';
import type { Kernel } from '../../../runtime/self-hosted.js';

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
    const manifestPath = input.manifestPath as string | undefined;

    // Load .env file for credentials (VERCEL_TOKEN, etc.)
    loadEnvFile(projectRoot);

    // Discover handlers
    const handlerEntries = discoverHandlers(projectRoot);
    if (handlerEntries.length === 0) {
      return { variant: 'noHandlers', projectRoot };
    }

    // Create kernel
    const registry = createConceptRegistry();
    const { handler: syncEngine, log } = createSyncEngineHandler(registry);
    const kernel = createSelfHostedKernel(syncEngine, log, registry);

    const registeredConcepts: string[] = [];
    const syncErrors: string[] = [];

    // Dynamically import and register each handler
    for (const entry of handlerEntries) {
      try {
        // Try .js first (compiled), then .ts via dynamic import
        let modulePath = entry.modulePath;
        if (modulePath.endsWith('.ts')) {
          modulePath = modulePath.replace(/\.ts$/, '.js');
        }

        if (!existsSync(modulePath)) {
          // Try original .ts path for tsx/ts-node environments
          modulePath = entry.modulePath;
        }

        const moduleUrl = pathToFileURL(modulePath).href;
        const mod = await import(moduleUrl);
        const handler = mod[entry.exportName] || mod.default;

        if (handler && typeof handler === 'object') {
          kernel.registerConcept(entry.uri, handler as ConceptHandler);
          registeredConcepts.push(entry.uri);
        }
      } catch {
        // Handler failed to load — not fatal, just skip
      }
    }

    // Discover and compile syncs
    const syncFiles = discoverSyncs(projectRoot);
    const compiledSyncNames: string[] = [];

    for (const syncPath of syncFiles) {
      try {
        const source = readFileSync(syncPath, 'utf-8');
        const compiledSyncs = parseSyncFile(source);
        for (const sync of compiledSyncs) {
          kernel.registerSync(sync);
          compiledSyncNames.push(
            relative(projectRoot, syncPath).replace(/\\/g, '/'),
          );
        }
      } catch (err) {
        syncErrors.push(
          `${relative(projectRoot, syncPath)}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    // Store kernel instance
    const instanceId = `kernel-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    kernelInstances.set(instanceId, {
      kernel,
      status: 'running',
      concepts: registeredConcepts,
      syncs: compiledSyncNames,
      bootedAt: new Date().toISOString(),
      projectRoot,
    });

    // Set globalThis.kernel for CLI commands
    (globalThis as Record<string, unknown>).kernel = kernel;

    await storage.put(RELATION, instanceId, {
      status: 'running',
      concepts: JSON.stringify(registeredConcepts),
      syncs: JSON.stringify(compiledSyncNames),
      bootedAt: new Date().toISOString(),
      projectRoot,
    });

    if (syncErrors.length > 0) {
      return {
        variant: 'syncCompilationFailed',
        kernel: instanceId,
        concepts: registeredConcepts,
        syncs: compiledSyncNames,
        errors: syncErrors,
      };
    }

    return {
      variant: 'ok',
      kernel: instanceId,
      concepts: registeredConcepts,
      syncs: compiledSyncNames,
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
