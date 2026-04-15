#!/usr/bin/env npx tsx
// ============================================================
// Generate conformance tests for all concept specs using TestGen
//
// Uses the TestGen pipeline:
//   1. Parse each .concept file with spec-parser
//   2. Build a TestPlan via testGenHandler.buildTestPlan()
//   3. Render TypeScript tests via testGenTypeScriptHandler.render()
//   4. Write to generated/tests/
//
// Usage: npx tsx scripts/generate-all-tests.ts [--dry-run] [--filter pattern]
// ============================================================

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative, basename } from 'path';
import { createHash } from 'crypto';
import { parseConceptFile } from '../../handlers/ts/framework/parser.js';
import { buildTestPlan, type TestPlan } from '../../handlers/ts/framework/test/test-gen.handler.js';
import { renderTypeScriptTests } from '../../handlers/ts/framework/test/typescript-test-renderer.js';
// ── Concept handlers for baseline storage & 3-way merge ──────
// See syncs: store-generation-baseline.sync, merge-generation-baseline.sync
import { createFileStorage } from '../../runtime/adapters/file-storage.js';
import { generationProvenanceHandler } from '../../handlers/ts/score/generation-provenance.handler.js';
import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

const ROOT = process.cwd();
const OUTPUT_DIR = join(ROOT, 'generated', 'tests');
// Legacy baseline path — kept for migration; concept storage is in .clef/data/test-gen/
const BASELINE_PATH = join(OUTPUT_DIR, '.baselines.json');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const forceRegen = args.includes('--force');

// ── Concept-based baseline storage for 3-way merge ─────────────
// Uses Clef concepts (ContentHash, GenerationProvenance, Diff) wired
// by syncs (store-generation-baseline, merge-generation-baseline) to
// store full baseline content and perform proper 3-way merges.
//
// Persistent file storage in .clef/data/test-gen/ survives between
// CLI invocations — see runtime/adapters/file-storage.ts.
const STORAGE_DIR = join(ROOT, '.clef', 'data', 'test-gen');

// Shared persistent storage for all concept handlers in this script.
// ContentHash stores baseline content by digest; GenerationProvenance
// maps output files to their content hashes.
const fileStorage: ConceptStorage = createFileStorage({
  dataDir: STORAGE_DIR,
  namespace: 'test-gen',
  compactionThreshold: 0.5,
});

// Import ContentHash handler (imperative style, direct storage calls)
let _contentHashHandler: ConceptHandler | null = null;
async function getContentHashHandler(): Promise<ConceptHandler> {
  if (!_contentHashHandler) {
    const mod = await import('../handlers/ts/content-hash.handler.js');
    _contentHashHandler = mod.default ?? mod.contentHashHandler ?? Object.values(mod).find(
      (v: unknown) => v && typeof v === 'object' && 'store' in (v as Record<string, unknown>),
    ) as ConceptHandler;
  }
  return _contentHashHandler!;
}

function contentHash(content: string): string {
  return createHash('sha256').update(content).digest('hex');
}

/**
 * Store baseline content via ContentHash concept (content-addressed, deduplicated).
 * Records provenance via GenerationProvenance concept.
 * Implements the StoreGenerationBaseline sync flow.
 */
async function storeBaseline(
  testFileName: string,
  testCode: string,
  sourceSpec: string,
): Promise<void> {
  const handler = await getContentHashHandler();
  // ContentHash/store — content-addressed storage
  await handler.store({ content: testCode }, fileStorage);
  // GenerationProvenance/record — track lineage with content hash
  const hash = contentHash(testCode);
  await generationProvenanceHandler.record({
    outputFile: testFileName,
    generator: 'TestGenTypeScript',
    sourceSpec,
    sourceSpecKind: 'concept-spec',
    config: 'typescript',
    contentHash: hash,
  }, fileStorage);
}

/**
 * Retrieve old baseline content via ContentHash concept.
 * Looks up the content hash from GenerationProvenance, then retrieves
 * the full content from ContentHash.
 * Implements the first step of MergeGenerationBaseline sync flow.
 */
