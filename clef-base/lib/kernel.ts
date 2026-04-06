import { resolve } from 'path';
import { existsSync } from 'fs';
import { bootKernel } from '../../handlers/ts/framework/kernel-boot.handler';
import type { ConceptRegistration, RegEntry } from '../../handlers/ts/framework/kernel-boot.handler';
import { createStorageFromEnv } from '../../runtime/adapters/upstash-storage';
import { createInMemoryStorage } from '../../runtime/adapters/storage';
import type { Kernel } from '../../runtime/self-hosted';

import { REGISTRY_ENTRIES, SYNC_FILES } from '../../generated/kernel-registry';
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
  return createStorageFromEnv(`clef-base:${conceptName}`) ?? createInMemoryStorage();
}

export function getKernel(): Kernel {
  if (_kernel) return _kernel;

  const concepts: ConceptRegistration[] = REGISTRY_ENTRIES.map(entry => ({
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
  const resolvedTokens = resolved.variant === 'ok' && typeof resolved.tokens === 'string'
    ? JSON.parse(resolved.tokens as string) as Record<string, unknown>
    : {};
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
  const discovery = await kernel.invokeConcept('urn:clef/SeedData', 'discover', {
    base_path: resolve(CLEF_BASE_ROOT, 'seeds'),
  });
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
