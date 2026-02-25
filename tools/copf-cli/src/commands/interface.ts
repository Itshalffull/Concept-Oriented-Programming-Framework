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

import { readFileSync, existsSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'fs';
import { join, resolve, relative, dirname } from 'path';
import { createHash } from 'crypto';
import { parse as parseYaml } from 'yaml';
import { parseConceptFile } from '../../../../implementations/typescript/framework/spec-parser.impl.js';
import { schemaGenHandler } from '../../../../implementations/typescript/framework/schema-gen.impl.js';
import { projectionHandler } from '../../../../implementations/typescript/framework/projection.impl.js';
import {
  createInterfaceGeneratorHandler,
  type InterfaceManifest,
  type GeneratedFile,
  type ProviderRegistry,
} from '../../../../implementations/typescript/framework/interface-generator.impl.js';
import { emitterHandler } from '../../../../implementations/typescript/framework/emitter.impl.js';
import { surfaceHandler } from '../../../../implementations/typescript/framework/surface.impl.js';
import { createInMemoryStorage } from '../../../../kernel/src/storage.js';
import type { ConceptManifest, ConceptAST } from '../../../../kernel/src/types.js';
import { findFiles } from '../util.js';

// --- Provider Imports ---
// Lazy-loaded to avoid import errors if files don't exist yet

async function loadProviders(): Promise<ProviderRegistry> {
  const providers: ProviderRegistry = {};
  const providerDir = '../../../../implementations/typescript/framework/providers';

  try {
    const { restTargetHandler } = await import(`${providerDir}/rest-target.impl.js`);
    providers.RestTarget = restTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { graphqlTargetHandler } = await import(`${providerDir}/graphql-target.impl.js`);
    providers.GraphqlTarget = graphqlTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { grpcTargetHandler } = await import(`${providerDir}/grpc-target.impl.js`);
    providers.GrpcTarget = grpcTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { cliTargetHandler } = await import(`${providerDir}/cli-target.impl.js`);
    providers.CliTarget = cliTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { mcpTargetHandler } = await import(`${providerDir}/mcp-target.impl.js`);
    providers.McpTarget = mcpTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { claudeSkillsTargetHandler } = await import(`${providerDir}/claude-skills-target.impl.js`);
    providers.ClaudeSkillsTarget = claudeSkillsTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { tsSdkTargetHandler } = await import(`${providerDir}/ts-sdk-target.impl.js`);
    providers.TsSdkTarget = tsSdkTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { pySdkTargetHandler } = await import(`${providerDir}/py-sdk-target.impl.js`);
    providers.PySdkTarget = pySdkTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { goSdkTargetHandler } = await import(`${providerDir}/go-sdk-target.impl.js`);
    providers.GoSdkTarget = goSdkTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { rustSdkTargetHandler } = await import(`${providerDir}/rust-sdk-target.impl.js`);
    providers.RustSdkTarget = rustSdkTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { javaSdkTargetHandler } = await import(`${providerDir}/java-sdk-target.impl.js`);
    providers.JavaSdkTarget = javaSdkTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { swiftSdkTargetHandler } = await import(`${providerDir}/swift-sdk-target.impl.js`);
    providers.SwiftSdkTarget = swiftSdkTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { openapiTargetHandler } = await import(`${providerDir}/openapi-target.impl.js`);
    providers.OpenapiTarget = openapiTargetHandler;
  } catch { /* provider not available */ }

  try {
    const { asyncapiTargetHandler } = await import(`${providerDir}/asyncapi-target.impl.js`);
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

  // Parse per-target output-dir overrides
  const targetOutputDirs: Record<string, string> = {};
  for (const [targetName, targetConfig] of Object.entries(targets)) {
    const config = targetConfig as Record<string, unknown> | undefined;
    if (config?.['output-dir'] && typeof config['output-dir'] === 'string') {
      targetOutputDirs[targetName] = config['output-dir'];
    }
  }
  for (const [lang, sdkConfig] of Object.entries(sdk)) {
    const config = sdkConfig as Record<string, unknown> | undefined;
    if (config?.['output-dir'] && typeof config['output-dir'] === 'string') {
      targetOutputDirs[`sdk/${lang}`] = config['output-dir'];
    }
  }

  return {
    kit: (iface.name as string) || '',
    version: String(iface.version || '1.0.0'),
    targets: Object.keys(targets),
    sdkLanguages: Object.keys(sdk),
    specFormats: Object.entries(specs)
      .filter(([_, v]) => v === true)
      .map(([k]) => k),
    concepts: conceptNames,
    outputDir: (output.dir as string) || './generated/interfaces',
    formatting: 'prettier',
    manifestYaml: yaml,
    targetOutputDirs: Object.keys(targetOutputDirs).length > 0 ? targetOutputDirs : undefined,
  };
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

  // 6. Write files to disk
  // Resolve per-target output directories: if a target has an output-dir
  // override, files for that target are written there (with the target
  // prefix stripped from the path). Otherwise, files go to the global
  // output dir with the target prefix preserved.
  const globalOutputDir = resolve(projectDir, manifest.outputDir);
  const targetDirs = manifest.targetOutputDirs || {};
  let writtenCount = 0;
  let skippedCount = 0;

  for (const file of allFiles) {
    // file.path looks like "cli/concept/file.ts" or "sdk/typescript/file.ts"
    const segments = file.path.split('/');
    const targetPrefix = segments[0];
    // For SDK paths like "sdk/typescript/...", the key is "sdk/typescript"
    const sdkKey = targetPrefix === 'sdk' && segments.length > 2
      ? `${segments[0]}/${segments[1]}`
      : undefined;

    let filePath: string;
    if (sdkKey && targetDirs[sdkKey]) {
      // SDK with custom output dir: strip "sdk/<lang>/" prefix
      const restPath = segments.slice(2).join('/');
      filePath = join(resolve(projectDir, targetDirs[sdkKey]), restPath);
    } else if (targetDirs[targetPrefix]) {
      // Target with custom output dir: strip target prefix
      const restPath = segments.slice(1).join('/');
      filePath = join(resolve(projectDir, targetDirs[targetPrefix]), restPath);
    } else {
      // Default: use global output dir with full path
      filePath = join(globalOutputDir, file.path);
    }

    const dir = dirname(filePath);
    mkdirSync(dir, { recursive: true });

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

  // 7. Print summary
  console.log(`\nGeneration complete:`);
  console.log(`  ${allFiles.length} total file(s)`);
  console.log(`  ${writtenCount} written, ${skippedCount} unchanged`);

  if (errors.length > 0) {
    console.log(`  ${errors.length} error(s):`);
    for (const err of errors) {
      console.log(`    [WARN] ${err}`);
    }
  }

  // Print per-target output locations
  const byTarget = new Map<string, number>();
  for (const file of allFiles) {
    const target = file.path.split('/')[0];
    byTarget.set(target, (byTarget.get(target) || 0) + 1);
  }
  for (const [target, count] of byTarget) {
    const customDir = targetDirs[target];
    const outputLabel = customDir
      ? relative(projectDir, resolve(projectDir, customDir))
      : `${relative(projectDir, globalOutputDir)}/${target}`;
    console.log(`    ${target}: ${count} file(s) → ${outputLabel}/`);
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
  console.log(`  Output dir: ${output.dir || 'generated/interfaces'}\n`);

  const targetList = Object.keys(targets);
  if (targetList.length > 0) {
    console.log('  Targets:');
    for (const t of targetList) {
      const tConfig = targets[t] as Record<string, unknown> | undefined;
      const customDir = tConfig?.['output-dir'] as string | undefined;
      const suffix = customDir ? ` → ${customDir}` : '';
      console.log(`    - ${t}${suffix}`);
    }
  } else {
    console.log('  Targets: (none configured)');
  }

  const sdkList = Object.keys(sdk);
  if (sdkList.length > 0) {
    console.log('  SDK languages:');
    for (const l of sdkList) console.log(`    - ${l}`);
  }

  const specList = Object.entries(specs).filter(([_, v]) => v === true).map(([k]) => k);
  if (specList.length > 0) {
    console.log('  Spec formats:');
    for (const f of specList) console.log(`    - ${f}`);
  }

  // Find concepts
  const specsDir = resolve(projectDir, 'specs', 'app');
  let conceptCount = 0;
  if (existsSync(specsDir)) {
    conceptCount = findFiles(specsDir, '.concept').length;
  } else {
    const altDir = resolve(projectDir, 'specs');
    if (existsSync(altDir)) {
      conceptCount = findFiles(altDir, '.concept').length;
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

  const validFormats = ['openapi', 'asyncapi'];
  for (const f of Object.keys(specs)) {
    if (!validFormats.includes(f)) {
      warnings.push(`Unknown spec format: ${f}. Known formats: ${validFormats.join(', ')}`);
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
  const outputDir = typeof flags.output === 'string'
    ? resolve(projectDir, flags.output)
    : resolve(projectDir, 'generated', 'interfaces');

  if (!existsSync(outputDir)) {
    console.log('No generated output directory found.');
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
  const outputDir = typeof flags.output === 'string'
    ? resolve(projectDir, flags.output)
    : resolve(projectDir, 'generated', 'interfaces');

  if (!existsSync(outputDir)) {
    console.log('No generated output directory found. Nothing to clean.');
    return;
  }

  const dryRun = !!flags['dry-run'];

  console.log(`Cleaning orphaned files in ${relative(projectDir, outputDir)}/`);
  if (dryRun) console.log('  (dry run — no files will be removed)\n');

  let orphanCount = 0;

  function findOrphans(dir: string): void {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        findOrphans(fullPath);
      }
    }
  }

  findOrphans(outputDir);
  console.log(`\n${orphanCount} orphaned file(s) ${dryRun ? 'would be' : ''} removed.`);
}
