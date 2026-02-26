// ============================================================
// copf interface <subcommand> [args...]
//
// Interface generation commands:
//   copf interface generate          Generate all configured interfaces
//   copf interface plan              Show generation plan without executing
//   copf interface validate          Validate interface manifest and projections
//   copf interface files             List generated output files
//   copf interface clean             Remove orphaned generated files
// ============================================================

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { join, resolve, relative, dirname } from 'path';
import { createHash } from 'crypto';
import { parse as parseYaml } from 'yaml';
import { parseConceptFile } from '../../../handlers/ts/framework/spec-parser.handler.js';
import { schemaGenHandler } from '../../../handlers/ts/framework/schema-gen.handler.js';
import { projectionHandler } from '../../../handlers/ts/framework/projection.handler.js';
import {
  createInterfaceGeneratorHandler,
  type InterfaceManifest,
  type GeneratedFile,
  type ProviderRegistry,
} from '../../../handlers/ts/framework/interface-generator.handler.js';
import { emitterHandler } from '../../../handlers/ts/framework/emitter.handler.js';
import { surfaceHandler } from '../../../handlers/ts/framework/surface.handler.js';
import { createInMemoryStorage } from '../../../kernel/src/storage.js';
import type { ConceptManifest, ConceptAST } from '../../../kernel/src/types.js';

/** Recursively find files matching an extension under a directory. */
function findFiles(dir: string, ext: string): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  function walk(current: string): void {
    let entries;
    try { entries = readdirSync(current); } catch { return; }
    for (const entry of entries) {
      const fullPath = join(current, entry);
      try {
        const stat = statSync(fullPath);
        if (stat.isDirectory()) walk(fullPath);
        else if (entry.endsWith(ext)) results.push(fullPath);
      } catch { /* skip inaccessible */ }
    }
  }
  walk(dir);
  return results.sort();
}

// --- Provider Imports ---
// Lazy-loaded to avoid import errors if files don't exist yet

async function loadProviders(): Promise<ProviderRegistry> {
  const providers: ProviderRegistry = {};
  const providerDir = '../../../handlers/ts/framework/providers';

  try {
    const { restTargetHandler } = await import(`${providerDir}/rest-target.handler.js`);
    providers.RestTarget = restTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { graphqlTargetHandler } = await import(`${providerDir}/graphql-target.handler.js`);
    providers.GraphqlTarget = graphqlTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { grpcTargetHandler } = await import(`${providerDir}/grpc-target.handler.js`);
    providers.GrpcTarget = grpcTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { cliTargetHandler } = await import(`${providerDir}/cli-target.handler.js`);
    providers.CliTarget = cliTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { mcpTargetHandler } = await import(`${providerDir}/mcp-target.handler.js`);
    providers.McpTarget = mcpTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { claudeSkillsTargetHandler } = await import(`${providerDir}/claude-skills-target.handler.js`);
    providers.ClaudeSkillsTarget = claudeSkillsTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { tsSdkTargetHandler } = await import(`${providerDir}/ts-sdk-target.handler.js`);
    providers.TsSdkTarget = tsSdkTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { pySdkTargetHandler } = await import(`${providerDir}/py-sdk-target.handler.js`);
    providers.PySdkTarget = pySdkTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { goSdkTargetHandler } = await import(`${providerDir}/go-sdk-target.handler.js`);
    providers.GoSdkTarget = goSdkTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { rustSdkTargetHandler } = await import(`${providerDir}/rust-sdk-target.handler.js`);
    providers.RustSdkTarget = rustSdkTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { javaSdkTargetHandler } = await import(`${providerDir}/java-sdk-target.handler.js`);
    providers.JavaSdkTarget = javaSdkTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { swiftSdkTargetHandler } = await import(`${providerDir}/swift-sdk-target.handler.js`);
    providers.SwiftSdkTarget = swiftSdkTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { openapiTargetHandler } = await import(`${providerDir}/openapi-target.handler.js`);
    providers.OpenapiTarget = openapiTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { asyncapiTargetHandler } = await import(`${providerDir}/asyncapi-target.handler.js`);
    providers.AsyncapiTarget = asyncapiTargetHandler;
  } catch { /* provider not available */ }

  return providers;
}

// --- Manifest Parsing ---

