// ============================================================
// copf migrate
//
// Schema migration CLI command.
//
// Usage:
//   copf migrate <concept>     — migrate a single concept
//   copf migrate --check       — report version status for all concepts
//   copf migrate --all         — migrate all concepts needing migration
//
// Per Section 16.5 of the architecture doc.
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { resolve, relative, join } from 'path';
import { parseConceptFile } from '../../../../kernel/src/parser.js';
import { createInMemoryStorage } from '../../../../kernel/src/storage.js';
import { createInProcessAdapter, createConceptRegistry } from '../../../../kernel/src/transport.js';
import {
  checkMigrationNeeded,
  createMigrationGatedTransport,
  getStoredVersion,
  setStoredVersion,
} from '../../../../implementations/typescript/framework/migration.impl.js';
import type { ConceptHandler, ConceptStorage } from '../../../../kernel/src/types.js';
import { generateId, timestamp } from '../../../../kernel/src/types.js';
import { findFiles } from '../util.js';

interface ConceptInfo {
  name: string;
  uri: string;
  specVersion: number | undefined;
  implPath: string | null;
}

export async function migrateCommand(
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const projectDir = resolve(process.cwd());
  const specsDir = typeof flags.specs === 'string' ? flags.specs : 'specs';
  const implsDir = typeof flags.implementations === 'string'
    ? flags.implementations
    : 'implementations/typescript';

  // Discover all concepts
  const concepts = discoverConcepts(projectDir, specsDir, implsDir);

  if (flags.check) {
    await checkCommand(concepts);
    return;
  }

  if (flags.all) {
    await migrateAll(concepts, projectDir, implsDir);
    return;
  }

  // Migrate a single concept
  const conceptName = positional[0];
  if (!conceptName) {
    console.error('Usage: copf migrate <concept> | --check | --all');
    console.error('');
    console.error('Commands:');
    console.error('  copf migrate <concept>   Migrate a single concept');
    console.error('  copf migrate --check     Report version status for all concepts');
    console.error('  copf migrate --all       Migrate all concepts needing migration');
    process.exit(1);
  }

  const concept = concepts.find(
    c => c.name.toLowerCase() === conceptName.toLowerCase(),
  );
  if (!concept) {
    console.error(`Concept not found: ${conceptName}`);
    console.error(
      `Available concepts: ${concepts.map(c => c.name).join(', ') || '(none)'}`,
    );
    process.exit(1);
  }

  await migrateSingle(concept, projectDir, implsDir);
}

