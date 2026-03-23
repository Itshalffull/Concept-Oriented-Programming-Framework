#!/usr/bin/env npx tsx
// ============================================================
// Fix handlers to validate inputs for error-case fixtures
//
// For each concept with error-case fixtures, this script:
//   1. Identifies the error fixtures and what makes them "error" (empty/missing fields)
//   2. Adds input validation guard clauses to the corresponding handler actions
//   3. Returns the appropriate error variant when validation fails
//
// Approach: For each error fixture, compare its inputs against the ok fixture
// to determine which fields are "wrong". Then add validation for those patterns.
//
// Usage: npx tsx scripts/fix-handler-validation.ts [--dry-run]
// ============================================================

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { parseConceptFile } from '../handlers/ts/framework/parser.js';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');

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

function toKebab(name: string): string {
  return name
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1-$2')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

function findHandlerFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) results.push(...findHandlerFiles(full));
      else if (entry.endsWith('.handler.ts')) results.push(full);
    }
  } catch { /* ignore */ }
  return results;
}

// Build kebab-name → handler path index
function buildHandlerIndex(): Map<string, string> {
  const index = new Map<string, string>();
  const handlerFiles = findHandlerFiles(join(ROOT, 'handlers', 'ts'));
  for (const fullPath of handlerFiles) {
    const relPath = relative(ROOT, fullPath);
    const name = fullPath.split('/').pop()!.replace('.handler.ts', '');
    index.set(name, relPath);
  }
  return index;
}

/**
 * Determine what validation check an error fixture implies.
 * Compare against the action's ok fixture to see what changed.
 */
interface ValidationCheck {
  field: string;
  condition: 'empty_string' | 'missing' | 'empty_array' | 'invalid_format';
  errorVariant: string;
}

function inferValidationChecks(
  errorFixture: any,
  okFixture: any | undefined,
  actionParams: any[],
  errorVariant: string,
): ValidationCheck[] {
  const checks: ValidationCheck[] = [];
  const fixtureName = (errorFixture.name as string || '').toLowerCase();
  const errorInput = errorFixture.input || {};

  // Check each input field
  for (const [key, value] of Object.entries(errorInput)) {
    // Skip ref values
    if (value && typeof value === 'object' && (value as any).type === 'ref') continue;

    const strValue = typeof value === 'string' ? value : '';

    // Empty string check
    if (strValue === '' || strValue.trim() === '') {
      checks.push({ field: key, condition: 'empty_string', errorVariant });
      continue;
    }

    // If fixture name contains the field name and "invalid"/"bad"/"wrong"
    if (fixtureName.includes('invalid') || fixtureName.includes('bad') || fixtureName.includes('wrong') || fixtureName.includes('malformed')) {
      // The input value is intentionally wrong — but we can't know the validation rule
      // without reading the handler. Skip these for now.
    }
  }

  // If no specific field was identified as empty, check fixture name for clues
  if (checks.length === 0) {
    for (const param of actionParams) {
      const paramName = param.name as string;
      const paramNameLower = paramName.toLowerCase();
      if (fixtureName.includes(paramNameLower) && (fixtureName.includes('empty') || fixtureName.includes('missing'))) {
        checks.push({ field: paramName, condition: 'empty_string', errorVariant });
      }
    }
  }

  // Special case: "empty_name", "empty_key", etc. — the fixture name tells us the field
  if (checks.length === 0) {
    const emptyMatch = fixtureName.match(/empty[_-]?(\w+)/);
    if (emptyMatch) {
      const fieldName = emptyMatch[1];
      // Find a matching param
      const matchingParam = actionParams.find(
        (p: any) => (p.name as string).toLowerCase() === fieldName ||
                     (p.name as string).toLowerCase().includes(fieldName)
      );
      if (matchingParam) {
        checks.push({ field: matchingParam.name, condition: 'empty_string', errorVariant });
      }
    }
  }

  // "missing_X" pattern
  if (checks.length === 0) {
    const missingMatch = fixtureName.match(/missing[_-]?(\w+)/);
    if (missingMatch) {
      const fieldName = missingMatch[1];
      const matchingParam = actionParams.find(
        (p: any) => (p.name as string).toLowerCase() === fieldName ||
                     (p.name as string).toLowerCase().includes(fieldName)
      );
      if (matchingParam) {
        checks.push({ field: matchingParam.name, condition: 'empty_string', errorVariant });
      }
    }
  }

  return checks;
}

/**
 * Generate validation code for a functional handler action.
 */
