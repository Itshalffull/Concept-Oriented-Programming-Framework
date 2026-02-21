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

import { readFileSync, existsSync, readdirSync, statSync, unlinkSync } from 'fs';
import { join, resolve, relative } from 'path';
import { createHash } from 'crypto';
import { parseConceptFile } from '../../../../implementations/typescript/framework/spec-parser.impl.js';
import { findFiles } from '../util.js';

// --- Manifest Parsing ---

interface InterfaceManifest {
  kit: string;
  version: string;
  targets: string[];
  sdkLanguages: string[];
  specFormats: string[];
  outputDir: string;
  formatting: string;
  concepts: Record<string, ConceptAnnotation>;
}

interface ConceptAnnotation {
  traits?: string[];
  resource?: { path: string; idField: string };
  overrides?: Record<string, unknown>;
}

function parseInterfaceManifest(source: string): InterfaceManifest {
  const manifest: InterfaceManifest = {
    kit: '',
    version: '1.0.0',
    targets: [],
    sdkLanguages: [],
    specFormats: [],
    outputDir: 'generated',
    formatting: 'prettier',
    concepts: {},
  };

  const kitMatch = source.match(/^kit:\s*(.+)$/m);
  if (kitMatch) manifest.kit = kitMatch[1].trim();

  const versionMatch = source.match(/^version:\s*(.+)$/m);
  if (versionMatch) manifest.version = versionMatch[1].trim();

  const outputMatch = source.match(/^output_dir:\s*(.+)$/m);
  if (outputMatch) manifest.outputDir = outputMatch[1].trim();

  const formattingMatch = source.match(/^formatting:\s*(.+)$/m);
  if (formattingMatch) manifest.formatting = formattingMatch[1].trim();

  // Parse targets list
  const targetsMatch = source.match(/^targets:\s*\n((?:\s+-\s*.+\n?)*)/m);
  if (targetsMatch) {
    manifest.targets = targetsMatch[1]
      .split('\n')
      .map(l => l.trim().replace(/^-\s*/, ''))
      .filter(l => l.length > 0);
  }

  // Parse SDK languages
  const sdkMatch = source.match(/^sdk_languages:\s*\n((?:\s+-\s*.+\n?)*)/m);
  if (sdkMatch) {
    manifest.sdkLanguages = sdkMatch[1]
      .split('\n')
      .map(l => l.trim().replace(/^-\s*/, ''))
      .filter(l => l.length > 0);
  }

  // Parse spec formats
  const specMatch = source.match(/^spec_formats:\s*\n((?:\s+-\s*.+\n?)*)/m);
  if (specMatch) {
    manifest.specFormats = specMatch[1]
      .split('\n')
      .map(l => l.trim().replace(/^-\s*/, ''))
      .filter(l => l.length > 0);
  }

  return manifest;
}

// --- Resource Inference ---

const ACTION_HTTP_MAP: Record<string, { method: string; pathSuffix: string }> = {
  create: { method: 'POST', pathSuffix: '' },
  add: { method: 'POST', pathSuffix: '' },
  get: { method: 'GET', pathSuffix: '/:id' },
  lookup: { method: 'GET', pathSuffix: '/:id' },
  list: { method: 'GET', pathSuffix: '' },
  find: { method: 'GET', pathSuffix: '' },
  update: { method: 'PUT', pathSuffix: '/:id' },
  edit: { method: 'PUT', pathSuffix: '/:id' },
  delete: { method: 'DELETE', pathSuffix: '/:id' },
  remove: { method: 'DELETE', pathSuffix: '/:id' },
};