function discoverConcepts(
  projectDir: string,
  specsDir: string,
  implsDir: string,
): ConceptInfo[] {
  const conceptFiles = findFiles(resolve(projectDir, specsDir), '.concept');
  const concepts: ConceptInfo[] = [];

  for (const file of conceptFiles) {
    const source = readFileSync(file, 'utf-8');
    try {
      const ast = parseConceptFile(source);
      const uri = `urn:copf/${ast.name}`;
      const implPath = findImplementation(projectDir, implsDir, ast.name);
      concepts.push({
        name: ast.name,
        uri,
        specVersion: ast.version,
        implPath,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `  Parse error: ${relative(projectDir, file)} — ${message}`,
      );
    }
  }

  return concepts;
}

async function checkCommand(concepts: ConceptInfo[]): Promise<void> {
  console.log('Schema Migration Status\n');

  let needsMigration = 0;

  for (const concept of concepts) {
    if (concept.specVersion === undefined) {
      console.log(`  ${concept.name}: no @version (unversioned)`);
      continue;
    }

    // In a real deployment, we'd read from persistent storage.
    // For the CLI check, we report the spec version and note
    // that the actual stored version depends on the runtime.
    console.log(
      `  ${concept.name}: @version(${concept.specVersion}) ` +
      `${concept.implPath ? '(implementation found)' : '(no implementation)'}`
    );
  }

  const versioned = concepts.filter(c => c.specVersion !== undefined);
  console.log(
    `\n${versioned.length} versioned concept(s), ` +
    `${concepts.length - versioned.length} unversioned`,
  );
}

async function migrateSingle(
  concept: ConceptInfo,
  projectDir: string,
  implsDir: string,
): Promise<void> {
  if (concept.specVersion === undefined) {
    console.log(`${concept.name}: no @version annotation, nothing to migrate`);
    return;
  }

  if (!concept.implPath) {
    console.error(`${concept.name}: no implementation found, cannot migrate`);
    process.exit(1);
  }

  try {
    const mod = await import(concept.implPath);
    const handler = findHandler(mod);
    if (!handler) {
      console.error(`${concept.name}: no handler export found in implementation`);
      process.exit(1);
    }

    if (!handler.migrate) {
      console.error(
        `${concept.name}: handler does not have a 'migrate' action. ` +
        `Add a migrate(fromVersion, toVersion) action to the implementation.`,
      );
      process.exit(1);
    }

    const storage = createInMemoryStorage();
    const storedVersion = await getStoredVersion(storage);
    const fromVersion = storedVersion ?? 0;

    if (fromVersion >= concept.specVersion) {
      console.log(
        `${concept.name}: version ${fromVersion} (current, matches @version(${concept.specVersion})) ✅`,
      );
      return;
    }

    console.log(
      `${concept.name}: migrating from version ${fromVersion} → ${concept.specVersion}...`,
    );

    const result = await handler.migrate(
      { fromVersion, toVersion: concept.specVersion },
      storage,
    );

    if (result.variant === 'ok') {
      await setStoredVersion(storage, concept.specVersion);
      const migrated = result.migratedEntries ?? 0;
      console.log(
        `${concept.name}: migrated ${migrated} entries. Version now ${concept.specVersion}. ✅`,
      );
    } else {
      console.error(
        `${concept.name}: migration failed — ${result.message || 'unknown error'} ❌`,
      );
      process.exit(1);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${concept.name}: migration error — ${message}`);
    process.exit(1);
  }
}

async function migrateAll(
  concepts: ConceptInfo[],
  projectDir: string,
  implsDir: string,
): Promise<void> {
  const versioned = concepts.filter(c => c.specVersion !== undefined);

  if (versioned.length === 0) {
    console.log('No versioned concepts found. Nothing to migrate.');
    return;
  }

  console.log(`Migrating all versioned concepts...\n`);

  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const concept of versioned) {
    if (!concept.implPath) {
      console.log(`  ${concept.name}: skipped (no implementation)`);
      skipped++;
      continue;
    }

    try {
      const mod = await import(concept.implPath);
      const handler = findHandler(mod);
      if (!handler) {
        console.log(`  ${concept.name}: skipped (no handler export)`);
        skipped++;
        continue;
      }

      if (!handler.migrate) {
        console.log(`  ${concept.name}: skipped (no migrate action)`);
        skipped++;
        continue;
      }

      const storage = createInMemoryStorage();
      const storedVersion = await getStoredVersion(storage);
      const fromVersion = storedVersion ?? 0;

      if (fromVersion >= concept.specVersion!) {
        console.log(
          `  ${concept.name}: version ${concept.specVersion} (current) ✅`,
        );
        skipped++;
        continue;
      }

      console.log(
        `  ${concept.name}: migrating from version ${fromVersion} → ${concept.specVersion}...`,
      );

      const result = await handler.migrate(
        { fromVersion, toVersion: concept.specVersion },
        storage,
      );

      if (result.variant === 'ok') {
        await setStoredVersion(storage, concept.specVersion!);
        const entries = result.migratedEntries ?? 0;
        console.log(
          `  ${concept.name}: migrated ${entries} entries. Version now ${concept.specVersion}. ✅`,
        );
        migrated++;
      } else {
        console.error(
          `  ${concept.name}: migration failed — ${result.message || 'unknown error'} ❌`,
        );
        failed++;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  ${concept.name}: error — ${message} ❌`);
      failed++;
    }
  }

  console.log(`\n${migrated} migrated, ${skipped} skipped, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }
}

function findImplementation(
  projectDir: string,
  implsDir: string,
  conceptName: string,
): string | null {
  const lowerName = conceptName.toLowerCase();
  const candidates = [
    join(projectDir, implsDir, 'app', `${lowerName}.impl.ts`),
    join(projectDir, implsDir, 'framework', `${lowerName}.impl.ts`),
    join(projectDir, implsDir, `${lowerName}.impl.ts`),
  ];

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

function findHandler(mod: Record<string, unknown>): ConceptHandler | null {
  for (const key of Object.keys(mod)) {
    if (key.endsWith('Handler') && typeof mod[key] === 'object' && mod[key] !== null) {
      return mod[key] as ConceptHandler;
    }
  }
  return null;
}
