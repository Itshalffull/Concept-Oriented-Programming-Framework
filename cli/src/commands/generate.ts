// ============================================================
// clef generate [--target <lang>] [--concept <Name>]
//
// Generates schemas and code for all (or a single) concept.
//
// Pipeline per Section 7.2:
//   1. Parse .concept → AST
//   2. SchemaGen (AST → ConceptManifest)
//   3. CodeGen (Manifest → target-language files)
//
// Generation kit integration (clef-generation-suite.md Part 6):
//   --plan       Show what would run without executing
//   --dry-run    Show file changes without writing
//   --force      Force full rebuild (invalidate all caches)
//   --status     Show live progress during generation
//   --summary    Show post-run statistics
//   --history    Show recent generation runs
//   --audit      Check generated files for drift
//   --clean      Remove orphaned generated files
//   --family     Filter by generation family
//   --generator-syncs  Auto-generate per-generator sync files
//
// Generated output goes to the generated/ directory.
// ============================================================

import { readFileSync, readdirSync, statSync, mkdirSync, writeFileSync, existsSync } from 'fs';
import { resolve, relative, join, basename } from 'path';
import { createHash } from 'crypto';
import { parseConceptFile } from '../../../handlers/ts/framework/spec-parser.handler.js';
import { createInMemoryStorage } from '../../../runtime/adapters/storage.js';
import { schemaGenHandler } from '../../../handlers/ts/framework/schema-gen.handler.js';
import { typescriptGenHandler } from '../../../handlers/ts/framework/typescript-gen.handler.js';
import { rustGenHandler } from '../../../handlers/ts/framework/rust-gen.handler.js';
import { swiftGenHandler } from '../../../handlers/ts/framework/swift-gen.handler.js';
import { solidityGenHandler } from '../../../handlers/ts/framework/solidity-gen.handler.js';
import { handlerGenHandler } from '../../../handlers/ts/framework/handler-gen.handler.js';
import { nextjsGenHandler } from '../../../handlers/ts/framework/nextjs-gen.handler.js';
import { emitterHandler } from '../../../handlers/ts/framework/emitter.handler.js';
import { buildCacheHandler } from '../../../../kits/generation/handlers/ts/build-cache.handler.js';
import { generationPlanHandler } from '../../../../kits/generation/handlers/ts/generation-plan.handler.js';
import { resourceHandler } from '../../../../kits/generation/handlers/ts/resource.handler.js';
import { kindSystemHandler } from '../../../../kits/generation/handlers/ts/kind-system.handler.js';
import type { ConceptAST, ConceptHandler, ConceptManifest } from '../../../runtime/types.js';
import { findFiles } from '../util.js';

const SUPPORTED_TARGETS = ['typescript', 'rust', 'swift', 'solidity', 'nextjs', 'handler'] as const;
type Target = (typeof SUPPORTED_TARGETS)[number];

// Map target names to output directory names per clef-naming-reference.md
const TARGET_DIR_NAMES: Record<string, string> = {
  typescript: 'ts',
  rust: 'rust',
  swift: 'swift',
  solidity: 'solidity',
  nextjs: 'nextjs',
};

const GENERATOR_META: Record<string, {
  name: string;
  family: string;
  inputKind: string;
  outputKind: string;
  deterministic: boolean;
  handler: ConceptHandler;
}> = {
  typescript: {
    name: 'TypeScriptGen',
    family: 'framework',
    inputKind: 'ConceptManifest',
    outputKind: 'TypeScriptFiles',
    deterministic: true,
    handler: typescriptGenHandler,
  },
  rust: {
    name: 'RustGen',
    family: 'framework',
    inputKind: 'ConceptManifest',
    outputKind: 'RustFiles',
    deterministic: true,
    handler: rustGenHandler,
  },
  swift: {
    name: 'SwiftGen',
    family: 'framework',
    inputKind: 'ConceptManifest',
    outputKind: 'SwiftFiles',
    deterministic: true,
    handler: swiftGenHandler,
  },
  solidity: {
    name: 'SolidityGen',
    family: 'framework',
    inputKind: 'ConceptManifest',
    outputKind: 'SolidityFiles',
    deterministic: true,
    handler: solidityGenHandler,
  },
  nextjs: {
    name: 'NextjsGen',
    family: 'framework',
    inputKind: 'ConceptManifest',
    outputKind: 'NextjsFiles',
    deterministic: true,
    handler: nextjsGenHandler,
  },
  handler: {
    name: 'HandlerGen',
    family: 'framework',
    inputKind: 'ConceptManifest',
    outputKind: 'HandlerImplFiles',
    deterministic: true,
    handler: handlerGenHandler,
  },
};

