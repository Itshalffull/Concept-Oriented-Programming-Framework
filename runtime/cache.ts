// ============================================================
// Clef Kernel - Compiled Artifact Cache
//
// Reads and writes pre-compiled artifacts from .clef-cache/.
// Used by the cached boot path to skip parsing on startup
// and by `clef compile --cache` to persist build output.
// ============================================================

import { createHash } from 'crypto';
import {
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  readdirSync,
} from 'fs';
import { join, relative } from 'path';
import type { CompiledSync, ConceptManifest } from './types.js';

// --- Cache Manifest ---

export interface CacheManifest {
  version: string;
  sourceHashes: Record<string, string>;
  compiledAt: string;
}

// --- Registration Entry ---

export interface RegistrationEntry {
  uri: string;
  conceptName: string;
  transport: 'in-process';
  implPath?: string;
}

// --- Cache Directory Layout ---

const CACHE_DIR = '.clef-cache';
const MANIFEST_FILE = 'manifest.json';
const CONCEPTS_DIR = 'concepts';
const SYNCS_DIR = 'syncs';
const REGISTRATIONS_FILE = 'registrations.json';

// --- Hash Computation ---

export function computeFileHash(filePath: string): string {
  const content = readFileSync(filePath, 'utf-8');
  return createHash('sha256').update(content).digest('hex');
}

export function computeSourceHashes(
  files: string[],
  projectDir: string,
): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const file of files) {
    const relPath = relative(projectDir, file);
    hashes[relPath] = computeFileHash(file);
  }
  return hashes;
}

// --- Cache Writing ---

export function writeCacheManifest(
  projectDir: string,
  sourceHashes: Record<string, string>,
): void {
  const cacheDir = join(projectDir, CACHE_DIR);
  mkdirSync(cacheDir, { recursive: true });

  const manifest: CacheManifest = {
    version: '1',
    sourceHashes,
    compiledAt: new Date().toISOString(),
  };

  writeFileSync(
    join(cacheDir, MANIFEST_FILE),
    JSON.stringify(manifest, null, 2) + '\n',
  );
}

export function writeConceptManifest(
  projectDir: string,
  conceptName: string,
  manifest: ConceptManifest,
): void {
  const dir = join(projectDir, CACHE_DIR, CONCEPTS_DIR);
  mkdirSync(dir, { recursive: true });

  writeFileSync(
    join(dir, `${conceptName.toLowerCase()}.manifest.json`),
    JSON.stringify(manifest, null, 2) + '\n',
  );
}

export function writeCompiledSyncs(
  projectDir: string,
  fileName: string,
  syncs: CompiledSync[],
): void {
  const dir = join(projectDir, CACHE_DIR, SYNCS_DIR);
  mkdirSync(dir, { recursive: true });

  writeFileSync(
    join(dir, `${fileName}.compiled.json`),
    JSON.stringify(syncs, null, 2) + '\n',
  );
}

export function writeRegistrations(
  projectDir: string,
  registrations: RegistrationEntry[],
): void {
  const cacheDir = join(projectDir, CACHE_DIR);
  mkdirSync(cacheDir, { recursive: true });

  writeFileSync(
    join(cacheDir, REGISTRATIONS_FILE),
    JSON.stringify(registrations, null, 2) + '\n',
  );
}

// --- Cache Reading ---

export function readCacheManifest(
  projectDir: string,
): CacheManifest | null {
  const manifestPath = join(projectDir, CACHE_DIR, MANIFEST_FILE);
  if (!existsSync(manifestPath)) return null;

  try {
    return JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch {
    return null;
  }
}

export function readConceptManifests(
  projectDir: string,
): Map<string, ConceptManifest> {
  const dir = join(projectDir, CACHE_DIR, CONCEPTS_DIR);
  const manifests = new Map<string, ConceptManifest>();

  if (!existsSync(dir)) return manifests;

  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.manifest.json')) continue;
    try {
      const manifest: ConceptManifest = JSON.parse(
        readFileSync(join(dir, file), 'utf-8'),
      );
      manifests.set(manifest.name, manifest);
    } catch {
      // Skip malformed cache entries
    }
  }

  return manifests;
}

export function readAllCompiledSyncs(
  projectDir: string,
): CompiledSync[] {
  const dir = join(projectDir, CACHE_DIR, SYNCS_DIR);
  const allSyncs: CompiledSync[] = [];

  if (!existsSync(dir)) return allSyncs;

  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.compiled.json')) continue;
    try {
      const syncs: CompiledSync[] = JSON.parse(
        readFileSync(join(dir, file), 'utf-8'),
      );
      allSyncs.push(...syncs);
    } catch {
      // Skip malformed cache entries
    }
  }

  return allSyncs;
}

export function readRegistrations(
  projectDir: string,
): RegistrationEntry[] {
  const regPath = join(projectDir, CACHE_DIR, REGISTRATIONS_FILE);
  if (!existsSync(regPath)) return [];

  try {
    return JSON.parse(readFileSync(regPath, 'utf-8'));
  } catch {
    return [];
  }
}

// --- Cache Validation ---

/**
 * Validate a cache against the current source files.
 * Returns true if the cache is fresh (all hashes match),
 * false if stale or missing.
 */
export function validateCache(
  projectDir: string,
  sourceFiles: string[],
): boolean {
  const manifest = readCacheManifest(projectDir);
  if (!manifest) return false;

  const currentHashes = computeSourceHashes(sourceFiles, projectDir);

  // Check that every current source file has a matching hash
  for (const [relPath, hash] of Object.entries(currentHashes)) {
    if (manifest.sourceHashes[relPath] !== hash) return false;
  }

  // Check that no cached files have been removed
  for (const relPath of Object.keys(manifest.sourceHashes)) {
    if (!(relPath in currentHashes)) return false;
  }

  return true;
}

/**
 * Get the path to the cache directory for a project.
 */
export function getCacheDir(projectDir: string): string {
  return join(projectDir, CACHE_DIR);
}
