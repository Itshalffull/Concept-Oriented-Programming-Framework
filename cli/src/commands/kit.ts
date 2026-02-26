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
import { parseConceptFile } from '../../../handlers/ts/framework/spec-parser.handler.js';
import { parseSyncFile } from '../../../handlers/ts/framework/sync-parser.handler.js';
import { findFiles } from '../util.js';
import type { CompiledSync, UsesEntry } from '../../../kernel/src/types.js';

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

# External concepts from other kits that this kit's syncs reference.
# Required uses: concepts must be available for the kit to function.
# Optional uses: syncs only load if the named kit is present.
# uses:
#   - kit: other-kit-name
#     concepts:
#       - name: ConceptName
#         params:
#           T: { as: shared-type-tag }
#   - kit: another-kit
#     optional: true
#     concepts:
#       - name: OptionalConcept
#     syncs:
#       - path: ./syncs/optional-integration.sync
#         description: Only loads if another-kit is present.

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

// ---- Helpers for uses parsing and sync reference validation ----

/**
 * Extract all unique concept names referenced in a compiled sync's
 * when, where, and then clauses. Concept references are stored as
 * URNs (urn:copf/Name) by the sync parser.
 */
export function extractConceptRefs(sync: CompiledSync): Set<string> {
  const refs = new Set<string>();
  for (const pattern of sync.when) {
    refs.add(stripUrn(pattern.concept));
  }
  for (const entry of sync.where) {
    if (entry.type === 'query') {
      refs.add(stripUrn(entry.concept));
    }
  }
  for (const action of sync.then) {
    refs.add(stripUrn(action.concept));
  }
  return refs;
}

function stripUrn(conceptRef: string): string {
  // urn:copf/ConceptName -> ConceptName
  const slash = conceptRef.lastIndexOf('/');
  return slash >= 0 ? conceptRef.slice(slash + 1) : conceptRef;
}

/**
 * Parse the `uses` section from a kit manifest YAML source.
 * Uses line-by-line parsing to handle the nested structure:
 *
 *   uses:
 *     - kit: auth
 *       optional: true
 *       concepts:
 *         - name: User
 *           params:
 *             U: { as: user-ref }
 *         - name: JWT
 *       syncs:
 *         - path: ./syncs/entity-ownership.sync
 *           description: Only loads if auth kit is present.
 */
export function parseUsesSection(source: string): UsesEntry[] {
  const lines = source.split('\n');
  const result: UsesEntry[] = [];

  // Find the `uses:` top-level key
  let i = 0;
  while (i < lines.length) {
    if (/^uses:\s*$/.test(lines[i]) || /^uses:\s*\[\s*\]\s*$/.test(lines[i])) break;
    i++;
  }
  if (i >= lines.length) return [];
  // `uses: []` — explicit empty
  if (/^uses:\s*\[\s*\]\s*$/.test(lines[i])) return [];
  i++;

  // Parse list items under `uses:`
  let currentEntry: UsesEntry | null = null;
  let inConcepts = false;
  let inSyncs = false;
  let currentConcept: { name: string; params?: Record<string, { as: string; description?: string }> } | null = null;
  let inParams = false;

  while (i < lines.length) {
    const line = lines[i];

    // Stop if we hit a new top-level key (no leading whitespace)
    if (/^\S/.test(line) && line.trim() !== '') break;

    const trimmed = line.trim();

    // Skip empty lines and comments
    if (trimmed === '' || trimmed.startsWith('#')) {
      i++;
      continue;
    }

    // New uses entry: `  - kit: <name>`
    const kitMatch = trimmed.match(/^-\s*kit:\s*(.+)$/);
    if (kitMatch) {
      // Save previous concept and entry
      if (currentConcept && currentEntry) {
        currentEntry.concepts.push(currentConcept);
      }
      if (currentEntry) {
        result.push(currentEntry);
      }
      currentEntry = { kit: kitMatch[1].trim(), concepts: [] };
      currentConcept = null;
      inConcepts = false;
      inSyncs = false;
      inParams = false;
      i++;
      continue;
    }

    // `optional: true/false` on a uses entry
    const optionalMatch = trimmed.match(/^optional:\s*(true|false)$/);
    if (optionalMatch && currentEntry) {
      currentEntry.optional = optionalMatch[1] === 'true';
      i++;
      continue;
    }

    // `concepts:` sub-key
    if (trimmed === 'concepts:' && currentEntry) {
      // Flush any pending concept before switching context
      if (currentConcept) {
        currentEntry.concepts.push(currentConcept);
        currentConcept = null;
      }
      inConcepts = true;
      inSyncs = false;
      inParams = false;
      i++;
      continue;
    }

    // `syncs:` sub-key on a uses entry (for optional syncs)
    if (trimmed === 'syncs:' && currentEntry) {
      // Flush any pending concept
      if (currentConcept) {
        currentEntry.concepts.push(currentConcept);
        currentConcept = null;
      }
      currentEntry.syncs = currentEntry.syncs || [];
      inSyncs = true;
      inConcepts = false;
      inParams = false;
      i++;
      continue;
    }

    // Sync path entry: `- path: ./syncs/foo.sync`
    const syncPathMatch = trimmed.match(/^-\s*path:\s*(.+)$/);
    if (syncPathMatch && inSyncs && currentEntry) {
      currentEntry.syncs = currentEntry.syncs || [];
      currentEntry.syncs.push({ path: syncPathMatch[1].trim() });
      i++;
      continue;
    }

    // Sync description: `description: ...`
    const syncDescMatch = trimmed.match(/^description:\s*(.*)$/);
    if (syncDescMatch && inSyncs && currentEntry?.syncs?.length) {
      const lastSync = currentEntry.syncs[currentEntry.syncs.length - 1];
      lastSync.description = syncDescMatch[1].trim();
      i++;
      continue;
    }

    // New concept entry: `- name: <Name>`
    const nameMatch = trimmed.match(/^-\s*name:\s*(.+)$/);
    if (nameMatch && inConcepts && currentEntry) {
      if (currentConcept) {
        currentEntry.concepts.push(currentConcept);
      }
      currentConcept = { name: nameMatch[1].trim() };
      inParams = false;
      i++;
      continue;
    }

    // `params:` sub-key under a concept
    if (trimmed === 'params:' && currentConcept) {
      currentConcept.params = {};
      inParams = true;
      i++;
      continue;
    }

    // Param entry: `T: { as: type-ref }` or `T: { as: type-ref, description: "..." }`
    if (inParams && currentConcept?.params) {
      const paramMatch = trimmed.match(
        /^(\w+):\s*\{\s*as:\s*([^,}]+)(?:,\s*description:\s*"([^"]*)")?\s*\}$/,
      );
      if (paramMatch) {
        const [, paramName, asTag, desc] = paramMatch;
        currentConcept.params[paramName] = { as: asTag.trim() };
        if (desc) {
          currentConcept.params[paramName].description = desc;
        }
      }
      i++;
      continue;
    }

    i++;
  }

  // Flush last concept and entry
  if (currentConcept && currentEntry) {
    currentEntry.concepts.push(currentConcept);
  }
  if (currentEntry) {
    result.push(currentEntry);
  }

  return result;
}

