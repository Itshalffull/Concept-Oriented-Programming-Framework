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
import { parseConceptFile } from '../handlers/ts/framework/parser.js';
import { buildTestPlan, type TestPlan } from '../handlers/ts/framework/test/test-gen.handler.js';
import { renderTypeScriptTests } from '../handlers/ts/framework/test/typescript-test-renderer.js';

const ROOT = process.cwd();
const OUTPUT_DIR = join(ROOT, 'generated', 'tests');
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
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
  ];

  const conceptFiles = searchDirs.flatMap(d => findConceptFiles(d));

  console.log(`Found ${conceptFiles.length} concept files`);

  if (!dryRun) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let generated = 0;
  let skipped = 0;
  let failed = 0;

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
      const annotationLine = handlerSource.match(/^\/\/\s*@clef-handler\s+(.+)/m);
      if (annotationLine) {
        const attrs = annotationLine[1];
        const styleAttr = attrs.match(/style=(\w+)/);
        if (styleAttr && (styleAttr[1] === 'functional' || styleAttr[1] === 'imperative')) {
          plan.handlerStyle = styleAttr[1];
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

      // Render TypeScript tests
      const testCode = renderTypeScriptTests(plan);

      // Write test file
      const kebab = toKebab(ast.name);
      const testFileName = `${kebab}.conformance.test.ts`;
      const testFilePath = join(OUTPUT_DIR, testFileName);

      if (dryRun) {
        const testCount = (testCode.match(/\bit\(/g) || []).length;
        console.log(`  [dry-run] ${relPath} → ${testFileName} (${testCount} tests, ${plan.examples.length} examples, ${plan.properties.length} forall, ${plan.stateInvariants.length} state invariants, ${plan.contracts.length} contracts)`);
      } else {
        writeFileSync(testFilePath, testCode);
      }

      generated++;
    } catch (err: any) {
      console.error(`  [error] ${relPath}: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nResults:`);
  console.log(`  Generated: ${generated}`);
  console.log(`  Skipped:   ${skipped} (no actions or not a concept)`);
  console.log(`  Failed:    ${failed}`);
  console.log(`  Output:    ${OUTPUT_DIR}`);
}

main().catch(console.error);
