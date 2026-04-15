import { resolve } from 'path';
import { existsSync } from 'fs';
import { bootKernel } from '../../handlers/ts/framework/kernel-boot.handler';
import type { ConceptRegistration, RegEntry } from '../../handlers/ts/framework/kernel-boot.handler';
import { createStorageFromEnv } from '../../runtime/adapters/upstash-storage';
import { createSQLiteStorage } from '../../runtime/adapters/sqlite-storage';
import type { Kernel } from '../../runtime/self-hosted';
import { versionContextHandler } from '../../handlers/ts/version-context.handler';
import { workspaceHandler } from '../../handlers/ts/app/workspace.handler';
import { mediaAssetHandler } from '../../handlers/ts/app/media-asset.handler';
import { transcriptHandler } from '../../handlers/ts/media/transcript.handler';
import { clipHandler } from '../../handlers/ts/media/clip.handler';
import { keyBindingHandler } from '../../handlers/ts/app/key-binding.handler';
import { actionBindingHandler } from '../../handlers/ts/app/action-binding.handler';
import { textSpanHandler } from '../../handlers/ts/app/text-span.handler';
import { inputRuleHandler } from '../../handlers/ts/app/input-rule.handler';
import { testGenerationHandler } from '../../handlers/ts/repertoire/testing/test-generation.handler';

import { REGISTRY_ENTRIES, SYNC_FILES } from '../../generated/kernel-registry';
import { discoverFromFilesystem } from '../../handlers/ts/seed-data.handler';
import { setEntityReflectorKernel } from '../../handlers/ts/app/entity-reflector.handler';
import { setViewShellKernel } from '../../handlers/ts/view/view-shell.handler';
import { bootstrapIdentity, getIdentityStorage } from './identity';
import {
  pickActiveTheme,
  resolveThemeDocumentState,
  type ThemeDocumentState,
  type ThemeRecord,
} from './theme-selection';

let _kernel: Kernel | null = null;
let _seedPromise: Promise<void> | null = null;

const SUPPLEMENTAL_REGISTRY_ENTRIES = [
  {
    uri: 'urn:clef/VersionContext',
    handler: versionContextHandler,
    storageName: 'version-context',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/Workspace',
    handler: workspaceHandler,
    storageName: 'workspace',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/MediaAsset',
    handler: mediaAssetHandler,
    storageName: 'media-asset',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/Transcript',
    handler: transcriptHandler,
    storageName: 'transcript',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/Clip',
    handler: clipHandler,
    storageName: 'clip',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/KeyBinding',
    handler: keyBindingHandler,
    storageName: 'key-binding',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/ActionBinding',
    handler: actionBindingHandler,
    storageName: 'action-binding',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/TextSpan',
    handler: textSpanHandler,
    storageName: 'text-span',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/InputRule',
    handler: inputRuleHandler,
    storageName: 'input-rule',
    storageType: 'standard' as const,
  },
  {
    uri: 'urn:clef/TestGeneration',
    handler: testGenerationHandler,
    storageName: 'test-generation',
    storageType: 'standard' as const,
  },
];

// process.cwd() is the clef-base/ dir when Next.js runs; __filename
// resolves inside .next/server/ at runtime, so we can't use it.
// When running from the project root (e.g., during tests), detect
// and resolve to the clef-base subdirectory for seed/suite paths.
const _cwd = process.cwd();
const CLEF_BASE_ROOT = existsSync(resolve(_cwd, 'seeds'))
  ? _cwd
  : existsSync(resolve(_cwd, 'clef-base', 'seeds'))
    ? resolve(_cwd, 'clef-base')
    : _cwd;

// Project root for resolving sync file paths from kernel-registry.ts
const PROJECT_ROOT = existsSync(resolve(_cwd, 'clef-base'))
  ? _cwd
  : resolve(_cwd, '..');

function makeStorage(conceptName: string) {
  return createStorageFromEnv(`clef-base:${conceptName}`) ?? createSQLiteStorage({
    dbPath: resolve(CLEF_BASE_ROOT, '.clef', 'clef-base.db'),
    namespace: conceptName,
  });
}