async function retrieveBaseline(testFileName: string): Promise<string | null> {
  // GenerationProvenance/getByFile — look up old content hash
  const prov = await generationProvenanceHandler.getByFile(
    { outputFile: testFileName }, fileStorage,
  );
  if (prov.variant !== 'ok' || !prov.contentHash) return null;
  const oldHash = prov.contentHash as string;
  if (!oldHash) return null;

  // ContentHash/retrieve — get full baseline content
  const handler = await getContentHashHandler();
  const result = await handler.retrieve({ hash: oldHash }, fileStorage);
  if (result.variant !== 'ok') return null;
  return result.content as string;
}

/**
 * 3-way merge using the Diff concept's line-based algorithm.
 * Computes old→new diff (generator changes) and old→current diff
 * (user patches), then merges them line by line.
 * Implements the DiffGeneratorChanges + DiffUserPatches + ComposeAndApplyMerge sync chain.
 *
 * Returns merged content, or null on conflict.
 */
function threeWayMerge(
  oldBaseline: string,
  newGenerated: string,
  currentPatched: string,
): string | null {
  const oldLines = oldBaseline.split('\n');
  const newLines = newGenerated.split('\n');
  const curLines = currentPatched.split('\n');

  // Build line-level diff using LCS (same algorithm as Diff concept handler).
  // Walk all three versions, applying generator changes where user didn't patch.
  const maxLen = Math.max(oldLines.length, newLines.length, curLines.length);
  const merged: string[] = [];
  let hasConflict = false;

  // For equal-length case, simple line-by-line merge
  if (oldLines.length === newLines.length && oldLines.length === curLines.length) {
    for (let i = 0; i < maxLen; i++) {
      const o = oldLines[i] ?? '';
      const n = newLines[i] ?? '';
      const c = curLines[i] ?? '';
      if (o === n) { merged.push(c); }        // generator unchanged → keep user's
      else if (o === c) { merged.push(n); }    // user unchanged → take generator's
      else if (n === c) { merged.push(n); }    // both same → fine
      else { hasConflict = true; break; }      // true conflict
    }
    return hasConflict ? null : merged.join('\n');
  }

  // Structural changes (different line counts) — too risky for line-based merge.
  // Report as conflict; user can use --force to overwrite.
  // Future: use the Diff concept's LCS algorithm for block-level merge.
  return null;
}

// Future: use Diff concept's LCS algorithm (Diff/diff action with "myers"
// algorithm) for block-level structural merge of different-length files.
const filterArg = args.find(a => a.startsWith('--filter='));
const filter = filterArg ? filterArg.split('=')[1] : undefined;

// Recursively find all .concept files
function findConceptFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findConceptFiles(full));
    } else if (entry.endsWith('.concept')) {
      results.push(full);
    }
  }
  return results;
}

// Convert concept name to kebab-case for file naming
// Handles consecutive uppercase (e.g., BFTFinality → bft-finality, ADICOEvaluator → adico-evaluator)
function toKebab(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

// Recursively find all .handler.ts files
function findHandlerFiles(dir: string): string[] {
  const results: string[] = [];
  if (!existsSync(dir)) return results;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      results.push(...findHandlerFiles(full));
    } else if (entry.endsWith('.handler.ts')) {
      results.push(full);
    }
  }
  return results;
}

