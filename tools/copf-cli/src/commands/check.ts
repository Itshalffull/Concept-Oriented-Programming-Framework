// ============================================================
// copf check
//
// Parse and validate all .concept specs in the project.
// Reports parse errors, type issues, and warnings.
//
// Implements Section 7.2 Phase 1 (Parse) and Phase 2 (Validate).
// ============================================================

import { readFileSync } from 'fs';
import { resolve, relative, basename } from 'path';
import { parseConceptFile } from '../../../../kernel/src/parser.js';
import type { ConceptAST } from '../../../../kernel/src/types.js';
import { findFiles } from '../util.js';

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
  _positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
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