function parseManifestYaml(source: string): Record<string, unknown> {
  return parseYaml(source) as Record<string, unknown>;
}

function yamlToInterfaceManifest(
  yaml: Record<string, unknown>,
  conceptNames: string[],
): InterfaceManifest {
  const iface = yaml.interface as Record<string, unknown> || {};
  const targets = yaml.targets as Record<string, unknown> || {};
  const sdk = yaml.sdk as Record<string, unknown> || {};
  const specs = yaml.specs as Record<string, unknown> || {};
  const output = yaml.output as Record<string, unknown> || {};

  // Extract per-target outputDir overrides
  const targetOutputDirs: Record<string, string> = {};
  for (const [name, config] of Object.entries(targets)) {
    const cfg = config as Record<string, unknown> | null;
    if (cfg?.outputDir && typeof cfg.outputDir === 'string') {
      targetOutputDirs[name] = cfg.outputDir;
    }
  }

  // Extract per-SDK outputDir overrides
  const sdkOutputDirs: Record<string, string> = {};
  for (const [lang, config] of Object.entries(sdk)) {
    const cfg = config as Record<string, unknown> | null;
    if (cfg?.outputDir && typeof cfg.outputDir === 'string') {
      sdkOutputDirs[lang] = cfg.outputDir;
    }
  }

  // Extract spec outputDir override
  const specOutputDir = typeof specs.outputDir === 'string' ? specs.outputDir : null;

  return {
    kit: (iface.name as string) || '',
    version: String(iface.version || '1.0.0'),
    targets: Object.keys(targets),
    sdkLanguages: Object.keys(sdk),
    specFormats: Object.entries(specs)
      .filter(([k, v]) => v === true && k !== 'outputDir')
      .map(([k]) => k),
    concepts: conceptNames,
    outputDir: (output.dir as string) || './generated/interfaces',
    formatting: 'prettier',
    manifestYaml: yaml,
    targetOutputDirs,
    sdkOutputDirs,
    specOutputDir,
  };
}

// --- Output Path Resolution ---

/**
 * Resolve the absolute output path for a generated file.
 * File paths from providers use the format: `target/concept/file.ts`,
 * `sdk/lang/file.ts`, or `specs/file.yaml`.
 *
 * If a per-target/SDK/spec outputDir override exists, the file is routed
 * to that directory with the target prefix stripped. Otherwise it falls
 * back to the default outputDir.
 */
function resolveOutputPath(
  filePath: string,
  manifest: InterfaceManifest,
  projectDir: string,
): string {
  const parts = filePath.split('/');
  const prefix = parts[0];

  // SDK files: sdk/<lang>/...
  if (prefix === 'sdk' && parts.length >= 3) {
    const lang = parts[1];
    if (manifest.sdkOutputDirs[lang]) {
      const rest = parts.slice(2).join('/');
      return resolve(projectDir, manifest.sdkOutputDirs[lang], rest);
    }
  }

  // Spec files: specs/...
  if (prefix === 'specs' && manifest.specOutputDir) {
    const rest = parts.slice(1).join('/');
    return resolve(projectDir, manifest.specOutputDir, rest);
  }

  // Target files: <target>/...
  if (manifest.targetOutputDirs[prefix]) {
    const rest = parts.slice(1).join('/');
    return resolve(projectDir, manifest.targetOutputDirs[prefix], rest);
  }

  // Fallback: default outputDir
  return join(resolve(projectDir, manifest.outputDir), filePath);
}

// --- Generation Tracking Manifest ---

interface GenManifestEntry {
  path: string;
  relativePath: string;
  hash: string;
  target: string;
}

interface GenManifest {
  generatedAt: string;
  files: GenManifestEntry[];
  targetDirs: Record<string, string>;
}

function loadGenManifest(manifestPath: string): GenManifest | null {
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf-8')) as GenManifest;
  } catch {
    return null;
  }
}