export function getKernel(): Kernel {
  if (_kernel) return _kernel;

  const registryEntries = [...REGISTRY_ENTRIES];
  for (const entry of SUPPLEMENTAL_REGISTRY_ENTRIES) {
    if (!registryEntries.some((existing) => existing.uri === entry.uri)) {
      registryEntries.push(entry);
    }
  }

  const concepts: ConceptRegistration[] = registryEntries.map(entry => ({
    uri: entry.uri,
    handler: entry.handler,
    storage: entry.storageType === 'identity'
      ? getIdentityStorage(entry.storageName as Parameters<typeof getIdentityStorage>[0])
      : entry.storageType === 'standard'
        ? makeStorage(entry.storageName)
        : undefined,
    storageName: entry.storageName,
    storageType: entry.storageType,
  }));

  const syncFiles = SYNC_FILES.map(p => resolve(PROJECT_ROOT, p));

  const result = bootKernel({
    concepts,
    syncFiles,
    makeStorage: (name) => makeStorage(name),
  });

  const kernel = result.kernel;

  // Wire EntityReflector kernel reference
  setEntityReflectorKernel(kernel);

  // Wire ViewShell kernel reference so resolveHydrated can dispatch cross-concept gets
  setViewShellKernel(kernel);

  // Seed data + populate RuntimeRegistry + reflect entities
  _seedPromise = seedData(kernel, result.registrations, result.loadedSyncs).then(() => bootstrapIdentity(kernel));

  _kernel = kernel;
  return kernel;
}

/** Await this before querying seeded data */
export function ensureSeeded(): Promise<void> {
  getKernel(); // ensure initialized
  return _seedPromise ?? Promise.resolve();
}

export async function getActiveThemeId(defaultTheme = 'light') {
  await ensureSeeded();
  const themes = await getKernel().queryConcept('urn:clef/Theme', 'theme');
  return pickActiveTheme(themes as ThemeRecord[], defaultTheme);
}

export async function getActiveThemeDocumentState(defaultTheme = 'light'): Promise<ThemeDocumentState> {
  await ensureSeeded();
  const kernel = getKernel();
  const themes = await kernel.queryConcept('urn:clef/Theme', 'theme');
  const themeId = pickActiveTheme(themes as ThemeRecord[], defaultTheme);
  const resolved = await kernel.invokeConcept('urn:clef/Theme', 'resolve', { theme: themeId });
  let resolvedTokens: Record<string, unknown> = {};
  if (resolved.variant === 'ok' && typeof resolved.tokens === 'string' && resolved.tokens.trim()) {
    try {
      resolvedTokens = JSON.parse(resolved.tokens as string) as Record<string, unknown>;
    } catch {
      resolvedTokens = {};
    }
  }
  return resolveThemeDocumentState(themes as ThemeRecord[], resolvedTokens, defaultTheme);
}

let _seeded = false;

function parseSeedEntries(raw: unknown): Array<Record<string, unknown>> {
  if (typeof raw !== 'string' || !raw.trim()) {
    return [];
  }
  const entries = JSON.parse(raw) as string[];
  return entries.map((entry) => JSON.parse(entry) as Record<string, unknown>);
}

async function applyDeclarativeSeeds(kernel: Kernel) {
  const discovery = await discoverFromFilesystem({
    base_path: resolve(CLEF_BASE_ROOT, 'seeds'),
  }, makeStorage('seed-data'));
  if (discovery.variant !== 'ok') {
    throw new Error(String(discovery.message ?? 'Failed to discover seed data'));
  }

  const seeds = await kernel.queryConcept('urn:clef/SeedData', 'seed-data');
  for (const seed of seeds) {
    if (seed.applied === true) {
      continue;
    }

    const conceptUri = String(seed.concept_uri ?? '');
    const actionName = String(seed.action_name ?? '');
    const entries = parseSeedEntries(seed.entries);
    for (const entry of entries) {
      await kernel.invokeConcept(conceptUri, actionName, entry).catch(() => {});
    }
    await kernel.invokeConcept('urn:clef/SeedData', 'apply', {
      seed: seed.id,
    }).catch(() => {});
  }
}