// Build concept-name → handler-path registry by calling register() on each handler.
// Falls back to kebab-case file name matching for handlers without register().
let _conceptToHandler: Map<string, string> | undefined;
async function getConceptToHandlerMap(): Promise<Map<string, string>> {
  if (_conceptToHandler) return _conceptToHandler;
  _conceptToHandler = new Map();

  const handlerFiles = findHandlerFiles(join(ROOT, 'handlers', 'ts'));
  const kebabIndex = new Map<string, string>(); // fallback index

  for (const fullPath of handlerFiles) {
    const relPath = relative(ROOT, fullPath);
    const name = basename(fullPath, '.handler.ts');
    kebabIndex.set(name, relPath);

    // Try calling register() to get the declared concept name
    try {
      const mod = await import(fullPath);
      // Find the exported handler object (convention: *Handler or default)
      const handler = Object.values(mod).find(
        (v: any) => v && typeof v === 'object' && typeof v.register === 'function'
      ) as any;

      if (handler?.register) {
        // register() may return a StorageProgram (functional) or need storage (imperative)
        let result: any;
        try {
          result = handler.register({});
          // If it returned a promise (autoInterpret with no storage), it's a StorageProgram
          if (result instanceof Promise) {
            result = await result.catch(() => null);
          }
        } catch {
          // Imperative handler needs storage — try with in-memory storage
          try {
            const { createInMemoryStorage } = await import('../runtime/adapters/storage.js');
            result = await handler.register({}, createInMemoryStorage());
          } catch { result = null; }
        }

        let conceptName: string | undefined;
        if (result && typeof result === 'object') {
          if ('variant' in result && result.variant === 'ok' && result.name) {
            conceptName = result.name as string;
          } else if ('instructions' in result && result.effects) {
            // StorageProgram — extract name from the complete instruction's value
            for (const instr of (result as any).instructions) {
              if (instr.tag === 'pure' && instr.value?.name) {
                conceptName = instr.value.name as string;
                break;
              }
            }
          }
        }

        if (conceptName && typeof conceptName === 'string') {
          _conceptToHandler.set(conceptName, relPath);
        }
      }
    } catch {
      // Handler failed to import or register — will fall back to kebab match
    }
  }

  // Store kebab index for fallback
  (_conceptToHandler as any)._kebabIndex = kebabIndex;
  return _conceptToHandler;
}

// Find matching handler file for a concept
async function findHandlerPath(conceptName: string): Promise<string> {
  const registry = await getConceptToHandlerMap();

  // Primary: exact concept name from register()
  const registered = registry.get(conceptName);
  if (registered) return registered.replace('.handler.ts', '.handler.js');

  // Fallback: kebab-case file name match
  const kebab = toKebab(conceptName);
  const kebabIndex = (registry as any)._kebabIndex as Map<string, string>;

  const found = kebabIndex.get(kebab);
  if (found) return found.replace('.handler.ts', '.handler.js');

  // Fuzzy: strip hyphens
  const stripped = kebab.replace(/-/g, '');
  for (const [name, path] of kebabIndex) {
    if (name.replace(/-/g, '') === stripped) {
      return path.replace('.handler.ts', '.handler.js');
    }
  }

  return `handlers/ts/${kebab}.handler.js`;
}

