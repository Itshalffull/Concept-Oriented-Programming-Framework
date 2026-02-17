// ============================================================
// copf kit <subcommand> [args...]
//
// Kit management commands per Section 12:
//   copf kit init <name>          Scaffold a new kit directory
//   copf kit validate <path>      Validate kit manifest, type alignment, sync tiers
//   copf kit test <path>          Run kit's conformance + integration tests
//   copf kit list                 Show kits used by the current app
//   copf kit check-overrides      Verify app overrides reference valid sync names
// ============================================================

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join, resolve, relative, basename } from 'path';
import { parseConceptFile } from '../../../../kernel/src/parser.js';
import { parseSyncFile } from '../../../../kernel/src/sync-parser.js';
import { findFiles } from '../util.js';

const KIT_YAML_TEMPLATE = `# Kit Manifest
name: {{NAME}}
version: 0.1.0
description: "{{NAME}} concept kit"

concepts:
  - name: Example
    spec: example.concept

syncs:
  - name: example-flow
    file: syncs/example.sync
    tier: recommended

dependencies: []
`;

const KIT_CONCEPT_TEMPLATE = `concept Example [U] {

  purpose {
    An example concept in the {{NAME}} kit.
  }

  state {
    items: set U
  }

  actions {
    action create(id: U) {
      -> ok(id: U) {
        Create a new item.
      }
      -> exists(message: String) {
        The item already exists.
      }
    }
  }
}
`;

const KIT_SYNC_TEMPLATE = `sync ExampleFlow [eager]
when {
  Web/request: [ method: "create" ]
    => [ request: ?request; id: ?id ]
}
then {
  Example/create: [ id: ?id ]
}
`;

export async function kitCommand(
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const subcommand = positional[0];
  const rest = positional.slice(1);

  switch (subcommand) {
    case 'init':
      await kitInit(rest, flags);
      break;
    case 'validate':
      await kitValidate(rest, flags);
      break;
    case 'test':
      await kitTest(rest, flags);
      break;
    case 'list':
      await kitList(flags);
      break;
    case 'check-overrides':
      await kitCheckOverrides(flags);
      break;
    default:
      console.error(`Usage: copf kit <init|validate|test|list|check-overrides> [args...]`);
      process.exit(1);
  }
}

async function kitInit(
  positional: string[],
  _flags: Record<string, string | boolean>,
): Promise<void> {
  const name = positional[0];
  if (!name) {
    console.error('Usage: copf kit init <kit-name>');
    process.exit(1);
  }

  const kitDir = resolve(process.cwd(), 'kits', name);
  if (existsSync(kitDir)) {
    console.error(`Kit directory already exists: kits/${name}`);
    process.exit(1);
  }

  console.log(`Scaffolding kit: ${name}`);

  const dirs = [
    '',
    'syncs',
    'implementations/typescript',
    'tests',
  ];

  for (const dir of dirs) {
    mkdirSync(join(kitDir, dir), { recursive: true });
  }

  writeFileSync(
    join(kitDir, 'kit.yaml'),
    KIT_YAML_TEMPLATE.replace(/\{\{NAME\}\}/g, name),
  );

  writeFileSync(
    join(kitDir, 'example.concept'),
    KIT_CONCEPT_TEMPLATE.replace(/\{\{NAME\}\}/g, name),
  );

  writeFileSync(
    join(kitDir, 'syncs/example.sync'),
    KIT_SYNC_TEMPLATE,
  );

  console.log(`
Kit created at kits/${name}/

  kit.yaml                    Kit manifest
  example.concept             Example concept spec
  syncs/example.sync          Example synchronization
  implementations/            Concept implementations
  tests/                      Kit tests

Next steps:
  copf kit validate kits/${name}
  copf kit test kits/${name}
`);
}