function saveGenManifest(manifestPath: string, manifest: GenManifest): void {
  mkdirSync(dirname(manifestPath), { recursive: true });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

/**
 * Remove files from a previous generation that are no longer produced.
 * Uses the tracking manifest to find orphans across all output directories.
 */
function cleanOrphans(
  oldManifest: GenManifest,
  newPaths: Set<string>,
  dryRun: boolean,
): number {
  let removed = 0;
  for (const entry of oldManifest.files) {
    if (!newPaths.has(entry.path) && existsSync(entry.path)) {
      if (!dryRun) {
        unlinkSync(entry.path);
      }
      removed++;
    }
  }
  return removed;
}

// --- Subcommands ---

export async function interfaceCommand(
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const subcommand = positional[0];
  const rest = positional.slice(1);

  switch (subcommand) {
    case 'generate':
      await interfaceGenerate(rest, flags);
      break;
    case 'plan':
      await interfacePlan(rest, flags);
      break;
    case 'validate':
      await interfaceValidate(rest, flags);
      break;
    case 'files':
      await interfaceFiles(rest, flags);
      break;
    case 'clean':
      await interfaceClean(rest, flags);
      break;
    default:
      console.error('Usage: copf interface <generate|plan|validate|files|clean> [args...]');
      process.exit(1);
  }
}

async function interfaceGenerate(
  _positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const projectDir = resolve(process.cwd());
  const manifestPath = typeof flags.manifest === 'string'
    ? resolve(projectDir, flags.manifest)
    : resolve(projectDir, 'app.interface.yaml');

  if (!existsSync(manifestPath)) {
    console.error(`Interface manifest not found: ${relative(projectDir, manifestPath)}`);
    console.error('Create app.interface.yaml or specify --manifest <path>');
    process.exit(1);
  }

  // 1. Parse manifest YAML
  const source = readFileSync(manifestPath, 'utf-8');
  const manifestYaml = parseManifestYaml(source);

  // 2. Find and parse all concept specs
  // If the manifest explicitly lists concept file paths, use those.
  // Otherwise, scan specs/app/ or specs/ directory.
  let conceptFiles: string[] = [];

  const manifestConcepts = (manifestYaml.concepts as string[] | undefined) || [];
  const explicitPaths = manifestConcepts.filter(c => c.endsWith('.concept'));

  if (explicitPaths.length > 0) {
    // Manifest lists explicit concept file paths
    for (const p of explicitPaths) {
      const resolved = resolve(projectDir, p);
      if (existsSync(resolved)) {
        conceptFiles.push(resolved);
      } else {
        console.error(`  [WARN] Concept file not found: ${p}`);
      }
    }
  } else {
    // Fall back to directory scanning
    const specsDir = resolve(projectDir, 'specs', 'app');
    if (existsSync(specsDir)) {
      conceptFiles = findFiles(specsDir, '.concept');
    } else {
      const altDir = resolve(projectDir, 'specs');
      if (existsSync(altDir)) {
        conceptFiles = findFiles(altDir, '.concept');
      }
    }
  }

  if (conceptFiles.length === 0) {
    console.error('No concept files found. Specify paths in manifest or add files to specs/app/.');
    process.exit(1);
  }

  // Parse concepts and generate manifests via SchemaGen
  console.log('Generating interfaces...\n');

  const projections: Array<{ conceptName: string; conceptManifest: string }> = [];
  const schemaStorage = createInMemoryStorage();

  for (const file of conceptFiles) {
    let ast: ConceptAST;
    try {
      ast = parseConceptFile(readFileSync(file, 'utf-8'));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  [FAIL] Parse ${relative(projectDir, file)}: ${msg}`);
      continue;
    }

    // SchemaGen: AST → ConceptManifest
    const schemaResult = await schemaGenHandler.generate(
      { spec: ast.name, ast },
      schemaStorage,
    );

    if (schemaResult.variant !== 'ok') {
      console.error(`  [FAIL] SchemaGen ${ast.name}: ${schemaResult.message || schemaResult.variant}`);
      continue;
    }

    const manifest = schemaResult.manifest as ConceptManifest;
    console.log(`  [OK] ${ast.name} (${manifest.actions.length} actions)`);

    projections.push({
      conceptName: ast.name,
      conceptManifest: JSON.stringify(manifest),
    });
  }

  if (projections.length === 0) {
    console.error('\nNo concepts successfully parsed. Aborting.');
    process.exit(1);
  }

  const conceptNames = projections.map(p => p.conceptName);
  const manifest = yamlToInterfaceManifest(manifestYaml, conceptNames);

  console.log(`\n  ${projections.length} concept(s), ${manifest.targets.length} target(s), ${manifest.sdkLanguages.length} SDK(s), ${manifest.specFormats.length} spec(s)\n`);

  // 3. Load provider handlers
  const providers = await loadProviders();
  const providerCount = Object.keys(providers).length;
  console.log(`  Loaded ${providerCount} provider handler(s)`);

  // 4. Create generator with providers and run
  const generatorHandler = createInterfaceGeneratorHandler(providers);
  const generatorStorage = createInMemoryStorage();

  // Plan
  const planResult = await generatorHandler.plan(
    {
      kit: manifest.kit,
      interfaceManifest: JSON.stringify(manifest),
    },
    generatorStorage,
  );

  if (planResult.variant !== 'ok') {
    console.error(`\n  Plan failed: ${planResult.variant} — ${planResult.reason || planResult.target || ''}`);
    process.exit(1);
  }

  console.log(`  Plan: ~${planResult.estimatedFiles} estimated files\n`);

  // Generate
  const genResult = await generatorHandler.generate(
    {
      plan: planResult.plan as string,
      projections,
      manifestYaml,
    },
    generatorStorage,
  );

  const allFiles = (genResult.files as GeneratedFile[]) || [];
  const errors = (genResult.errors as string[]) || [];

  // 5. Compose surface entrypoints
  const surfaceStorage = createInMemoryStorage();
  for (const target of manifest.targets) {
    const conceptOutputs = conceptNames.map(c => `${c}-output`);
    const surfaceResult = await surfaceHandler.compose(
      { kit: manifest.kit, target, outputs: conceptOutputs },
      surfaceStorage,
    );

    if (surfaceResult.variant === 'ok') {
      const entrypointResult = await surfaceHandler.entrypoint(
        { surface: surfaceResult.surface as string },
        surfaceStorage,
      );

      if (entrypointResult.content) {
        allFiles.push({
          path: `${target}/index.ts`,
          content: entrypointResult.content as string,
        });
      }
    }
  }

  // 6. Load previous tracking manifest for orphan cleanup
  const genManifestPath = resolve(dirname(manifestPath), '.copf-gen-manifest.json');
  const oldGenManifest = loadGenManifest(genManifestPath);

  // 7. Write files to disk using per-target output dirs
  let writtenCount = 0;
  let skippedCount = 0;
  const newManifestEntries: GenManifestEntry[] = [];
  const newAbsolutePaths = new Set<string>();

  for (const file of allFiles) {
    const filePath = resolveOutputPath(file.path, manifest, projectDir);
    const dir = dirname(filePath);
    mkdirSync(dir, { recursive: true });

    const hash = createHash('sha256').update(file.content).digest('hex');
    const target = file.path.split('/')[0];

    newManifestEntries.push({
      path: filePath,
      relativePath: file.path,
      hash,
      target,
    });
    newAbsolutePaths.add(filePath);

    // Content-addressed skip: check if file exists with same content
    if (existsSync(filePath)) {
      const existing = readFileSync(filePath, 'utf-8');
      if (existing === file.content) {
        skippedCount++;
        continue;
      }
    }

    writeFileSync(filePath, file.content);
    writtenCount++;
  }

  // 8. Clean orphans from previous generation
  let orphanCount = 0;
  const cleanEnabled = (manifestYaml.output as Record<string, unknown>)?.clean !== false;
  if (oldGenManifest && cleanEnabled) {
    orphanCount = cleanOrphans(oldGenManifest, newAbsolutePaths, false);
  }

  // 9. Save new tracking manifest
  const targetDirs: Record<string, string> = {};
  for (const [target, dir] of Object.entries(manifest.targetOutputDirs)) {
    targetDirs[target] = resolve(projectDir, dir);
  }
  for (const [lang, dir] of Object.entries(manifest.sdkOutputDirs)) {
    targetDirs[`sdk/${lang}`] = resolve(projectDir, dir);
  }
  if (manifest.specOutputDir) {
    targetDirs['specs'] = resolve(projectDir, manifest.specOutputDir);
  }
  // Include default output dir
  targetDirs['_default'] = resolve(projectDir, manifest.outputDir);

  saveGenManifest(genManifestPath, {
    generatedAt: new Date().toISOString(),
    files: newManifestEntries,
    targetDirs,
  });

  // 10. Print summary
  console.log(`\nGeneration complete:`);
  console.log(`  ${allFiles.length} total file(s)`);
  console.log(`  ${writtenCount} written, ${skippedCount} unchanged`);
  if (orphanCount > 0) {
    console.log(`  ${orphanCount} orphaned file(s) removed`);
  }

  if (errors.length > 0) {
    console.log(`  ${errors.length} error(s):`);
    for (const err of errors) {
      console.log(`    [WARN] ${err}`);
    }
  }

  // Print per-target breakdown with output directories
  const byTarget = new Map<string, { count: number; dir: string }>();
  for (const entry of newManifestEntries) {
    const target = entry.target;
    if (!byTarget.has(target)) {
      const dir = dirname(entry.path);
      byTarget.set(target, { count: 0, dir: relative(projectDir, dir) });
    }
    byTarget.get(target)!.count++;
  }
  console.log(`\n  Output directories:`);
  for (const [target, info] of byTarget) {
    const customDir = manifest.targetOutputDirs[target]
      || (target === 'sdk' ? '(per-language)' : null)
      || (target === 'specs' && manifest.specOutputDir ? manifest.specOutputDir : null);
    const dirLabel = customDir || manifest.outputDir;
    console.log(`    ${target}: ${info.count} file(s) → ${dirLabel}`);
  }
}

async function interfacePlan(
  _positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const projectDir = resolve(process.cwd());
  const manifestPath = typeof flags.manifest === 'string'
    ? resolve(projectDir, flags.manifest)
    : resolve(projectDir, 'app.interface.yaml');

  if (!existsSync(manifestPath)) {
    console.error(`Interface manifest not found: ${relative(projectDir, manifestPath)}`);
    console.error('Create app.interface.yaml or specify --manifest <path>');
    process.exit(1);
  }

  const source = readFileSync(manifestPath, 'utf-8');
  const yaml = parseManifestYaml(source);
  const iface = yaml.interface as Record<string, unknown> || {};
  const targets = yaml.targets as Record<string, unknown> || {};
  const sdk = yaml.sdk as Record<string, unknown> || {};
  const specs = yaml.specs as Record<string, unknown> || {};
  const output = yaml.output as Record<string, unknown> || {};

  console.log('Interface Generation Plan');
  console.log('========================\n');
  console.log(`  Name:       ${iface.name || '(auto-detect)'}`);
  console.log(`  Version:    ${iface.version || '1.0.0'}`);
  console.log(`  Default output dir: ${output.dir || 'generated/interfaces'}\n`);

  const targetList = Object.keys(targets);
  if (targetList.length > 0) {
    console.log('  Targets:');
    for (const t of targetList) {
      const cfg = targets[t] as Record<string, unknown> | null;
      const customDir = cfg?.outputDir ? ` → ${cfg.outputDir}` : '';
      console.log(`    - ${t}${customDir}`);
    }
  } else {
    console.log('  Targets: (none configured)');
  }

  const sdkList = Object.keys(sdk);
  if (sdkList.length > 0) {
    console.log('  SDK languages:');
    for (const l of sdkList) {
      const cfg = sdk[l] as Record<string, unknown> | null;
      const customDir = cfg?.outputDir ? ` → ${cfg.outputDir}` : '';
      console.log(`    - ${l}${customDir}`);
    }
  }

  const specList = Object.entries(specs).filter(([k, v]) => v === true && k !== 'outputDir').map(([k]) => k);
  if (specList.length > 0) {
    const specDir = typeof specs.outputDir === 'string' ? ` → ${specs.outputDir}` : '';
    console.log(`  Spec formats:${specDir}`);
    for (const f of specList) console.log(`    - ${f}`);
  }

  // Find concepts
  const manifestConcepts = (yaml.concepts as string[] | undefined) || [];
  const explicitPaths = manifestConcepts.filter(c => c.endsWith('.concept'));
  let conceptCount = 0;
  if (explicitPaths.length > 0) {
    conceptCount = explicitPaths.filter(p => existsSync(resolve(projectDir, p))).length;
  } else {
    const specsDir = resolve(projectDir, 'specs', 'app');
    if (existsSync(specsDir)) {
      conceptCount = findFiles(specsDir, '.concept').length;
    } else {
      const altDir = resolve(projectDir, 'specs');
      if (existsSync(altDir)) {
        conceptCount = findFiles(altDir, '.concept').length;
      }
    }
  }
  console.log(`\n  Concepts: ${conceptCount}`);

  const estimatedFiles = conceptCount * targetList.length
    + conceptCount * sdkList.length
    + specList.length
    + targetList.length; // entrypoints
  console.log(`  Estimated output files: ~${estimatedFiles}`);
}

async function interfaceValidate(
  _positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const projectDir = resolve(process.cwd());
  const manifestPath = typeof flags.manifest === 'string'
    ? resolve(projectDir, flags.manifest)
    : resolve(projectDir, 'app.interface.yaml');

  if (!existsSync(manifestPath)) {
    console.error(`Interface manifest not found: ${relative(projectDir, manifestPath)}`);
    process.exit(1);
  }

  const source = readFileSync(manifestPath, 'utf-8');
  let yaml: Record<string, unknown>;
  try {
    yaml = parseManifestYaml(source);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`Failed to parse YAML: ${msg}`);
    process.exit(1);
  }

  console.log('Validating interface manifest...\n');

  const errors: string[] = [];
  const warnings: string[] = [];

  const targets = yaml.targets as Record<string, unknown> || {};
  const sdk = yaml.sdk as Record<string, unknown> || {};
  const specs = yaml.specs as Record<string, unknown> || {};

  if (Object.keys(targets).length === 0) {
    errors.push('No targets configured. Add at least one target (rest, graphql, grpc, cli, mcp).');
  }

  const validTargets = ['rest', 'graphql', 'grpc', 'cli', 'mcp', 'claude-skills'];
  for (const t of Object.keys(targets)) {
    if (!validTargets.includes(t)) {
      errors.push(`Unknown target: ${t}. Valid targets: ${validTargets.join(', ')}`);
    }
  }

  const validLanguages = ['typescript', 'python', 'go', 'rust', 'java', 'swift'];
  for (const l of Object.keys(sdk)) {
    if (!validLanguages.includes(l)) {
      warnings.push(`Unknown SDK language: ${l}. Known languages: ${validLanguages.join(', ')}`);
    }
  }

  const validFormats = ['openapi', 'asyncapi', 'outputDir'];
  for (const f of Object.keys(specs)) {
    if (!validFormats.includes(f)) {
      warnings.push(`Unknown spec format: ${f}. Known formats: openapi, asyncapi`);
    }
  }

  // Check for overlapping output directories
  const allOutputDirs: { name: string; dir: string }[] = [];
  for (const [name, config] of Object.entries(targets)) {
    const cfg = config as Record<string, unknown> | null;
    if (cfg?.outputDir && typeof cfg.outputDir === 'string') {
      allOutputDirs.push({ name: `target:${name}`, dir: resolve(projectDir, cfg.outputDir) });
    }
  }
  for (const [lang, config] of Object.entries(sdk)) {
    const cfg = config as Record<string, unknown> | null;
    if (cfg?.outputDir && typeof cfg.outputDir === 'string') {
      allOutputDirs.push({ name: `sdk:${lang}`, dir: resolve(projectDir, cfg.outputDir) });
    }
  }
  for (let i = 0; i < allOutputDirs.length; i++) {
    for (let j = i + 1; j < allOutputDirs.length; j++) {
      const a = allOutputDirs[i], b = allOutputDirs[j];
      if (a.dir === b.dir) {
        errors.push(`Overlapping outputDir: ${a.name} and ${b.name} both resolve to ${a.dir}`);
      }
    }
  }

  if (warnings.length > 0) {
    console.log(`  Warnings: ${warnings.length}`);
    for (const w of warnings) console.log(`    [WARN] ${w}`);
  }

  if (errors.length > 0) {
    console.log(`\n  Errors: ${errors.length}`);
    for (const e of errors) console.log(`    [FAIL] ${e}`);
    console.log('\nValidation failed.');
    process.exit(1);
  }

  console.log('  [OK] Interface manifest is valid.');
}

async function interfaceFiles(
  _positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const projectDir = resolve(process.cwd());

  // Try to use tracking manifest first
  const manifestPath = typeof flags.manifest === 'string'
    ? resolve(projectDir, flags.manifest)
    : resolve(projectDir, 'app.interface.yaml');
  const genManifestPath = resolve(dirname(manifestPath), '.copf-gen-manifest.json');
  const genManifest = loadGenManifest(genManifestPath);

  if (genManifest) {
    console.log(`Generated files (from tracking manifest):\n`);

    // Group by target
    const byTarget = new Map<string, GenManifestEntry[]>();
    for (const entry of genManifest.files) {
      const target = entry.target;
      if (!byTarget.has(target)) byTarget.set(target, []);
      byTarget.get(target)!.push(entry);
    }

    let totalFiles = 0;
    let totalBytes = 0;

    for (const [target, entries] of byTarget) {
      const dir = genManifest.targetDirs[target] || genManifest.targetDirs['_default'] || '';
      console.log(`  ${target}/ (${relative(projectDir, dir)})`);
      for (const entry of entries.sort((a, b) => a.relativePath.localeCompare(b.relativePath))) {
        const exists = existsSync(entry.path);
        const size = exists ? statSync(entry.path).size : 0;
        const status = exists ? '' : ' [MISSING]';
        console.log(`    ${entry.relativePath} (${size} bytes, ${entry.hash.slice(0, 8)})${status}`);
        totalFiles++;
        totalBytes += size;
      }
    }

    console.log(`\n${totalFiles} file(s), ${totalBytes} bytes total`);
    console.log(`Generated at: ${genManifest.generatedAt}`);
    return;
  }

  // Fallback: walk default output directory
  const outputDir = typeof flags.output === 'string'
    ? resolve(projectDir, flags.output)
    : resolve(projectDir, 'generated', 'interfaces');

  if (!existsSync(outputDir)) {
    console.log('No generated output directory or tracking manifest found.');
    return;
  }

  console.log(`Generated files in ${relative(projectDir, outputDir)}/:\n`);

  let totalFiles = 0;
  let totalBytes = 0;

  function walkDir(dir: string, indent: string = '  '): void {
    const entries = readdirSync(dir).sort();
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        console.log(`${indent}${entry}/`);
        walkDir(fullPath, indent + '  ');
      } else {
        const hash = createHash('sha256')
          .update(readFileSync(fullPath))
          .digest('hex')
          .slice(0, 8);
        console.log(`${indent}${entry} (${stat.size} bytes, ${hash})`);
        totalFiles++;
        totalBytes += stat.size;
      }
    }
  }

  walkDir(outputDir);
  console.log(`\n${totalFiles} file(s), ${totalBytes} bytes total`);
}

async function interfaceClean(
  _positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const projectDir = resolve(process.cwd());
  const dryRun = !!flags['dry-run'];

  // Use tracking manifest for cross-directory cleanup
  const manifestPath = typeof flags.manifest === 'string'
    ? resolve(projectDir, flags.manifest)
    : resolve(projectDir, 'app.interface.yaml');
  const genManifestPath = resolve(dirname(manifestPath), '.copf-gen-manifest.json');
  const genManifest = loadGenManifest(genManifestPath);

  if (genManifest) {
    console.log('Cleaning all generated files (from tracking manifest)');
    if (dryRun) console.log('  (dry run — no files will be removed)\n');

    let removed = 0;
    for (const entry of genManifest.files) {
      if (existsSync(entry.path)) {
        console.log(`  ${dryRun ? 'would remove' : 'removing'}: ${relative(projectDir, entry.path)}`);
        if (!dryRun) {
          unlinkSync(entry.path);
        }
        removed++;
      }
    }

    if (!dryRun) {
      // Remove tracking manifest itself
      unlinkSync(genManifestPath);
    }

    console.log(`\n${removed} file(s) ${dryRun ? 'would be' : ''} removed.`);
    return;
  }

  // Fallback: clean single output directory
  const outputDir = typeof flags.output === 'string'
    ? resolve(projectDir, flags.output)
    : resolve(projectDir, 'generated', 'interfaces');

  if (!existsSync(outputDir)) {
    console.log('No generated output directory or tracking manifest found. Nothing to clean.');
    return;
  }

  console.log(`Cleaning files in ${relative(projectDir, outputDir)}/`);
  if (dryRun) console.log('  (dry run — no files will be removed)\n');

  let orphanCount = 0;

  function findAndRemove(dir: string): void {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        findAndRemove(fullPath);
      } else {
        if (!dryRun) unlinkSync(fullPath);
        orphanCount++;
      }
    }
  }

  findAndRemove(outputDir);
  console.log(`\n${orphanCount} file(s) ${dryRun ? 'would be' : ''} removed.`);
}