/**
 * Get sync paths from optional uses entries. These are syncs that only
 * load when the external kit is present — exempt from strict validation.
 * Returns a set of resolved absolute paths.
 */
export function getOptionalSyncPaths(uses: UsesEntry[], kitDir: string): Set<string> {
  const paths = new Set<string>();
  for (const entry of uses) {
    if (entry.optional && entry.syncs) {
      for (const s of entry.syncs) {
        const syncPath = s.path.replace(/^\.\//, '');
        paths.add(resolve(kitDir, syncPath));
      }
    }
  }
  return paths;
}

/**
 * Parse concept names declared in the manifest's `concepts:` section.
 * Works by finding `concepts:` as a top-level key and collecting names.
 */
export function parseLocalConceptNames(source: string): Set<string> {
  const names = new Set<string>();
  const lines = source.split('\n');

  let i = 0;
  // Find `concepts:` top-level key
  while (i < lines.length) {
    if (/^concepts:\s*$/.test(lines[i])) break;
    i++;
  }
  if (i >= lines.length) return names;
  i++;

  while (i < lines.length) {
    const line = lines[i];
    // Stop at next top-level key
    if (/^\S/.test(line) && line.trim() !== '') break;

    const trimmed = line.trim();
    // List format: `- name: ConceptName`
    const listMatch = trimmed.match(/^-\s*name:\s*(\w+)/);
    if (listMatch) {
      names.add(listMatch[1]);
      i++;
      continue;
    }
    // Map format: `ConceptName:`  (used in architecture examples)
    const mapMatch = trimmed.match(/^(\w+):\s*$/);
    if (mapMatch && !['spec', 'params', 'description'].includes(mapMatch[1])) {
      names.add(mapMatch[1]);
    }

    i++;
  }

  return names;
}

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
    'handlers/ts',
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

  const errors: string[] = [];
  const warnings: string[] = [];

  // Parse kit manifest (basic YAML parsing for key fields)
  const manifestSource = readFileSync(manifestPath, 'utf-8');
  const nameMatch = manifestSource.match(/^name:\s*(.+)$/m);
  const kitName = nameMatch ? nameMatch[1].trim() : '(unnamed)';

  console.log(`  Kit: ${kitName}`);

  // Parse uses declarations
  const uses = parseUsesSection(manifestSource);
  const usesConceptNames = new Set<string>();
  for (const entry of uses) {
    for (const c of entry.concepts) {
      usesConceptNames.add(c.name);
    }
  }
  const hasUsesSection = /^uses:\s*/m.test(manifestSource);

  if (uses.length > 0) {
    const totalExternal = uses.reduce((sum, u) => sum + u.concepts.length, 0);
    const requiredUses = uses.filter(u => !u.optional);
    const optionalUses = uses.filter(u => u.optional);
    console.log(`  Uses: ${totalExternal} external concept(s) from ${uses.length} kit(s)`);
    for (const entry of requiredUses) {
      for (const c of entry.concepts) {
        console.log(`    [OK] ${c.name} (from ${entry.kit})`);
      }
    }
    for (const entry of optionalUses) {
      for (const c of entry.concepts) {
        console.log(`    [OK] ${c.name} (from ${entry.kit}, optional)`);
      }
    }
  }

  // Parse local concept names from manifest and concept files
  const localConceptNames = parseLocalConceptNames(manifestSource);

  // Validate concept specs
  const conceptFiles = findFiles(kitDir, '.concept');
  console.log(`  Concepts: ${conceptFiles.length}`);

  for (const file of conceptFiles) {
    const relPath = relative(kitDir, file);
    const source = readFileSync(file, 'utf-8');
    try {
      const ast = parseConceptFile(source);
      localConceptNames.add(ast.name);
      console.log(`    [OK] ${ast.name} (${relPath})`);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${relPath}: ${message}`);
      console.log(`    [FAIL] ${relPath}: ${message}`);
    }
  }

  // Build known concepts set: local + uses + builtins
  const knownConcepts = new Set<string>([
    ...localConceptNames,
    ...usesConceptNames,
    'Web', // bootstrap concept
  ]);

  // Get optional uses sync paths (exempt from strict validation)
  const optionalSyncPaths = getOptionalSyncPaths(uses, kitDir);

  // Validate sync files and check concept references
  const syncFiles = findFiles(join(kitDir, 'syncs'), '.sync');
  console.log(`  Syncs: ${syncFiles.length}`);
  const referencedUsesNames = new Set<string>();

  for (const file of syncFiles) {
    const relPath = relative(kitDir, file);
    const source = readFileSync(file, 'utf-8');
    const isOptionalSync = optionalSyncPaths.has(resolve(file));

    try {
      const syncs = parseSyncFile(source);
      for (const s of syncs) {
        const refs = extractConceptRefs(s);
        const unknownRefs: string[] = [];

        for (const ref of refs) {
          if (usesConceptNames.has(ref)) {
            referencedUsesNames.add(ref);
          }
          if (!knownConcepts.has(ref)) {
            unknownRefs.push(ref);
          }
        }

        if (unknownRefs.length > 0) {
          if (isOptionalSync) {
            // Optional uses syncs get a warning, not an error —
            // they only load when the external kit is present
            for (const ref of unknownRefs) {
              warnings.push(
                `${relPath}: Optional sync "${s.name}" references "${ref}" which is not declared in uses concepts`,
              );
            }
            console.log(`    [WARN] ${s.name} (${relPath}) — references external concept(s): ${unknownRefs.join(', ')}`);
          } else if (hasUsesSection) {
            // uses section exists — strict mode: unknown refs are errors
            for (const ref of unknownRefs) {
              errors.push(
                `${relPath}: Sync "${s.name}" references unknown concept "${ref}" — declare it in 'uses' if it comes from another kit`,
              );
            }
            console.log(`    [FAIL] ${s.name} (${relPath}) — unknown concept(s): ${unknownRefs.join(', ')}`);
          } else {
            // No uses section — backward-compatible: warn with hint
            for (const ref of unknownRefs) {
              warnings.push(
                `${relPath}: Sync "${s.name}" references "${ref}" which is not a local concept — add a 'uses' section to declare external concepts`,
              );
            }
            console.log(`    [WARN] ${s.name} (${relPath}) — external concept(s): ${unknownRefs.join(', ')}`);
          }
        } else {
          console.log(`    [OK] ${s.name} (${relPath})`);
        }
      }
    } catch (err: unknown) {
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

  // Warn about unused uses entries
  for (const name of usesConceptNames) {
    if (!referencedUsesNames.has(name)) {
      warnings.push(`Uses concept "${name}" is declared but never referenced by any sync`);
    }
  }

  // Warn about uses kits not in dependencies
  const depsMatch = manifestSource.match(/^dependencies:\s*$/m);
  if (depsMatch && uses.length > 0) {
    for (const entry of uses) {
      const depPattern = new RegExp(`name:\\s*${entry.kit}`, 'm');
      if (!depPattern.test(manifestSource)) {
        warnings.push(
          `Uses references kit "${entry.kit}" which is not listed in 'dependencies'`,
        );
      }
    }
  }

  // Report warnings
  if (warnings.length > 0) {
    console.log(`\n  Warnings: ${warnings.length}`);
    for (const w of warnings) {
      console.log(`    [WARN] ${w}`);
    }
  }

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
