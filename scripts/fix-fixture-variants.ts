#!/usr/bin/env npx tsx
// ============================================================
// Fix fixture variant annotations in concept specs
//
// Many fixtures have error-like names (empty_*, duplicate_*, missing_*, etc.)
// but don't specify -> error (defaulting to -> ok). This script:
//   1. Parses each concept spec
//   2. Identifies fixtures with error-like names and no explicit variant
//   3. Infers the appropriate error variant from the action's declared variants
//   4. Adds the -> variant annotation to the fixture line in the spec
//
// Usage: npx tsx scripts/fix-fixture-variants.ts [--dry-run]
// ============================================================

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { parseConceptFile } from '../handlers/ts/framework/parser.js';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

// Error-like fixture name patterns
const ERROR_NAME_PATTERNS = [
  'invalid', 'duplicate', 'empty', 'missing', 'not_found', 'notfound',
  'nonexistent', 'unauthorized', 'forbidden', 'conflict', 'already',
  'bad', 'wrong', 'fail', 'rejected', 'expired', 'unknown', 'no_',
  'unregistered', 'malformed', 'overflow', 'exceed', 'revoked',
  'unavailable', 'unresolved', 'stale', 'orphan',
];

// Common error variant names
const ERROR_VARIANT_NAMES = new Set([
  'error', 'invalid', 'notfound', 'not_found', 'notFound',
  'unauthorized', 'forbidden', 'conflict', 'duplicate', 'unavailable',
  'unsupported', 'timeout', 'already_exists', 'alreadyExists',
  'expired', 'rejected', 'malformed', 'overflow',
]);

function isErrorLikeName(name: string): boolean {
  const lower = name.toLowerCase();
  return ERROR_NAME_PATTERNS.some(p => lower.includes(p));
}

function findConceptFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) results.push(...findConceptFiles(full));
      else if (entry.endsWith('.concept')) results.push(full);
    }
  } catch { /* ignore */ }
  return results;
}

/**
 * Find the best error variant for a fixture given the action's declared variants.
 * Strategy:
 * 1. If action has exactly one non-ok variant, use it
 * 2. If fixture name contains a variant name (e.g. "notfound"), use that variant
 * 3. Fall back to 'error' (the generic error variant)
 */
function inferErrorVariant(
  fixtureName: string,
  actionVariants: Array<{ name: string }>,
): string {
  const nonOkVariants = actionVariants.filter(v => v.name !== 'ok');

  // If only one error variant, use it
  if (nonOkVariants.length === 1) return nonOkVariants[0].name;

  // Try to match fixture name to a variant
  const lowerName = fixtureName.toLowerCase();
  for (const v of nonOkVariants) {
    const vLower = v.name.toLowerCase().replace(/_/g, '');
    const nameLower = lowerName.replace(/_/g, '');
    if (nameLower.includes(vLower) || vLower.includes(nameLower.split('_')[0])) {
      return v.name;
    }
  }

  // Common mappings from name patterns to variants
  const patternToVariant: Array<[string, string[]]> = [
    ['notfound', ['notfound', 'not_found', 'notFound']],
    ['not_found', ['notfound', 'not_found', 'notFound']],
    ['nonexistent', ['notfound', 'not_found', 'notFound']],
    ['missing', ['notfound', 'not_found', 'notFound']],
    ['invalid', ['invalid', 'error']],
    ['empty', ['invalid', 'error']],
    ['bad', ['invalid', 'error']],
    ['wrong', ['invalid', 'error']],
    ['malformed', ['invalid', 'error']],
    ['duplicate', ['duplicate', 'conflict', 'alreadyExists', 'already_exists', 'error']],
    ['already', ['alreadyExists', 'already_exists', 'conflict', 'duplicate', 'error']],
    ['conflict', ['conflict', 'error']],
    ['unauthorized', ['unauthorized', 'forbidden', 'error']],
    ['forbidden', ['forbidden', 'unauthorized', 'error']],
    ['expired', ['expired', 'error']],
    ['rejected', ['rejected', 'error']],
    ['unknown', ['notfound', 'not_found', 'notFound', 'error']],
    ['unregistered', ['notfound', 'not_found', 'notFound', 'error']],
    ['unavailable', ['unavailable', 'error']],
    ['overflow', ['overflow', 'error']],
    ['exceed', ['overflow', 'error']],
    ['revoked', ['revoked', 'error']],
    ['stale', ['stale', 'error']],
    ['fail', ['error']],
  ];

  const variantNames = new Set(nonOkVariants.map(v => v.name));

  for (const [pattern, candidates] of patternToVariant) {
    if (lowerName.includes(pattern)) {
      for (const candidate of candidates) {
        if (variantNames.has(candidate)) return candidate;
      }
      // If no matching variant exists, use 'error' as fallback
      if (variantNames.has('error')) return 'error';
      // Last resort: use the first non-ok variant
      if (nonOkVariants.length > 0) return nonOkVariants[0].name;
      return 'error';
    }
  }

  // Default: use 'error' if it exists, else first non-ok variant
  if (variantNames.has('error')) return 'error';
  if (nonOkVariants.length > 0) return nonOkVariants[0].name;
  return 'error';
}

async function main() {
  const searchDirs = ['specs', 'repertoire', 'score', 'bind', 'surface'].map(d => join(ROOT, d));
  const conceptFiles = searchDirs.flatMap(d => findConceptFiles(d));

  let fixedFiles = 0;
  let fixedFixtures = 0;
  let skippedFixtures = 0;

  for (const filePath of conceptFiles) {
    try {
      const source = readFileSync(filePath, 'utf-8');
      const ast = parseConceptFile(source);

      if (!ast || !ast.actions) continue;

      let modified = source;
      let fileChanged = false;

      for (const action of ast.actions) {
        const variants = action.variants || [];

        for (const fixture of action.fixtures || []) {
          // Skip fixtures that already have an explicit variant (non-ok)
          if (fixture.expectedVariant && fixture.expectedVariant !== 'ok') continue;

          // Check if the fixture name suggests an error case
          if (!isErrorLikeName(fixture.name)) continue;

          // Infer the right error variant
          const errorVariant = inferErrorVariant(fixture.name, variants);

          // Find the fixture line in the source and add -> variant
          // Match: fixture <name> { ... }  (no -> at end of line)
          // Note: fixtures can span multiple lines, so we match on the fixture name
          const fixturePattern = new RegExp(
            `(fixture\\s+${fixture.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*\\{[^}]*\\}(?:\\s*after\\s+\\w+)?)\\s*$`,
            'm'
          );

          const match = modified.match(fixturePattern);
          if (match) {
            const replacement = `${match[1]} -> ${errorVariant}`;
            modified = modified.replace(fixturePattern, replacement);
            fileChanged = true;
            fixedFixtures++;
          } else {
            skippedFixtures++;
          }
        }
      }

      if (fileChanged) {
        if (dryRun) {
          console.log(`[dry-run] Would fix: ${filePath}`);
        } else {
          writeFileSync(filePath, modified);
        }
        fixedFiles++;
      }
    } catch (err: any) {
      // Skip files that fail to parse
    }
  }

  console.log(`\nResults:`);
  console.log(`  Fixed files:    ${fixedFiles}`);
  console.log(`  Fixed fixtures: ${fixedFixtures}`);
  console.log(`  Skipped:        ${skippedFixtures} (couldn't match in source)`);
}

main().catch(console.error);