async function populateRuntimeRegistry(kernel: Kernel, registrations: RegEntry[], loadedSyncs: string[]) {
  // Register all concepts in RuntimeRegistry
  for (const reg of registrations) {
    await kernel.invokeConcept('urn:clef/RuntimeRegistry', 'registerConcept', {
      uri: reg.uri,
      has_storage: reg.hasStorage,
      storage_name: reg.storageName,
      storage_type: reg.storageType,
    }).catch(() => {});
  }

  // Register all syncs in RuntimeRegistry
  for (const syncName of loadedSyncs) {
    await kernel.invokeConcept('urn:clef/RuntimeRegistry', 'registerSync', {
      sync_name: syncName,
      source: 'file',
      suite: '',
    }).catch(() => {});
  }
}

async function ensureBootstrapWorkspace(kernel: Kernel) {
  try {
    const existing = await kernel.invokeConcept('urn:clef/Workspace', 'list', { owner: 'system' });
    if (existing.variant === 'ok') {
      const workspaces = Array.isArray(existing.workspaces)
        ? existing.workspaces
        : typeof existing.workspaces === 'string' && existing.workspaces.trim()
          ? JSON.parse(existing.workspaces as string) as unknown[]
          : [];
      if (workspaces.length > 0) {
        return;
      }
    }

    await kernel.invokeConcept('urn:clef/Workspace', 'create', {
      workspace: 'default-admin',
      name: 'Default Admin',
      owner: 'system',
      description: 'Standard admin workspace with content browser, concept sidebar, and system panel.',
    }).catch(() => {});

    await kernel.invokeConcept('urn:clef/Workspace', 'setDefault', {
      workspace: 'default-admin',
    }).catch(() => {});
  } catch {
    // Workspace bootstrap is best-effort and should not block shell boot.
  }
}

async function seedData(kernel: Kernel, registrations: RegEntry[], loadedSyncs: string[]) {
  if (_seeded) return;
  _seeded = true;

  // Populate RuntimeRegistry with all registered concepts and syncs
  await populateRuntimeRegistry(kernel, registrations, loadedSyncs);

  // Run FileCatalog discovery (scans specs, syncs, surface, repertoire)
  await kernel.invokeConcept('urn:clef/FileCatalog', 'discover', {
    base_paths: [
      resolve(CLEF_BASE_ROOT, '..', 'specs'),
      resolve(CLEF_BASE_ROOT, '..', 'syncs'),
      resolve(CLEF_BASE_ROOT, '..', 'surface'),
      resolve(CLEF_BASE_ROOT, '..', 'repertoire', 'concepts'),
      resolve(CLEF_BASE_ROOT, 'suites'),
    ].join(','),
  }).catch(() => {
    // FileCatalog discovery is best-effort — don't fail boot
  });

  // Apply declarative seeds (Schema, View, ContentNode, etc.)
  await applyDeclarativeSeeds(kernel);

  // Earlier broken boots could mark Workspace seeds as applied before the
  // concept existed. Ensure the shell still has a default workspace.
  await ensureBootstrapWorkspace(kernel);

  // Reflect entities — auto-creates ContentNode entries from RuntimeRegistry + FileCatalog
  await kernel.invokeConcept('urn:clef/EntityReflector', 'reflect', {}).catch(() => {
    // Entity reflection is best-effort — don't fail boot
  });
}

export function getRegisteredConcepts() {
  getKernel(); // ensure initialized
  // Query RuntimeRegistry for live data instead of stale array
  return _kernel!.invokeConcept('urn:clef/RuntimeRegistry', 'listConcepts', {}).then(result => {
    if (result.variant === 'ok') {
      const concepts = JSON.parse(result.concepts as string) as Array<Record<string, unknown>>;
      return concepts.map(c => ({ uri: c.uri as string, hasStorage: c.has_storage as boolean }));
    }
    return [];
  });
}
