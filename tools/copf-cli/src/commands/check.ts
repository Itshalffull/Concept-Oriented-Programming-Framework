// ============================================================
// copf check
//
// Parse and validate all .concept specs in the project.
// Reports parse errors, type issues, and warnings.
//
// Implements Section 7.2 (Parse and Validate).
// ============================================================

import { readFileSync } from 'fs';
import { resolve, relative, basename } from 'path';
import { parseConceptFile } from '../../../../implementations/typescript/framework/spec-parser.impl.js';
import type { ConceptAST } from '../../../../kernel/src/types.js';
import { findFiles } from '../util.js';
import { getPattern, listPatterns } from '../patterns/index.js';

interface CheckResult {
  file: string;
  concept: string;
  ok: boolean;
  errors: string[];
  warnings: string[];
}

function validateAST(ast: ConceptAST, file: string): string[] {
  const warnings: string[] = [];

  // Check for empty purpose
  if (!ast.purpose || ast.purpose.trim().length === 0) {
    warnings.push(`${file}: concept "${ast.name}" has no purpose section`);
  }

  // Check for empty state
  if (ast.state.length === 0) {
    warnings.push(`${file}: concept "${ast.name}" has no state declarations`);
  }

  // Check for empty actions
  if (ast.actions.length === 0) {
    warnings.push(`${file}: concept "${ast.name}" has no actions declared`);
  }

  // Check action variants — every action should have at least one variant
  for (const action of ast.actions) {
    if (action.variants.length === 0) {
      warnings.push(
        `${file}: action "${action.name}" in "${ast.name}" has no return variants`,
      );
    }
  }

  // Check invariant action references
  for (const inv of ast.invariants) {
    const actionNames = new Set(ast.actions.map(a => a.name));
    for (const pattern of [...inv.afterPatterns, ...inv.thenPatterns]) {
      if (!actionNames.has(pattern.actionName)) {
        warnings.push(
          `${file}: invariant references unknown action "${pattern.actionName}" in "${ast.name}"`,
        );
      } else {
        // Check that variant exists on the action
        const action = ast.actions.find(a => a.name === pattern.actionName);
        if (action) {
          const variantNames = new Set(action.variants.map(v => v.name));
          if (!variantNames.has(pattern.variantName)) {
            warnings.push(
              `${file}: invariant references unknown variant "${pattern.variantName}" on action "${pattern.actionName}"`,
            );
          }
        }
      }
    }
  }

  return warnings;
}

export async function checkCommand(
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  // --pattern mode: validate a specific concept against a pattern
  if (typeof flags.pattern === 'string') {
    return patternCheckCommand(flags.pattern, positional, flags);
  }

  const projectDir = resolve(process.cwd());
  const specsDir = typeof flags.specs === 'string' ? flags.specs : 'specs';

  const conceptFiles = findFiles(resolve(projectDir, specsDir), '.concept');

  if (conceptFiles.length === 0) {
    console.log('No .concept files found.');
    return;
  }

  console.log(`Checking ${conceptFiles.length} concept spec(s)...\n`);

  const results: CheckResult[] = [];
  let hasErrors = false;

  for (const file of conceptFiles) {
    const relPath = relative(projectDir, file);
    const source = readFileSync(file, 'utf-8');
    const result: CheckResult = {
      file: relPath,
      concept: '',
      ok: true,
      errors: [],
      warnings: [],
    };

    try {
      const ast = parseConceptFile(source);
      result.concept = ast.name;
      result.warnings = validateAST(ast, relPath);
    } catch (err: unknown) {
      result.ok = false;
      hasErrors = true;
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push(message);
    }

    results.push(result);
  }

  // Print results
  for (const r of results) {
    const status = r.ok ? 'OK' : 'FAIL';
    const label = r.concept ? `${r.concept} (${r.file})` : r.file;
    console.log(`  [${status}] ${label}`);

    for (const err of r.errors) {
      console.log(`         error: ${err}`);
    }
    for (const warn of r.warnings) {
      console.log(`         warn:  ${warn}`);
    }
  }

  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  const warnCount = results.reduce((n, r) => n + r.warnings.length, 0);

  console.log(
    `\n${passed} passed, ${failed} failed, ${warnCount} warning(s)`,
  );

  if (hasErrors) {
    process.exit(1);
  }
}

/**
 * copf check --pattern <name> <concept-file>
 *
 * Run a pattern validator against a specific concept file.
 */
async function patternCheckCommand(
  patternName: string,
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const validator = getPattern(patternName);
  if (!validator) {
    console.error(`Unknown pattern: ${patternName}`);
    console.error(`Available patterns: ${listPatterns().join(', ')}`);
    process.exit(1);
    return;
  }

  const conceptFile = positional[0];
  if (!conceptFile) {
    console.error(`Usage: copf check --pattern ${patternName} <concept-file>`);
    process.exit(1);
    return;
  }

  const projectDir = resolve(process.cwd());
  const specsDir = typeof flags.specs === 'string' ? flags.specs : 'specs';

  // Resolve concept file — try as-is, then relative to specs dir
  let filePath = resolve(projectDir, conceptFile);
  try {
    readFileSync(filePath, 'utf-8');
  } catch {
    filePath = resolve(projectDir, specsDir, conceptFile);
  }

  let source: string;
  try {
    source = readFileSync(filePath, 'utf-8');
  } catch {
    console.error(`Cannot read: ${conceptFile}`);
    process.exit(1);
    return;
  }

  let ast: ConceptAST;
  try {
    ast = parseConceptFile(source);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Parse error: ${message}`);
    process.exit(1);
    return;
  }

  const relPath = relative(projectDir, filePath);
  const result = validator(ast);

  console.log(`\n${relPath}: ${result.pattern} pattern validation`);

  const errors = result.messages.filter(m => m.level === 'error');
  const warnings = result.messages.filter(m => m.level === 'warning');
  const infos = result.messages.filter(m => m.level === 'info');

  for (const msg of infos) {
    console.log(`  \u2705 ${msg.message}`);
  }
  for (const msg of warnings) {
    console.log(`  \u26A0  ${msg.message}`);
  }
  for (const msg of errors) {
    console.log(`  \u274C ${msg.message}`);
  }

  console.log(`\n${warnings.length} warning(s), ${errors.length} error(s)`);

  if (errors.length > 0) {
    process.exit(1);
  }
}