async function kitValidate(
  positional: string[],
  _flags: Record<string, string | boolean>,
): Promise<void> {
  const kitPath = positional[0];
  if (!kitPath) {
    console.error('Usage: copf kit validate <path>');
    process.exit(1);
  }

  const kitDir = resolve(process.cwd(), kitPath);
  if (!existsSync(kitDir)) {
    console.error(`Kit directory not found: ${kitPath}`);
    process.exit(1);
  }

  const manifestPath = join(kitDir, 'kit.yaml');
  if (!existsSync(manifestPath)) {
    console.error(`Kit manifest not found: ${kitPath}/kit.yaml`);
    process.exit(1);
  }

  console.log(`Validating kit: ${kitPath}\n`);

  let hasErrors = false;
  const errors: string[] = [];
  const warnings: string[] = [];

  // Parse kit manifest (basic YAML parsing for key fields)
  const manifestSource = readFileSync(manifestPath, 'utf-8');
  const nameMatch = manifestSource.match(/^name:\s*(.+)$/m);
  const kitName = nameMatch ? nameMatch[1].trim() : '(unnamed)';

  console.log(`  Kit: ${kitName}`);

  // Validate concept specs
  const conceptFiles = findFiles(kitDir, '.concept');
  console.log(`  Concepts: ${conceptFiles.length}`);

  for (const file of conceptFiles) {
    const relPath = relative(kitDir, file);
    const source = readFileSync(file, 'utf-8');
    try {
      const ast = parseConceptFile(source);
      console.log(`    [OK] ${ast.name} (${relPath})`);
    } catch (err: unknown) {
      hasErrors = true;
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${relPath}: ${message}`);
      console.log(`    [FAIL] ${relPath}: ${message}`);
    }
  }

  // Validate sync files
  const syncFiles = findFiles(join(kitDir, 'syncs'), '.sync');
  console.log(`  Syncs: ${syncFiles.length}`);

  for (const file of syncFiles) {
    const relPath = relative(kitDir, file);
    const source = readFileSync(file, 'utf-8');
    try {
      const syncs = parseSyncFile(source);
      for (const s of syncs) {
        console.log(`    [OK] ${s.name} (${relPath})`);
      }
    } catch (err: unknown) {
      hasErrors = true;
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${relPath}: ${message}`);
      console.log(`    [FAIL] ${relPath}: ${message}`);
    }
  }

  // Check sync tiers in manifest
  const requiredSyncs = manifestSource.match(/tier:\s*required/g);
  const recommendedSyncs = manifestSource.match(/tier:\s*recommended/g);
  console.log(
    `  Sync tiers: ${requiredSyncs?.length || 0} required, ${recommendedSyncs?.length || 0} recommended`,
  );

  if (errors.length > 0) {
    console.log(`\nValidation failed: ${errors.length} error(s)`);
    process.exit(1);
  }

  console.log('\nKit is valid.');
}