function computeHash(content: string): string {
  return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

export async function generateCommand(
  _positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  // --- Dispatch to subcommands ---

  if (flags.plan) return generatePlan(flags);
  if (flags['dry-run']) return generateDryRun(flags);
  if (flags.audit) return generateAudit(flags);
  if (flags.clean) return generateClean(flags);
  if (flags.summary) return generateSummary(flags);
  if (flags.history) return generateHistory(flags);
  if (flags.status) return generateStatus(flags);
  if (flags['generator-syncs']) return generateSyncFiles(flags);

  // --- Main generation pipeline ---

  const target = flags.target as string;
  if (!target || !SUPPORTED_TARGETS.includes(target as Target)) {
    console.error(
      `Usage: clef generate --target <${SUPPORTED_TARGETS.join('|')}> [options]`,
    );
    console.error('\nOptions:');
    console.error('  --concept <Name>   Generate for a single concept only');
    console.error('  --force            Force full rebuild (invalidate all caches)');
    console.error('  --plan             Show what would run without executing');
    console.error('  --dry-run          Show file changes without writing');
    console.error('  --summary          Show post-run statistics for last run');
    console.error('  --history          Show recent generation runs');
    console.error('  --status           Show status of current/last run');
    console.error('  --audit            Check generated files for drift');
    console.error('  --clean            Remove orphaned generated files');
    console.error('  --generator-syncs  Auto-generate per-generator sync files');
    process.exit(1);
  }

  const meta = GENERATOR_META[target];
  const filterConcept = flags.concept as string | undefined;
  const filterFamily = flags.family as string | undefined;
  const forceRebuild = flags.force === true;
  const projectDir = resolve(process.cwd());
  const specsDir = typeof flags.specs === 'string' ? flags.specs : 'concepts';
  const outDir = typeof flags.out === 'string' ? flags.out : 'generated';

  // Initialize generation suite storages
  const cacheStorage = createInMemoryStorage();
  const planStorage = createInMemoryStorage();
  const emitStorage = createInMemoryStorage();
  const resourceStorage = createInMemoryStorage();

  // Force rebuild: invalidate all caches
  if (forceRebuild) {
    const invalidateResult = await buildCacheHandler.invalidateAll({}, cacheStorage);
    console.log(`Force rebuild: cleared ${invalidateResult.cleared || 0} cache entries.\n`);
  }

  // Begin generation run
  const beginResult = await generationPlanHandler.begin({}, planStorage);
  const runId = beginResult.run as string;
  const runStartTime = Date.now();

  // Scan for concept files. Handler target scans both concepts/ and suites/ by default.
  let conceptFiles: string[];
  if (specsDir === 'all' || (target === 'handler' && specsDir === 'concepts')) {
    conceptFiles = [
      ...findFiles(resolve(projectDir, 'concepts'), '.concept'),
      ...findFiles(resolve(projectDir, 'suites'), '.concept'),
    ];
  } else {
    conceptFiles = findFiles(resolve(projectDir, specsDir), '.concept');
  }

  if (conceptFiles.length === 0) {
    console.log('No .concept files found.');
    await generationPlanHandler.complete({}, planStorage);
    return;
  }

  // Filter by family if specified
  if (filterFamily && meta.family !== filterFamily) {
    console.log(`Skipping ${meta.name}: family "${meta.family}" does not match filter "${filterFamily}".`);
    await generationPlanHandler.complete({}, planStorage);
    return;
  }

  // Parse all specs
  let parseFailures = 0;
  const asts: { file: string; ast: ConceptAST }[] = [];
  for (const file of conceptFiles) {
    const source = readFileSync(file, 'utf-8');
    try {
      const ast = parseConceptFile(source);
      if (filterConcept && ast.name !== filterConcept) continue;
      asts.push({ file: relative(projectDir, file), ast });

      // Track input resource
      const digest = computeHash(source);
      await resourceHandler.upsert(
        { locator: relative(projectDir, file), kind: 'concept-spec', digest },
        resourceStorage,
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`  [FAIL] Parse ${relative(projectDir, file)}: ${message}`);
      parseFailures++;
      continue;
    }
  }

  if (filterConcept && asts.length === 0) {
    console.error(`Concept "${filterConcept}" not found in spec files.`);
    await generationPlanHandler.complete({}, planStorage);
    process.exit(1);
  }

  // For handler target: build index of existing impl stems to avoid duplicates
  // regardless of directory layout
  const existingImplStems = new Set<string>();
  if (target === 'handler') {
    function walkForImpls(dir: string): void {
      try {
        for (const entry of readdirSync(dir)) {
          const full = join(dir, entry);
          try {
            const st = statSync(full);
            if (st.isDirectory()) walkForImpls(full);
            else if (entry.endsWith('.handler.ts')) {
              existingImplStems.add(basename(entry, '.handler.ts'));
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
    walkForImpls(join(projectDir, 'handlers'));
    walkForImpls(join(projectDir, 'generated'));
    walkForImpls(join(projectDir, 'suites'));
  }

  console.log(
    `Generating ${target} code for ${asts.length} concept(s)...\n`,
  );

  let totalFiles = 0;
  let cachedCount = 0;
  let executedCount = 0;
  let failedCount = 0;
  let writtenCount = 0;
  let skippedCount = 0;

  for (const { file, ast } of asts) {
    const stepStartTime = Date.now();
    const stepKey = `${meta.family}:${meta.name}:${ast.name}`;

    // SchemaGen — produce ConceptManifest
    const schemaStorage = createInMemoryStorage();
    const schemaResult = await schemaGenHandler.generate(
      { spec: file, ast },
      schemaStorage,
    );

    if (schemaResult.variant !== 'ok') {
      console.error(`Schema generation failed for ${ast.name}: ${schemaResult.message}`);
      await generationPlanHandler.recordStep(
        { stepKey, status: 'failed', cached: false },
        planStorage,
      );
      failedCount++;
      continue;
    }

    const manifest = schemaResult.manifest as ConceptManifest;

    // BuildCache check — skip if input unchanged
    const inputHash = computeHash(JSON.stringify(manifest));
    const cacheCheck = await buildCacheHandler.check(
      { stepKey, inputHash, deterministic: meta.deterministic },
      cacheStorage,
    );

    if (cacheCheck.variant === 'unchanged') {
      console.log(`  ${ast.name}: cached (skip)`);
      await generationPlanHandler.recordStep(
        { stepKey, status: 'cached', cached: true },
        planStorage,
      );
      cachedCount++;
      continue;
    }

    // Handler target skips schema generation (writes impls, not schemas)
    if (target !== 'handler') {
      // Write JSON schemas (under generated/openapi/ for spec output)
      const jsonSchemaDir = join(projectDir, outDir, 'openapi', ast.name.toLowerCase());
      mkdirSync(jsonSchemaDir, { recursive: true });
      writeFileSync(
        join(jsonSchemaDir, 'manifest.json'),
        JSON.stringify(manifest, null, 2) + '\n',
      );

      // Write GraphQL schema fragment
      const gqlDir = join(projectDir, outDir, 'graphql');
      mkdirSync(gqlDir, { recursive: true });
      writeFileSync(
        join(gqlDir, `${ast.name.toLowerCase()}.graphql`),
        manifest.graphqlSchema + '\n',
      );
    }

    // CodeGen — produce target-language files
    const codeStorage = createInMemoryStorage();
    const codeResult = await meta.handler.generate(
      { spec: file, manifest },
      codeStorage,
    );

    if (codeResult.variant !== 'ok') {
      console.error(
        `Code generation failed for ${ast.name}: ${codeResult.message}`,
      );
      await generationPlanHandler.recordStep(
        { stepKey, status: 'failed', cached: false },
        planStorage,
      );
      failedCount++;
      continue;
    }

    const files = codeResult.files as { path: string; content: string }[];

    // Write files through Emitter for content-addressed writes
    let stepFilesWritten = 0;
    let stepFilesSkipped = 0;

    // Handler target: files contain project-relative paths (write to project root)
    // Other targets: files are relative to generated/<target>/
    const targetDir = target === 'handler' ? projectDir : join(projectDir, outDir, TARGET_DIR_NAMES[target] || target);

    for (const f of files) {
      const filePath = join(targetDir, f.path);

      // Handler target: no-clobber — skip if any impl with same stem exists
      if (target === 'handler') {
        const stem = basename(f.path, '.handler.ts');
        if (existingImplStems.has(stem) || existsSync(filePath)) {
          stepFilesSkipped++;
          skippedCount++;
          continue;
        }
      }

      mkdirSync(join(filePath, '..'), { recursive: true });

      const writeResult = await emitterHandler.write(
        {
          path: filePath,
          content: f.content + '\n',
          target,
          concept: ast.name,
          sources: [{ sourcePath: file, conceptName: ast.name }],
        },
        emitStorage,
      );

      if (writeResult.variant === 'ok' && writeResult.written) {
        // Emitter only tracks in ConceptStorage — write to disk
        writeFileSync(filePath, f.content + '\n');
        stepFilesWritten++;
        writtenCount++;
      } else {
        stepFilesSkipped++;
        skippedCount++;
      }
    }

    // Record cache entry
    const outputHash = computeHash(JSON.stringify(files));
    await buildCacheHandler.record(
      {
        stepKey,
        inputHash,
        outputHash,
        sourceLocator: file,
        deterministic: meta.deterministic,
      },
      cacheStorage,
    );

    const stepDuration = Date.now() - stepStartTime;
    totalFiles += files.length + 2; // +2 for manifest.json and .graphql

    // Record step in GenerationPlan
    await generationPlanHandler.recordStep(
      {
        stepKey,
        status: 'done',
        filesProduced: files.length,
        duration: stepDuration,
        cached: false,
      },
      planStorage,
    );

    executedCount++;
    console.log(
      `  ${ast.name}: ${files.length} ${target} file(s) + schemas` +
      ` (${stepFilesWritten} written, ${stepFilesSkipped} unchanged, ${stepDuration}ms)`,
    );
  }

  // Complete generation run
  await generationPlanHandler.complete({}, planStorage);
  const totalDuration = Date.now() - runStartTime;

  // Print summary
  console.log(`\nGeneration complete (${totalDuration}ms):`);
  console.log(`  ${totalFiles} total file(s) to ${outDir}/`);
  console.log(`  ${executedCount} executed, ${cachedCount} cached, ${failedCount} failed`);
  console.log(`  ${writtenCount} written, ${skippedCount} unchanged`);

  if (failedCount > 0) {
    process.exit(1);
  }
}

// --- Subcommand: --plan ---

async function generatePlan(
  flags: Record<string, string | boolean>,
): Promise<void> {
  const projectDir = resolve(process.cwd());
  const specsDir = typeof flags.specs === 'string' ? flags.specs : 'concepts';
  const filterFamily = flags.family as string | undefined;
  const filterTarget = flags.target as string | undefined;

  const cacheStorage = createInMemoryStorage();
  const kindStorage = createInMemoryStorage();

  // Register standard kind taxonomy
  await kindSystemHandler.define({ name: 'ConceptDSL', category: 'source' }, kindStorage);
  await kindSystemHandler.define({ name: 'ConceptAST', category: 'model' }, kindStorage);
  await kindSystemHandler.define({ name: 'ConceptManifest', category: 'model' }, kindStorage);
  await kindSystemHandler.connect(
    { from: 'ConceptDSL', to: 'ConceptAST', relation: 'parses_to', transformName: 'SpecParser' },
    kindStorage,
  );
  await kindSystemHandler.connect(
    { from: 'ConceptAST', to: 'ConceptManifest', relation: 'normalizes_to', transformName: 'SchemaGen' },
    kindStorage,
  );

  // Register generator kinds
  for (const [targetKey, meta] of Object.entries(GENERATOR_META)) {
    if (filterFamily && meta.family !== filterFamily) continue;
    if (filterTarget && targetKey !== filterTarget) continue;

    await kindSystemHandler.define({ name: meta.outputKind, category: 'artifact' }, kindStorage);
    await kindSystemHandler.connect(
      { from: meta.inputKind, to: meta.outputKind, relation: 'renders_to', transformName: meta.name },
      kindStorage,
    );
  }

  // Count concept files
  const conceptFiles = findFiles(resolve(projectDir, specsDir), '.concept');

  // Get stale steps
  const staleResult = await buildCacheHandler.staleSteps({}, cacheStorage);
  const staleSteps = (staleResult.steps as string[]) || [];

  // Get full graph
  const graphResult = await kindSystemHandler.graph({}, kindStorage);
  const kinds = (graphResult.kinds as { name: string; category: string }[]) || [];
  const edges = (graphResult.edges as { from: string; to: string; relation: string; transform: string | null }[]) || [];

  console.log('Generation Plan');
  console.log('===============\n');
  console.log(`  Source files: ${conceptFiles.length} .concept file(s)`);
  console.log(`  Kind taxonomy: ${kinds.length} kind(s), ${edges.length} edge(s)`);
  console.log(`  Stale steps: ${staleSteps.length}`);
  console.log('');

  // Display kind graph
  console.log('  Pipeline:');
  for (const edge of edges) {
    const transform = edge.transform ? ` (${edge.transform})` : '';
    console.log(`    ${edge.from} --${edge.relation}--> ${edge.to}${transform}`);
  }
  console.log('');

  // Display per-target plan
  console.log('  Steps:');
  for (const [targetKey, meta] of Object.entries(GENERATOR_META)) {
    if (filterFamily && meta.family !== filterFamily) continue;
    if (filterTarget && targetKey !== filterTarget) continue;

    for (const file of conceptFiles) {
      const relFile = relative(projectDir, file);
      const source = readFileSync(file, 'utf-8');
      let conceptName = '(unknown)';
      try {
        conceptName = parseConceptFile(source).name;
      } catch { /* skip */ }

      const stepKey = `${meta.family}:${meta.name}:${conceptName}`;
      const isStale = staleSteps.includes(stepKey);

      // Check cache
      const inputHash = computeHash(source);
      const cacheResult = await buildCacheHandler.check(
        { stepKey, inputHash, deterministic: meta.deterministic },
        cacheStorage,
      );

      const willRun = cacheResult.variant === 'changed' || isStale;
      const reason = willRun
        ? (isStale ? 'dependency stale' : 'no cache entry — first run')
        : 'cached — skip';
      const marker = willRun ? 'RUN' : 'SKIP';

      console.log(`    [${marker}] ${stepKey} — ${reason}`);
    }
  }

  const totalSteps = conceptFiles.length * Object.keys(GENERATOR_META).length;
  console.log(`\n  Total: ${totalSteps} step(s)`);
}

// --- Subcommand: --dry-run ---

async function generateDryRun(
  flags: Record<string, string | boolean>,
): Promise<void> {
  const projectDir = resolve(process.cwd());
  const specsDir = typeof flags.specs === 'string' ? flags.specs : 'concepts';
  const outDir = typeof flags.out === 'string' ? flags.out : 'generated';
  const target = flags.target as string;

  if (!target || !SUPPORTED_TARGETS.includes(target as Target)) {
    console.error('Usage: clef generate --dry-run --target <lang>');
    process.exit(1);
  }

  const meta = GENERATOR_META[target];
  const conceptFiles = findFiles(resolve(projectDir, specsDir), '.concept');

  console.log('Dry Run — Changes that would be made:\n');

  let addCount = 0;
  let modifyCount = 0;
  let removeCount = 0;

  for (const file of conceptFiles) {
    const source = readFileSync(file, 'utf-8');
    let ast: ConceptAST;
    try {
      ast = parseConceptFile(source);
    } catch { continue; }

    const schemaStorage = createInMemoryStorage();
    const schemaResult = await schemaGenHandler.generate(
      { spec: relative(projectDir, file), ast },
      schemaStorage,
    );
    if (schemaResult.variant !== 'ok') continue;

    const manifest = schemaResult.manifest as ConceptManifest;
    const codeStorage = createInMemoryStorage();
    const codeResult = await meta.handler.generate(
      { spec: relative(projectDir, file), manifest },
      codeStorage,
    );
    if (codeResult.variant !== 'ok') continue;

    const files = codeResult.files as { path: string; content: string }[];
    const targetDir = join(projectDir, outDir, TARGET_DIR_NAMES[target] || target);

    for (const f of files) {
      const filePath = join(targetDir, f.path);
      const relPath = relative(projectDir, filePath);

      if (!existsSync(filePath)) {
        console.log(`  [ADD]    ${relPath}`);
        addCount++;
      } else {
        const existing = readFileSync(filePath, 'utf-8');
        if (existing !== f.content + '\n') {
          console.log(`  [MODIFY] ${relPath}`);
          modifyCount++;
        }
        // unchanged files not shown
      }
    }
  }

  console.log(`\n  ${addCount} add, ${modifyCount} modify, ${removeCount} remove`);
}

// --- Subcommand: --audit ---

async function generateAudit(
  flags: Record<string, string | boolean>,
): Promise<void> {
  const projectDir = resolve(process.cwd());
  const outDir = typeof flags.out === 'string' ? flags.out : 'generated';
  const outputDir = resolve(projectDir, outDir);
  const emitStorage = createInMemoryStorage();

  const auditResult = await emitterHandler.audit(
    { outputDir },
    emitStorage,
  );

  const statuses = (auditResult.status as { path: string; state: string }[]) || [];

  console.log('Audit — Generated File Status:\n');

  const drifted = statuses.filter(s => s.state === 'drifted');
  const missing = statuses.filter(s => s.state === 'missing');
  const orphaned = statuses.filter(s => s.state === 'orphaned');
  const current = statuses.filter(s => s.state === 'current');

  if (current.length > 0) {
    console.log(`  ${current.length} file(s) current`);
  }
  if (drifted.length > 0) {
    console.log(`\n  DRIFTED (manually edited):`);
    for (const s of drifted) {
      console.log(`    ${relative(projectDir, s.path)}`);
    }
  }
  if (missing.length > 0) {
    console.log(`\n  MISSING (in manifest, not on disk):`);
    for (const s of missing) {
      console.log(`    ${relative(projectDir, s.path)}`);
    }
  }
  if (orphaned.length > 0) {
    console.log(`\n  ORPHANED (on disk, not in manifest):`);
    for (const s of orphaned) {
      console.log(`    ${relative(projectDir, s.path)}`);
    }
  }

  if (drifted.length === 0 && missing.length === 0 && orphaned.length === 0) {
    console.log('  All generated files are current. No drift detected.');
  }
}

// --- Subcommand: --clean ---

async function generateClean(
  flags: Record<string, string | boolean>,
): Promise<void> {
  const projectDir = resolve(process.cwd());
  const outDir = typeof flags.out === 'string' ? flags.out : 'generated';
  const outputDir = resolve(projectDir, outDir);
  const emitStorage = createInMemoryStorage();

  const manifestResult = await emitterHandler.manifest(
    { outputDir },
    emitStorage,
  );
  const manifestFiles = (manifestResult.files as { path: string }[]) || [];
  const currentPaths = manifestFiles.map(f => f.path);

  const cleanResult = await emitterHandler.clean(
    { outputDir, currentManifest: currentPaths },
    emitStorage,
  );

  const removed = (cleanResult.removed as string[]) || [];

  if (removed.length === 0) {
    console.log('No orphaned files found.');
  } else {
    console.log(`Removed ${removed.length} orphaned file(s):`);
    for (const path of removed) {
      console.log(`  ${relative(projectDir, path)}`);
    }
  }
}

// --- Subcommand: --summary ---

async function generateSummary(
  flags: Record<string, string | boolean>,
): Promise<void> {
  const planStorage = createInMemoryStorage();
  const histResult = await generationPlanHandler.history({ limit: 1 }, planStorage);
  const runs = (histResult.runs as { run: string }[]) || [];

  if (runs.length === 0) {
    console.log('No generation runs recorded in this session.');
    return;
  }

  const runId = runs[0].run;
  const summaryResult = await generationPlanHandler.summary(
    { run: runId },
    planStorage,
  );

  if (summaryResult.variant !== 'ok') {
    console.log('No summary available for the last run.');
    return;
  }

  console.log('Generation Summary');
  console.log('==================\n');
  console.log(`  Total steps:     ${summaryResult.total}`);
  console.log(`  Executed:        ${summaryResult.executed}`);
  console.log(`  Cached (skip):   ${summaryResult.cached}`);
  console.log(`  Failed:          ${summaryResult.failed}`);
  console.log(`  Files produced:  ${summaryResult.filesProduced}`);
}

// --- Subcommand: --history ---

async function generateHistory(
  flags: Record<string, string | boolean>,
): Promise<void> {
  const limit = typeof flags.limit === 'string' ? parseInt(flags.limit, 10) : 10;
  const planStorage = createInMemoryStorage();

  const histResult = await generationPlanHandler.history({ limit }, planStorage);
  const runs = (histResult.runs as {
    run: string;
    startedAt: string;
    completedAt: string | null;
    total: number;
    executed: number;
    cached: number;
    failed: number;
  }[]) || [];

  if (runs.length === 0) {
    console.log('No generation runs recorded in this session.');
    return;
  }

  console.log('Generation History');
  console.log('==================\n');

  for (const run of runs) {
    const started = run.startedAt ? new Date(run.startedAt).toLocaleString() : '?';
    const status = run.completedAt ? 'complete' : 'in progress';
    console.log(
      `  ${run.run.slice(0, 8)}  ${started}  ${run.executed} executed  ${run.cached} cached  ${run.failed} failed  [${status}]`,
    );
  }
}

// --- Subcommand: --status ---

async function generateStatus(
  flags: Record<string, string | boolean>,
): Promise<void> {
  const planStorage = createInMemoryStorage();
  const histResult = await generationPlanHandler.history({ limit: 1 }, planStorage);
  const runs = (histResult.runs as { run: string }[]) || [];

  if (runs.length === 0) {
    console.log('No generation runs recorded in this session.');
    return;
  }

  const runId = runs[0].run;
  const statusResult = await generationPlanHandler.status(
    { run: runId },
    planStorage,
  );

  const steps = (statusResult.steps as {
    stepKey: string;
    status: string;
    duration: number;
    cached: boolean;
    filesProduced: number;
  }[]) || [];

  console.log('Generation Status');
  console.log('=================\n');

  for (const step of steps) {
    const dur = step.duration > 0 ? ` (${step.duration}ms)` : '';
    const files = step.filesProduced > 0 ? `, ${step.filesProduced} files` : '';
    console.log(`  [${step.status.toUpperCase().padEnd(6)}] ${step.stepKey}${dur}${files}`);
  }

  if (steps.length === 0) {
    console.log('  No steps recorded yet.');
  }
}

// --- Subcommand: --generator-syncs ---

// Interface target providers: targets, SDKs, and spec formats
// These receive Projection input (from InterfaceGenerator) rather than ConceptManifest
export const INTERFACE_TARGET_META: {
  name: string;
  family: string;
  inputKind: string;
  outputKind: string;
  deterministic: boolean;
  category: 'target' | 'sdk' | 'spec';
}[] = [
  // Target providers
  { name: 'RestTarget', family: 'interface', inputKind: 'Projection', outputKind: 'RestFiles', deterministic: true, category: 'target' },
  { name: 'GraphqlTarget', family: 'interface', inputKind: 'Projection', outputKind: 'GraphqlFiles', deterministic: true, category: 'target' },
  { name: 'GrpcTarget', family: 'interface', inputKind: 'Projection', outputKind: 'GrpcFiles', deterministic: true, category: 'target' },
  { name: 'CliTarget', family: 'interface', inputKind: 'Projection', outputKind: 'CliFiles', deterministic: true, category: 'target' },
  { name: 'McpTarget', family: 'interface', inputKind: 'Projection', outputKind: 'McpFiles', deterministic: true, category: 'target' },
  { name: 'ClaudeSkillsTarget', family: 'interface', inputKind: 'Projection', outputKind: 'ClaudeSkillsFiles', deterministic: true, category: 'target' },
  { name: 'NextjsTarget', family: 'interface', inputKind: 'Projection', outputKind: 'NextjsRouteFiles', deterministic: true, category: 'target' },
  // SDK providers
  { name: 'TsSdkTarget', family: 'interface', inputKind: 'Projection', outputKind: 'TsSdkFiles', deterministic: true, category: 'sdk' },
  { name: 'PySdkTarget', family: 'interface', inputKind: 'Projection', outputKind: 'PySdkFiles', deterministic: true, category: 'sdk' },
  { name: 'GoSdkTarget', family: 'interface', inputKind: 'Projection', outputKind: 'GoSdkFiles', deterministic: true, category: 'sdk' },
  { name: 'RustSdkTarget', family: 'interface', inputKind: 'Projection', outputKind: 'RustSdkFiles', deterministic: true, category: 'sdk' },
  { name: 'JavaSdkTarget', family: 'interface', inputKind: 'Projection', outputKind: 'JavaSdkFiles', deterministic: true, category: 'sdk' },
  { name: 'SwiftSdkTarget', family: 'interface', inputKind: 'Projection', outputKind: 'SwiftSdkFiles', deterministic: true, category: 'sdk' },
  { name: 'NextjsSdkTarget', family: 'interface', inputKind: 'Projection', outputKind: 'NextjsSdkFiles', deterministic: true, category: 'sdk' },
  // Spec providers
  { name: 'OpenapiTarget', family: 'interface', inputKind: 'Projection', outputKind: 'OpenApiDoc', deterministic: true, category: 'spec' },
  { name: 'AsyncapiTarget', family: 'interface', inputKind: 'Projection', outputKind: 'AsyncApiDoc', deterministic: true, category: 'spec' },
];

function toKebabCase(name: string): string {
  return name.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');
}

export async function generateFrameworkSyncs(outDir: string, meta: typeof GENERATOR_META[string], emitStorage: ReturnType<typeof createInMemoryStorage>): Promise<number> {
  const kebabName = toKebabCase(meta.name);

  const syncFiles: { path: string; content: string }[] = [
    // 1. Cache check sync
    {
      path: `cache-check-before-${kebabName}.sync`,
      content: `sync CheckCacheBefore${meta.name} [eager]
  purpose { Check cache before ${meta.name} runs. }
when {
  SchemaGen/generate: [ spec: ?spec ]
    => ok(manifest: ?manifest)
}
where {
  bind(hash(?manifest) as ?inputHash)
  bind(concat("${meta.family}:${meta.name}:", ?spec) as ?stepKey)
}
then {
  BuildCache/check: [
    stepKey: ?stepKey;
    inputHash: ?inputHash;
    deterministic: ${meta.deterministic}
  ]
}
`,
    },
    // 2. Generate on miss sync
    {
      path: `${kebabName}-on-miss.sync`,
      content: `sync ${meta.name}OnCacheMiss [eager]
  purpose { Run ${meta.name} only on cache miss. }
when {
  SchemaGen/generate: [ spec: ?spec ]
    => ok(manifest: ?manifest)
  BuildCache/check: [ stepKey: ?stepKey ]
    => changed(previousHash: ?prev)
}
where {
  bind(concat("${meta.family}:${meta.name}:", ?spec) as ?expectedKey)
  guard(?stepKey == ?expectedKey)
}
then {
  ${meta.name}/generate: [ spec: ?spec; manifest: ?manifest ]
}
`,
    },
    // 3. Emit files sync
    {
      path: `emit-${kebabName}-files.sync`,
      content: `sync Emit${meta.name}Files [eager]
  purpose { Route ${meta.name} file output through Emitter. }
when {
  ${meta.name}/generate: [ spec: ?spec ]
    => ok(files: ?files)
}
then {
  Emitter/writeBatch: [ files: ?files ]
}
`,
    },
    // 4. Record cache sync
    {
      path: `record-cache-${kebabName}.sync`,
      content: `sync RecordCache${meta.name} [eager]
  purpose { Record ${meta.name} success in BuildCache. }
when {
  ${meta.name}/generate: [ spec: ?spec ]
    => ok(files: ?files)
  Emitter/writeBatch: []
    => ok(results: ?results)
}
where {
  bind(hash(?files) as ?outputHash)
  bind(concat("${meta.family}:${meta.name}:", ?spec) as ?stepKey)
}
then {
  BuildCache/record: [
    stepKey: ?stepKey;
    inputHash: ?inputHash;
    outputHash: ?outputHash;
    sourceLocator: specLocator(?spec);
    deterministic: ${meta.deterministic}
  ]
}
`,
    },
    // 5. Observer sync
    {
      path: `observe-${kebabName}.sync`,
      content: `sync Observe${meta.name} [eager]
  purpose { Record ${meta.name} completion in GenerationPlan. }
when {
  ${meta.name}/generate: [ spec: ?spec ]
    => ok(files: ?files)
}
then {
  GenerationPlan/recordStep: [
    stepKey: concat("${meta.family}:${meta.name}:", ?spec);
    status: "done";
    filesProduced: count(?files);
    cached: false
  ]
}
`,
    },
  ];

  // Write to disk and record in Emitter for content-addressed tracking
  for (const sf of syncFiles) {
    const filePath = join(outDir, sf.path);
    mkdirSync(join(filePath, '..'), { recursive: true });

    const emitResult = await emitterHandler.write(
      { path: filePath, content: sf.content, target: 'sync-gen', concept: meta.name },
      emitStorage,
    );

    // Write to disk: on first run or if content changed
    if ((emitResult.variant === 'ok' && emitResult.written) || !existsSync(filePath)) {
      writeFileSync(filePath, sf.content);
    }
  }

  return syncFiles.length;
}

export async function generateInterfaceSyncs(
  outDir: string,
  meta: typeof INTERFACE_TARGET_META[number],
  emitStorage: ReturnType<typeof createInMemoryStorage>,
): Promise<number> {
  const kebabName = toKebabCase(meta.name);

  const syncFiles: { path: string; content: string }[] = [
    // 1. Cache check sync — triggered by InterfaceGenerator dispatching a projection
    {
      path: `cache-check-before-${kebabName}.sync`,
      content: `sync CheckCacheBefore${meta.name} [eager]
  purpose { Check cache before ${meta.name} runs. }
when {
  InterfaceGenerator/generate: [ projection: ?projection ]
    => dispatching(target: "${meta.name}")
}
where {
  bind(hash(?projection) as ?inputHash)
  bind(concat("${meta.family}:${meta.name}:", conceptOf(?projection)) as ?stepKey)
}
then {
  BuildCache/check: [
    stepKey: ?stepKey;
    inputHash: ?inputHash;
    deterministic: ${meta.deterministic}
  ]
}
`,
    },
    // 2. Generate on miss sync
    {
      path: `${kebabName}-on-miss.sync`,
      content: `sync ${meta.name}OnCacheMiss [eager]
  purpose { Run ${meta.name} only on cache miss. }
when {
  InterfaceGenerator/generate: [ projection: ?projection ]
    => dispatching(target: "${meta.name}")
  BuildCache/check: [ stepKey: ?stepKey ]
    => changed(previousHash: ?prev)
}
where {
  bind(concat("${meta.family}:${meta.name}:", conceptOf(?projection)) as ?expectedKey)
  guard(?stepKey == ?expectedKey)
}
then {
  ${meta.name}/generate: [ projection: ?projection ]
}
`,
    },
    // 3. Emit files sync
    {
      path: `emit-${kebabName}-files.sync`,
      content: `sync Emit${meta.name}Files [eager]
  purpose { Route ${meta.name} file output through Emitter. }
when {
  ${meta.name}/generate: [ projection: ?projection ]
    => ok(files: ?files)
}
then {
  Emitter/writeBatch: [ files: ?files ]
}
`,
    },
    // 4. Record cache sync
    {
      path: `record-cache-${kebabName}.sync`,
      content: `sync RecordCache${meta.name} [eager]
  purpose { Record ${meta.name} success in BuildCache. }
when {
  ${meta.name}/generate: [ projection: ?projection ]
    => ok(files: ?files)
  Emitter/writeBatch: []
    => ok(results: ?results)
}
where {
  bind(hash(?files) as ?outputHash)
  bind(concat("${meta.family}:${meta.name}:", conceptOf(?projection)) as ?stepKey)
}
then {
  BuildCache/record: [
    stepKey: ?stepKey;
    inputHash: ?inputHash;
    outputHash: ?outputHash;
    sourceLocator: conceptOf(?projection);
    deterministic: ${meta.deterministic}
  ]
}
`,
    },
    // 5. Observer sync
    {
      path: `observe-${kebabName}.sync`,
      content: `sync Observe${meta.name} [eager]
  purpose { Record ${meta.name} completion in GenerationPlan. }
when {
  ${meta.name}/generate: [ projection: ?projection ]
    => ok(files: ?files)
}
then {
  GenerationPlan/recordStep: [
    stepKey: concat("${meta.family}:${meta.name}:", conceptOf(?projection));
    status: "done";
    filesProduced: count(?files);
    cached: false
  ]
}
`,
    },
  ];

  // Write to disk and record in Emitter for content-addressed tracking
  for (const sf of syncFiles) {
    const filePath = join(outDir, sf.path);
    mkdirSync(join(filePath, '..'), { recursive: true });

    const emitResult = await emitterHandler.write(
      { path: filePath, content: sf.content, target: 'sync-gen', concept: meta.name },
      emitStorage,
    );

    // Write to disk: on first run or if content changed
    if ((emitResult.variant === 'ok' && emitResult.written) || !existsSync(filePath)) {
      writeFileSync(filePath, sf.content);
    }
  }

  return syncFiles.length;
}

async function generateSyncFiles(
  flags: Record<string, string | boolean>,
): Promise<void> {
  const projectDir = resolve(process.cwd());
  const outDir = resolve(projectDir, 'generated', 'syncs');
  mkdirSync(outDir, { recursive: true });

  const emitStorage = createInMemoryStorage();
  const filterFamily = flags.family as string | undefined;
  let totalSyncs = 0;

  // Framework family: language code generators (SchemaGen → CodeGen pipeline)
  if (!filterFamily || filterFamily === 'framework') {
    console.log('Framework generators:');
    for (const [_targetKey, meta] of Object.entries(GENERATOR_META)) {
      totalSyncs += await generateFrameworkSyncs(outDir, meta, emitStorage);
      console.log(`  ${meta.name}: 5 sync files`);
    }
  }

  // Interface family: target providers, SDK providers, spec providers
  if (!filterFamily || filterFamily === 'interface') {
    console.log('Interface target providers:');
    for (const meta of INTERFACE_TARGET_META) {
      totalSyncs += await generateInterfaceSyncs(outDir, meta, emitStorage);
      console.log(`  ${meta.name}: 5 sync files`);
    }
  }

  console.log(`\n${totalSyncs} sync file(s) written to generated/syncs/`);
}