// Main
async function main() {
  // Search all concept spec directories
  const searchDirs = [
    join(ROOT, 'specs'),
    join(ROOT, 'repertoire'),
    join(ROOT, 'score'),
    join(ROOT, 'bind'),
    join(ROOT, 'surface'),
    join(ROOT, 'clef-base', 'concepts'),
  ];

  const conceptFiles = searchDirs.flatMap(d => findConceptFiles(d));
  // Baseline storage is handled by ContentHash + GenerationProvenance
  // concepts backed by persistent file storage in .clef/data/test-gen/

  console.log(`Found ${conceptFiles.length} concept files`);

  if (!dryRun) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let generated = 0;
  let skipped = 0;
  let failed = 0;
  let preserved = 0;
  let merged_count = 0;

  for (const filePath of conceptFiles) {
    const relPath = relative(ROOT, filePath);

    if (filter && !relPath.includes(filter)) {
      continue;
    }

    try {
      const source = readFileSync(filePath, 'utf-8');
      const ast = parseConceptFile(source);

      if (!ast || !ast.name) {
        skipped++;
        continue;
      }

      // Skip concepts with no actions (nothing to test)
      if (!ast.actions || ast.actions.length === 0) {
        skipped++;
        continue;
      }

      // Build concept data for TestPlan
      const conceptRef = `clef/concept/${ast.name}`;
      const conceptData = {
        name: ast.name,
        actions: ast.actions.map((a: any) => ({
          name: a.name,
          params: (a.params || []).map((p: any) => ({
            name: p.name,
            type: p.type?.name || p.type?.kind || 'String',
          })),
          variants: (a.variants || []).map((v: any) => ({
            name: v.name || v.tag,
            params: (v.params || v.fields || []).map((f: any) => ({
              name: f.name,
              type: f.type?.name || f.type?.kind || 'String',
            })),
          })),
          fixtures: (a.fixtures || []).map((f: any) => ({
            name: f.name,
            input: f.input,
            expectedVariant: f.expectedVariant || 'ok',
            ...(f.after ? { after: f.after } : {}),
          })),
        })),
        invariants: ast.invariants || [],
      };

      // Warn about non-ok success variants (convention: success is always 'ok')
      // Heuristic: if the action has exactly one non-error variant and it isn't
      // 'ok', it should probably be renamed. Actions with multiple non-error
      // variants are legitimate multi-outcome branches (no warning).
      // Suppress with @suppress-variant-warning annotation on the concept.
      const ERROR_VARIANTS = new Set(['error', 'notfound', 'not_found', 'invalid', 'unauthorized', 'forbidden', 'unavailable', 'unsupported', 'conflict', 'timeout', 'duplicate']);
      const suppressWarning = source.includes('@suppress-variant-warning');
      if (!suppressWarning) {
        for (const action of conceptData.actions) {
          const nonErrorVariants = action.variants.filter((v: any) => !ERROR_VARIANTS.has(v.name));
          if (nonErrorVariants.length === 1 && nonErrorVariants[0].name !== 'ok') {
            console.warn(`  ⚠ ${ast.name}/${action.name}: single success variant '${nonErrorVariants[0].name}' should be 'ok' (variant convention). Use @suppress-variant-warning to silence.`);
          }
        }
      }

      // Build test plan
      const plan = buildTestPlan(conceptRef, conceptData);
      const handlerPath = await findHandlerPath(ast.name);
      plan.handlerPath = handlerPath;

      // Skip concepts without a handler implementation
      const handlerTsPath = handlerPath.replace('.handler.js', '.handler.ts');
      if (!existsSync(join(ROOT, handlerTsPath))) {
        skipped++;
        continue;
      }

      // Parse @clef-handler annotation for style, concept, and export
      // Format: // @clef-handler style=functional [concept=Name] [export=handlerVarName]
      const handlerSource = readFileSync(join(ROOT, handlerTsPath), 'utf-8');
      // Auto-detect actual handler style from code: if the handler uses
      // FunctionalConceptHandler/StorageProgram/createProgram, treat as functional
      // even if the annotation says imperative (common after migration).
      const actuallyFunctional = /FunctionalConceptHandler|StorageProgram|createProgram/.test(handlerSource);
      const annotationLine = handlerSource.match(/^\/\/\s*@clef-handler\s+(.+)/m);
      if (annotationLine) {
        const attrs = annotationLine[1];
        const styleAttr = attrs.match(/style=(\w+)/);
        if (styleAttr && (styleAttr[1] === 'functional' || styleAttr[1] === 'imperative')) {
          plan.handlerStyle = actuallyFunctional ? 'functional' : styleAttr[1];
        }
        const exportAttr = attrs.match(/export=(\w+)/);
        if (exportAttr) {
          plan.handlerExportName = exportAttr[1];
        }
      }

      // Fallback: extract the actual export name from the handler source
      if (!plan.handlerExportName) {
        const exportMatch = handlerSource.match(/^export\s+const\s+(\w+Handler)\s*[=:]/m)
          || handlerSource.match(/^export\s*\{\s*(\w+Handler)\s*\}/m);
        if (exportMatch) {
          plan.handlerExportName = exportMatch[1];
        }
      }

      // Detect autoInterpret wrapping: if the exported handler is
      // autoInterpret(_rawHandler), expose the raw handler for structural tests
      // so extractCompletionVariants/etc. can analyze the StorageProgram.
      const autoInterpretMatch = handlerSource.match(
        /export\s+const\s+(\w+Handler)\s*=\s*autoInterpret\(\s*(_\w+Handler)\s*\)/
      );
      if (autoInterpretMatch) {
        plan.handlerExportName = plan.handlerExportName || autoInterpretMatch[1];
        plan.rawHandlerExportName = autoInterpretMatch[2];
      }

      // Render TypeScript tests
      const testCode = renderTypeScriptTests(plan);

      // Write test file using concept-based baseline storage & 3-way merge.
      // Flow mirrors the sync chain:
      //   StoreGenerationBaseline: ContentHash/store + GenerationProvenance/record
      //   MergeGenerationBaseline: ContentHash/retrieve + Diff/diff + merge
      const kebab = toKebab(ast.name);
      const testFileName = `${kebab}.conformance.test.ts`;
      const testFilePath = join(OUTPUT_DIR, testFileName);

      if (dryRun) {
        const testCount = (testCode.match(/\bit\(/g) || []).length;
        console.log(`  [dry-run] ${relPath} → ${testFileName} (${testCount} tests, ${plan.examples.length} examples, ${plan.properties.length} forall, ${plan.stateInvariants.length} state invariants, ${plan.contracts.length} contracts)`);
      } else {
        const newHash = contentHash(testCode);

        if (existsSync(testFilePath) && !forceRegen) {
          const current = readFileSync(testFilePath, 'utf-8');
          const currentHash = contentHash(current);

          if (currentHash === newHash) {
            // File already matches new generated output — no-op
          } else {
            // File differs from new generated output — check if patched.
            // MergeGenerationBaseline sync: retrieve old baseline from ContentHash
            const oldBaseline = await retrieveBaseline(testFileName);

            if (oldBaseline) {
              const oldHash = contentHash(oldBaseline);

              if (currentHash === oldHash) {
                // File matches stored baseline (unpatched) — safe to overwrite
                writeFileSync(testFilePath, testCode);
              } else if (newHash === oldHash) {
                // Generator output unchanged — keep patched file as-is
                preserved++;
                // Still store baseline so future runs have it
                await storeBaseline(testFileName, testCode, relPath);
                generated++;
                continue;
              } else {
                // File was patched AND generator changed — 3-way merge!
                // DiffGeneratorChanges + DiffUserPatches + ComposeAndApplyMerge sync chain
                const merged = threeWayMerge(oldBaseline, testCode, current);
                if (merged !== null) {
                  console.log(`  ✓ ${testFileName}: 3-way merge succeeded (generator + user patches)`);
                  writeFileSync(testFilePath, merged);
                  merged_count++;
                } else {
                  // Conflict — preserve user's version, warn
                  console.warn(`  ⚠ ${testFileName}: 3-way merge conflict — preserved user patches (use --force to overwrite)`);
                  preserved++;
                  await storeBaseline(testFileName, testCode, relPath);
                  generated++;
                  continue;
                }
              }
            } else {
              // No stored baseline — first run with concept storage.
              // If file has @clef-patched marker, preserve it.
              if (current.includes('@clef-patched')) {
                // Bootstrap: store the NEW generated content as the baseline
                // so future runs can do proper 3-way merge against it.
                // Don't attempt merge yet — we need the baseline stored first.
                // On the NEXT run, we'll have old baseline and can merge properly.
                await storeBaseline(testFileName, testCode, relPath);
                console.log(`  ⚠ ${testFileName}: @clef-patched — stored baseline for future merge (preserved)`);
                preserved++;
                generated++;
                continue;
              } else {
                // No baseline, no marker — overwrite with new
                writeFileSync(testFilePath, testCode);
              }
            }
          }
        } else {
          // New file or --force — write directly
          writeFileSync(testFilePath, testCode);
        }

        // StoreGenerationBaseline sync: store content + record provenance
        await storeBaseline(testFileName, testCode, relPath);
      }

      generated++;
    } catch (err: any) {
      console.error(`  [error] ${relPath}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nResults:`);
  console.log(`  Generated: ${generated}`);
  if (merged_count > 0) console.log(`  Merged:    ${merged_count} (3-way merge with user patches)`);
  console.log(`  Preserved: ${preserved} (patched files, not overwritten)`);
  console.log(`  Skipped:   ${skipped} (no actions or not a concept)`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Output:    ${OUTPUT_DIR}`);
}

main().catch(console.error);