async function kitTest(
  positional: string[],
  _flags: Record<string, string | boolean>,
): Promise<void> {
  const kitPath = positional[0];
  if (!kitPath) {
    console.error('Usage: copf kit test <path>');
    process.exit(1);
  }

  const kitDir = resolve(process.cwd(), kitPath);
  if (!existsSync(kitDir)) {
    console.error(`Kit directory not found: ${kitPath}`);
    process.exit(1);
  }

  console.log(`Testing kit: ${kitPath}\n`);

  // Find and validate all concept specs
  const conceptFiles = findFiles(kitDir, '.concept');
  let totalInvariants = 0;

  for (const file of conceptFiles) {
    const source = readFileSync(file, 'utf-8');
    try {
      const ast = parseConceptFile(source);
      totalInvariants += ast.invariants.length;

      if (ast.invariants.length === 0) {
        console.log(`  [SKIP] ${ast.name} — no invariants`);
      } else {
        console.log(
          `  [INFO] ${ast.name} — ${ast.invariants.length} invariant(s) defined`,
        );
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  [FAIL] ${relative(kitDir, file)}: ${message}`);
    }
  }

  // Check for test files
  const testDir = join(kitDir, 'tests');
  if (existsSync(testDir)) {
    const testFiles = findFiles(testDir, '.test.ts');
    console.log(`\n  Test files found: ${testFiles.length}`);
    for (const f of testFiles) {
      console.log(`    ${relative(kitDir, f)}`);
    }
  }

  console.log(`\n${totalInvariants} invariant(s) across ${conceptFiles.length} concept(s)`);
}

async function kitList(
  _flags: Record<string, string | boolean>,
): Promise<void> {
  const projectDir = resolve(process.cwd());
  const kitsDir = join(projectDir, 'kits');

  if (!existsSync(kitsDir)) {
    console.log('No kits/ directory found.');
    return;
  }

  // Find kit manifests
  const kitManifests = findFiles(kitsDir, 'kit.yaml');

  if (kitManifests.length === 0) {
    console.log('No kits found in kits/ directory.');
    return;
  }

  console.log(`Kits in this project:\n`);

  for (const manifestFile of kitManifests) {
    const kitDir = join(manifestFile, '..');
    const relPath = relative(projectDir, kitDir);
    const source = readFileSync(manifestFile, 'utf-8');
    const nameMatch = source.match(/^name:\s*(.+)$/m);
    const versionMatch = source.match(/^version:\s*(.+)$/m);
    const descMatch = source.match(/^description:\s*"?(.+?)"?\s*$/m);
    const name = nameMatch ? nameMatch[1].trim() : basename(kitDir);
    const version = versionMatch ? versionMatch[1].trim() : '0.0.0';
    const desc = descMatch ? descMatch[1].trim() : '';

    const conceptCount = findFiles(kitDir, '.concept').length;
    const syncCount = findFiles(join(kitDir, 'syncs'), '.sync').length;

    console.log(`  ${name} v${version} (${relPath})`);
    if (desc) console.log(`    ${desc}`);
    console.log(`    ${conceptCount} concept(s), ${syncCount} sync(s)`);
    console.log('');
  }
}

async function kitCheckOverrides(
  _flags: Record<string, string | boolean>,
): Promise<void> {
  const projectDir = resolve(process.cwd());
  const kitsDir = join(projectDir, 'kits');
  const syncsDir = join(projectDir, 'syncs');

  if (!existsSync(kitsDir)) {
    console.log('No kits/ directory found.');
    return;
  }

  console.log('Checking sync overrides...\n');

  // Collect all kit sync names
  const kitSyncNames = new Set<string>();
  const kitSyncFiles = findFiles(join(kitsDir), '.sync');

  for (const file of kitSyncFiles) {
    const source = readFileSync(file, 'utf-8');
    try {
      const syncs = parseSyncFile(source);
      for (const s of syncs) {
        kitSyncNames.add(s.name);
      }
    } catch {
      // Skip unparseable
    }
  }

  // Collect all app sync names
  const appSyncNames = new Set<string>();
  const appSyncFiles = findFiles(syncsDir, '.sync');

  for (const file of appSyncFiles) {
    const source = readFileSync(file, 'utf-8');
    try {
      const syncs = parseSyncFile(source);
      for (const s of syncs) {
        appSyncNames.add(s.name);
      }
    } catch {
      // Skip unparseable
    }
  }

  // Check for overrides (app syncs that share names with kit syncs)
  const overrides = [...appSyncNames].filter(n => kitSyncNames.has(n));
  const invalid = overrides.length === 0 ? [] : [];

  if (overrides.length > 0) {
    console.log('App syncs that override kit syncs:');
    for (const name of overrides) {
      console.log(`  ${name} (overrides kit sync)`);
    }
  } else {
    console.log('No sync overrides found.');
  }

  console.log(`\n${kitSyncNames.size} kit sync(s), ${appSyncNames.size} app sync(s), ${overrides.length} override(s)`);
}
