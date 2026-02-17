// ============================================================
// copf compile --cache
//
// Runs the full compile pipeline and writes pre-compiled
// artifacts to .copf-cache/ for fast cached boot.
//
// Pipeline:
//   1. Parse all .concept files -> AST
//   2. SchemaGen (AST -> ConceptManifest)
//   3. Parse all .sync files -> CompiledSync[]
//   4. Record source hashes for staleness detection
//   5. Write registrations for concept URI -> transport config
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { resolve, relative, basename, join } from 'path';
import { parseConceptFile } from '../../../../implementations/typescript/framework/spec-parser.impl.js';
import { parseSyncFile } from '../../../../implementations/typescript/framework/sync-parser.impl.js';
import { createInMemoryStorage } from '../../../../kernel/src/storage.js';
import { schemaGenHandler } from '../../../../implementations/typescript/framework/schema-gen.impl.js';
import type { ConceptAST, ConceptManifest } from '../../../../kernel/src/types.js';
import {
  computeSourceHashes,
  writeCacheManifest,
  writeConceptManifest,
  writeCompiledSyncs,
  writeRegistrations,
} from '../../../../kernel/src/cache.js';
import type { RegistrationEntry } from '../../../../kernel/src/cache.js';
import { findFiles } from '../util.js';

export async function compileCacheCommand(
  _positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const projectDir = resolve(process.cwd());
  const specsDir = typeof flags.specs === 'string' ? flags.specs : 'specs';
  const syncsDir = typeof flags.syncs === 'string' ? flags.syncs : 'syncs';
  const implsDir = typeof flags.implementations === 'string'
    ? flags.implementations
    : 'implementations/typescript';

  console.log('Compiling artifacts to .copf-cache/\n');

  // Collect all source files for hashing
  const conceptFiles = findFiles(resolve(projectDir, specsDir), '.concept');
  const syncFiles = findFiles(resolve(projectDir, syncsDir), '.sync');
  const allSourceFiles = [...conceptFiles, ...syncFiles];

  if (allSourceFiles.length === 0) {
    console.log('No .concept or .sync files found. Nothing to compile.');
    return;
  }

  // Compute source hashes for cache invalidation
  const sourceHashes = computeSourceHashes(allSourceFiles, projectDir);

  // --- Parse and compile concept specs ---
  const registrations: RegistrationEntry[] = [];
  let conceptCount = 0;
  let manifestCount = 0;

  for (const file of conceptFiles) {
    const relPath = relative(projectDir, file);
    const source = readFileSync(file, 'utf-8');

    let ast: ConceptAST;
    try {
      ast = parseConceptFile(source);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  [FAIL] Parse error: ${relPath} — ${message}`);
      process.exit(1);
    }

    // Generate ConceptManifest via SchemaGen
    const schemaStorage = createInMemoryStorage();
    const schemaResult = await schemaGenHandler.generate(
      { spec: relPath, ast },
      schemaStorage,
    );

    if (schemaResult.variant === 'ok' && schemaResult.manifest) {
      const manifest = schemaResult.manifest as ConceptManifest;
      writeConceptManifest(projectDir, ast.name, manifest);
      manifestCount++;
      console.log(`  [OK] ${ast.name} manifest`);
    } else {
      console.log(`  [SKIP] ${ast.name} — schema generation: ${schemaResult.message || 'no output'}`);
    }

    // Build registration entry
    const uri = `urn:copf/${ast.name}`;
    const implPath = findImplementation(projectDir, implsDir, ast.name);
    registrations.push({
      uri,
      conceptName: ast.name,
      transport: 'in-process',
      implPath: implPath ? relative(projectDir, implPath) : undefined,
    });

    conceptCount++;
  }

  // --- Parse and compile sync files ---
  let syncCount = 0;

  for (const file of syncFiles) {
    const relPath = relative(projectDir, file);
    const source = readFileSync(file, 'utf-8');

    try {
      const syncs = parseSyncFile(source);
      const fileName = basename(file, '.sync');
      writeCompiledSyncs(projectDir, fileName, syncs);
      syncCount += syncs.length;
      console.log(`  [OK] ${relPath} (${syncs.length} sync(s))`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  [FAIL] Sync parse error: ${relPath} — ${message}`);
      process.exit(1);
    }
  }

  // --- Write cache manifest and registrations ---
  writeCacheManifest(projectDir, sourceHashes);
  writeRegistrations(projectDir, registrations);

  console.log(
    `\nCache written to .copf-cache/` +
    `\n  ${conceptCount} concept(s), ${manifestCount} manifest(s), ${syncCount} sync(s)` +
    `\n  ${Object.keys(sourceHashes).length} source file(s) hashed`,
  );
}

function findImplementation(
  projectDir: string,
  implsDir: string,
  conceptName: string,
): string | null {
  const lowerName = conceptName.toLowerCase();
  // Convert camelCase/PascalCase to kebab-case for multi-word names
  const kebabName = lowerName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
  const candidates = [
    join(projectDir, implsDir, 'app', `${lowerName}.impl.ts`),
    join(projectDir, implsDir, 'framework', `${lowerName}.impl.ts`),
    join(projectDir, implsDir, 'framework', `${kebabName}.impl.ts`),
    join(projectDir, implsDir, `${lowerName}.impl.ts`),
  ];

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}