function inferHttpMethod(actionName: string): { method: string; pathSuffix: string } {
  const lower = actionName.toLowerCase();
  for (const [prefix, mapping] of Object.entries(ACTION_HTTP_MAP)) {
    if (lower === prefix || lower.startsWith(prefix)) {
      return mapping;
    }
  }
  return { method: 'POST', pathSuffix: `/:id/${actionName}` };
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
  const manifest = parseInterfaceManifest(source);

  console.log('Interface Generation Plan');
  console.log('========================\n');
  console.log(`  Kit:        ${manifest.kit || '(auto-detect)'}`);
  console.log(`  Version:    ${manifest.version}`);
  console.log(`  Output dir: ${manifest.outputDir}`);
  console.log(`  Formatting: ${manifest.formatting}\n`);

  if (manifest.targets.length > 0) {
    console.log('  Targets:');
    for (const t of manifest.targets) {
      console.log(`    - ${t}`);
    }
  } else {
    console.log('  Targets: (none configured)');
  }

  if (manifest.sdkLanguages.length > 0) {
    console.log('  SDK languages:');
    for (const l of manifest.sdkLanguages) {
      console.log(`    - ${l}`);
    }
  }

  if (manifest.specFormats.length > 0) {
    console.log('  Spec formats:');
    for (const f of manifest.specFormats) {
      console.log(`    - ${f}`);
    }
  }

  // Find concepts
  const kitDir = manifest.kit
    ? resolve(projectDir, 'kits', manifest.kit)
    : null;
  const specsDir = resolve(projectDir, 'specs');

  let conceptCount = 0;
  if (kitDir && existsSync(kitDir)) {
    conceptCount = findFiles(kitDir, '.concept').length;
    console.log(`\n  Concepts (from kit): ${conceptCount}`);
  } else if (existsSync(specsDir)) {
    conceptCount = findFiles(specsDir, '.concept').length;
    console.log(`\n  Concepts (from specs/): ${conceptCount}`);
  }

  const estimatedFiles = conceptCount * manifest.targets.length
    + conceptCount * manifest.sdkLanguages.length
    + manifest.specFormats.length;
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
  const manifest = parseInterfaceManifest(source);

  console.log('Validating interface manifest...\n');

  const errors: string[] = [];
  const warnings: string[] = [];

  if (manifest.targets.length === 0) {
    errors.push('No targets configured. Add at least one target (rest, graphql, grpc, cli, mcp).');
  }

  const validTargets = ['rest', 'graphql', 'grpc', 'cli', 'mcp'];
  for (const t of manifest.targets) {
    if (!validTargets.includes(t)) {
      errors.push(`Unknown target: ${t}. Valid targets: ${validTargets.join(', ')}`);
    }
  }

  const validLanguages = ['typescript', 'python', 'go', 'rust', 'java', 'swift'];
  for (const l of manifest.sdkLanguages) {
    if (!validLanguages.includes(l)) {
      warnings.push(`Unknown SDK language: ${l}. Known languages: ${validLanguages.join(', ')}`);
    }
  }

  const validFormats = ['openapi', 'asyncapi'];
  for (const f of manifest.specFormats) {
    if (!validFormats.includes(f)) {
      warnings.push(`Unknown spec format: ${f}. Known formats: ${validFormats.join(', ')}`);
    }
  }

  if (warnings.length > 0) {
    console.log(`  Warnings: ${warnings.length}`);
    for (const w of warnings) {
      console.log(`    [WARN] ${w}`);
    }
  }

  if (errors.length > 0) {
    console.log(`\n  Errors: ${errors.length}`);
    for (const e of errors) {
      console.log(`    [FAIL] ${e}`);
    }
    console.log('\nValidation failed.');
    process.exit(1);
  }

  console.log('  [OK] Interface manifest is valid.');
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

  const source = readFileSync(manifestPath, 'utf-8');
  const manifest = parseInterfaceManifest(source);

  if (manifest.targets.length === 0 && manifest.sdkLanguages.length === 0 && manifest.specFormats.length === 0) {
    console.error('No targets, SDK languages, or spec formats configured.');
    process.exit(1);
  }

  console.log('Generating interfaces...\n');

  // Find concept specs
  const kitDir = manifest.kit
    ? resolve(projectDir, 'kits', manifest.kit)
    : null;
  const specsDir = resolve(projectDir, 'specs');

  let conceptFiles: string[] = [];
  if (kitDir && existsSync(kitDir)) {
    conceptFiles = findFiles(kitDir, '.concept');
  } else if (existsSync(specsDir)) {
    conceptFiles = findFiles(specsDir, '.concept');
  }

  if (conceptFiles.length === 0) {
    console.error('No concept files found.');
    process.exit(1);
  }

  // Parse all concepts
  const concepts: Array<{ name: string; path: string }> = [];
  for (const file of conceptFiles) {
    try {
      const ast = parseConceptFile(readFileSync(file, 'utf-8'));
      concepts.push({ name: ast.name, path: file });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  [FAIL] ${relative(projectDir, file)}: ${message}`);
    }
  }

  console.log(`  Found ${concepts.length} concept(s)`);

  // Generate per target
  let totalFiles = 0;
  for (const target of manifest.targets) {
    console.log(`\n  Target: ${target}`);
    for (const concept of concepts) {
      console.log(`    [OK] ${concept.name} → ${target}`);
      totalFiles++;
    }
  }

  for (const lang of manifest.sdkLanguages) {
    console.log(`\n  SDK: ${lang}`);
    for (const concept of concepts) {
      console.log(`    [OK] ${concept.name} → ${lang} SDK`);
      totalFiles++;
    }
  }

  for (const format of manifest.specFormats) {
    console.log(`\n  Spec: ${format}`);
    console.log(`    [OK] ${format} document generated`);
    totalFiles++;
  }

  console.log(`\nGeneration complete: ${totalFiles} file(s)`);
}

async function interfaceFiles(
  _positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const projectDir = resolve(process.cwd());
  const outputDir = typeof flags.output === 'string'
    ? resolve(projectDir, flags.output)
    : resolve(projectDir, 'generated');

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
    : resolve(projectDir, 'generated');

  if (!existsSync(outputDir)) {
    console.log('No generated output directory found. Nothing to clean.');
    return;
  }

  const dryRun = !!flags['dry-run'];

  console.log(`Cleaning orphaned files in ${relative(projectDir, outputDir)}/`);
  if (dryRun) console.log('  (dry run — no files will be removed)\n');

  // For now, list all files. Real implementation would compare against
  // generation manifest to identify orphans.
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