function generateValidationCode(
  checks: ValidationCheck[],
  style: 'functional' | 'imperative',
): string[] {
  const lines: string[] = [];

  for (const check of checks) {
    if (style === 'functional') {
      if (check.condition === 'empty_string') {
        lines.push(`    if (!input.${check.field} || (typeof input.${check.field} === 'string' && (input.${check.field} as string).trim() === '')) {`);
        lines.push(`      return complete(createProgram(), '${check.errorVariant}', { message: '${check.field} is required' }) as StorageProgram<Result>;`);
        lines.push(`    }`);
      }
    } else {
      if (check.condition === 'empty_string') {
        lines.push(`    if (!input.${check.field} || (typeof input.${check.field} === 'string' && (input.${check.field} as string).trim() === '')) {`);
        lines.push(`      return { variant: '${check.errorVariant}', output: { message: '${check.field} is required' } };`);
        lines.push(`    }`);
      }
    }
  }

  return lines;
}

/**
 * Insert validation code into a handler action method.
 * Finds the method body and inserts validation right after the first line.
 */
function insertValidation(
  handlerSource: string,
  actionName: string,
  validationLines: string[],
): string | null {
  if (validationLines.length === 0) return null;

  const validationCode = validationLines.join('\n');

  // Pattern 1: method in object literal — actionName(input: Record<string, unknown>) {
  const methodPattern = new RegExp(
    `(${actionName}\\s*\\(input[^)]*\\)\\s*\\{)`,
    'm'
  );

  const match = handlerSource.match(methodPattern);
  if (!match) return null;

  // Check if validation already exists for the first field
  const firstField = validationLines[0].match(/input\.(\w+)/)?.[1];
  if (firstField) {
    // Look ahead from the match to see if validation already exists
    const afterMatch = handlerSource.substring(handlerSource.indexOf(match[0]) + match[0].length, handlerSource.indexOf(match[0]) + match[0].length + 500);
    if (afterMatch.includes(`input.${firstField}`) && (afterMatch.includes('trim()') || afterMatch.includes('is required'))) {
      return null; // Already has validation
    }
  }

  // Insert validation right after the opening brace
  const insertPoint = handlerSource.indexOf(match[0]) + match[0].length;
  return handlerSource.slice(0, insertPoint) + '\n' + validationCode + handlerSource.slice(insertPoint);
}

async function main() {
  const handlerIndex = buildHandlerIndex();
  const searchDirs = ['specs', 'repertoire', 'score', 'bind', 'surface'].map(d => join(ROOT, d));
  const conceptFiles = searchDirs.flatMap(d => findConceptFiles(d));

  let fixedHandlers = 0;
  let totalChecks = 0;
  let skipped = 0;

  for (const filePath of conceptFiles) {
    try {
      const source = readFileSync(filePath, 'utf-8');
      const ast = parseConceptFile(source);
      if (!ast?.actions) continue;

      const kebab = toKebab(ast.name);
      const handlerPath = handlerIndex.get(kebab);
      if (!handlerPath) continue;

      const fullHandlerPath = join(ROOT, handlerPath);
      if (!existsSync(fullHandlerPath)) continue;

      let handlerSource = readFileSync(fullHandlerPath, 'utf-8');
      const isFunctional = /FunctionalConceptHandler|StorageProgram|createProgram/.test(handlerSource);
      const style = isFunctional ? 'functional' : 'imperative';

      // Check if handler imports complete/createProgram (needed for validation)
      const hasComplete = handlerSource.includes('complete');
      const hasCreateProgram = handlerSource.includes('createProgram');

      let handlerModified = false;

      for (const action of ast.actions) {
        const errorFixtures = (action.fixtures || []).filter(
          (f: any) => f.expectedVariant && f.expectedVariant !== 'ok'
        );
        const okFixture = (action.fixtures || []).find(
          (f: any) => !f.expectedVariant || f.expectedVariant === 'ok'
        );

        for (const errorFixture of errorFixtures) {
          const checks = inferValidationChecks(
            errorFixture,
            okFixture,
            action.params || [],
            errorFixture.expectedVariant,
          );

          if (checks.length === 0) {
            skipped++;
            continue;
          }

          // Only generate validation for functional handlers that have the right imports
          if (style === 'functional' && (!hasComplete || !hasCreateProgram)) {
            skipped++;
            continue;
          }

          const validationLines = generateValidationCode(checks, style as any);
          const modified = insertValidation(handlerSource, action.name, validationLines);
          if (modified) {
            handlerSource = modified;
            handlerModified = true;
            totalChecks += checks.length;
          }
        }
      }

      if (handlerModified) {
        if (dryRun) {
          console.log(`[dry-run] Would fix: ${handlerPath}`);
        } else {
          writeFileSync(fullHandlerPath, handlerSource);
        }
        fixedHandlers++;
      }
    } catch { /* skip */ }
  }

  console.log(`\nResults:`);
  console.log(`  Fixed handlers:     ${fixedHandlers}`);
  console.log(`  Validation checks:  ${totalChecks}`);
  console.log(`  Skipped fixtures:   ${skipped} (no identifiable validation pattern)`);
}

main().catch(console.error);
