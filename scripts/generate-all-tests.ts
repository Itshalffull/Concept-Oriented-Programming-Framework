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
function toKebab(name: string): string {
  return name
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

// Find matching handler file for a concept
function findHandlerPath(conceptName: string): string {
  const kebab = toKebab(conceptName);
  // Search common handler locations
  const candidates = [
    `handlers/ts/${kebab}.handler.js`,
    `handlers/ts/app/${kebab}.handler.js`,
    `handlers/ts/framework/${kebab}.handler.js`,
    `handlers/ts/monadic/${kebab}.handler.js`,
    `handlers/ts/score/${kebab}.handler.js`,
    `handlers/ts/surface/${kebab}.handler.js`,
    `handlers/ts/deploy/${kebab}.handler.js`,
    `handlers/ts/code-parse/${kebab}.handler.js`,
    `handlers/ts/app/governance/${kebab}.handler.js`,
    `handlers/ts/framework/providers/${kebab}.handler.js`,
    `handlers/ts/framework/test/${kebab}.handler.js`,
    `handlers/ts/framework/generation/${kebab}.handler.js`,
    `handlers/ts/monadic/providers/${kebab}.handler.js`,
    `handlers/ts/surface/providers/${kebab}.handler.js`,
    `handlers/ts/repertoire/web3/${kebab}.handler.js`,
  ];

  for (const candidate of candidates) {
    const tsCandidate = candidate.replace('.handler.js', '.handler.ts');
    if (existsSync(join(ROOT, tsCandidate))) {
      return candidate;
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
        })),
        invariants: ast.invariants || [],
      };

      // Build test plan
      const plan = buildTestPlan(conceptRef, conceptData);
      plan.handlerPath = findHandlerPath(ast.name);

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
