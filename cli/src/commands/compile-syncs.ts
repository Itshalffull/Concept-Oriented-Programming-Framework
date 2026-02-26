// ============================================================
// copf compile-syncs
//
// Parse and validate all .sync files against concept manifests.
//
// Implements Section 7.2 (Sync Compilation):
//   - Parse .sync files
//   - Validate concept/action references
//   - Check variable binding consistency
//   - Report errors and warnings
// ============================================================

import { readFileSync } from 'fs';
import { resolve, relative } from 'path';
import { parseSyncFile } from '../../../handlers/ts/framework/sync-parser.handler.js';
import { parseConceptFile } from '../../../handlers/ts/framework/spec-parser.handler.js';
import { createInMemoryStorage } from '../../../kernel/src/storage.js';
import { syncCompilerHandler } from '../../../handlers/ts/framework/sync-compiler.handler.js';
import type { ConceptAST, CompiledSync, ActionDecl } from '../../../kernel/src/types.js';
import { findFiles } from '../util.js';

interface SyncCheckResult {
  file: string;
  syncs: string[];
  ok: boolean;
  errors: string[];
  warnings: string[];
}

export async function compileSyncsCommand(
  _positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const projectDir = resolve(process.cwd());
  const specsDir = typeof flags.specs === 'string' ? flags.specs : 'specs';
  const syncsDir = typeof flags.syncs === 'string' ? flags.syncs : 'syncs';

  // Load all concept specs for reference validation
  const conceptFiles = findFiles(resolve(projectDir, specsDir), '.concept');
  const conceptASTs = new Map<string, ConceptAST>();

  for (const file of conceptFiles) {
    const source = readFileSync(file, 'utf-8');
    try {
      const ast = parseConceptFile(source);
      conceptASTs.set(ast.name, ast);
    } catch {
      // Skip unparseable specs — check command will catch these
    }
  }

  // Find all sync files
  const syncFiles = findFiles(resolve(projectDir, syncsDir), '.sync');

  if (syncFiles.length === 0) {
    console.log('No .sync files found.');
    return;
  }

  console.log(
    `Compiling ${syncFiles.length} sync file(s) against ${conceptASTs.size} concept(s)...\n`,
  );

  const results: SyncCheckResult[] = [];
  let hasErrors = false;
  let totalSyncs = 0;

  for (const file of syncFiles) {
    const relPath = relative(projectDir, file);
    const source = readFileSync(file, 'utf-8');
    const result: SyncCheckResult = {
      file: relPath,
      syncs: [],
      ok: true,
      errors: [],
      warnings: [],
    };

    try {
      // Parse the .sync file
      const compiledSyncs = parseSyncFile(source);
      result.syncs = compiledSyncs.map(s => s.name);
      totalSyncs += compiledSyncs.length;

      // Validate each sync through the SyncCompiler concept
      for (const sync of compiledSyncs) {
        const storage = createInMemoryStorage();
        const compileResult = await syncCompilerHandler.compile(
          { sync: sync.name, ast: sync },
          storage,
        );

        if (compileResult.variant !== 'ok') {
          result.ok = false;
          hasErrors = true;
          result.errors.push(compileResult.message as string);
          continue;
        }

        // Cross-reference validation: check concept/action refs
        const warnings = validateSyncReferences(sync, conceptASTs);
        result.warnings.push(...warnings);

        // Field-level validation: check field names against specs
        const fieldWarnings = validateSyncFields(sync, conceptASTs);
        result.warnings.push(...fieldWarnings);
      }
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
    const syncList = r.syncs.length > 0 ? ` [${r.syncs.join(', ')}]` : '';
    console.log(`  [${status}] ${r.file}${syncList}`);

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
    `\n${totalSyncs} sync(s) in ${results.length} file(s): ${passed} passed, ${failed} failed, ${warnCount} warning(s)`,
  );

  if (hasErrors) {
    process.exit(1);
  }
}

function validateSyncReferences(
  sync: CompiledSync,
  conceptASTs: Map<string, ConceptAST>,
): string[] {
  const warnings: string[] = [];

  if (conceptASTs.size === 0) return warnings;

  // Check when-clause references
  for (const pattern of sync.when) {
    const conceptName = pattern.concept.split('/').pop() || pattern.concept;
    if (conceptName === 'Web') continue; // Built-in bootstrap concept

    const ast = conceptASTs.get(conceptName);
    if (!ast) {
      warnings.push(
        `Sync "${sync.name}": when-clause references unknown concept "${conceptName}"`,
      );
    } else {
      const actionNames = new Set(ast.actions.map(a => a.name));
      if (!actionNames.has(pattern.action)) {
        warnings.push(
          `Sync "${sync.name}": when-clause references unknown action "${conceptName}/${pattern.action}"`,
        );
      }
    }
  }

  // Check then-clause references
  for (const action of sync.then) {
    const conceptName = action.concept.split('/').pop() || action.concept;
    if (conceptName === 'Web') continue;

    const ast = conceptASTs.get(conceptName);
    if (!ast) {
      warnings.push(
        `Sync "${sync.name}": then-clause references unknown concept "${conceptName}"`,
      );
    } else {
      const actionNames = new Set(ast.actions.map(a => a.name));
      if (!actionNames.has(action.action)) {
        warnings.push(
          `Sync "${sync.name}": then-clause references unknown action "${conceptName}/${action.action}"`,
        );
      }
    }
  }

  return warnings;
}

// ============================================================
// Field-level validation: check that field names used in sync
// patterns match the fields declared in concept specs.
// Produces warnings (not errors) for mismatches.
// ============================================================

function findAction(ast: ConceptAST, actionName: string): ActionDecl | undefined {
  return ast.actions.find(a => a.name === actionName);
}

export function validateSyncFields(
  sync: CompiledSync,
  conceptASTs: Map<string, ConceptAST>,
): string[] {
  const warnings: string[] = [];

  if (conceptASTs.size === 0) return warnings;

  // --- Validate when-clause fields ---
  for (const pattern of sync.when) {
    const conceptName = pattern.concept.split('/').pop() || pattern.concept;
    if (conceptName === 'Web') continue;

    const ast = conceptASTs.get(conceptName);
    if (!ast) continue; // Already warned by validateSyncReferences

    const actionDecl = findAction(ast, pattern.action);
    if (!actionDecl) continue; // Already warned by validateSyncReferences

    // Check input fields against declared params
    const declaredInputNames = new Set(actionDecl.params.map(p => p.name));
    for (const field of pattern.inputFields) {
      if (!declaredInputNames.has(field.name)) {
        warnings.push(
          `Sync "${sync.name}": when-clause input field "${field.name}" ` +
          `is not a declared parameter of ${conceptName}/${pattern.action} ` +
          `(declared: ${[...declaredInputNames].join(', ') || 'none'})`,
        );
      }
    }

    // Check output fields against declared variant output params.
    // A field is valid if it appears in ANY variant's output.
    const declaredOutputNames = new Set<string>();
    for (const variant of actionDecl.variants) {
      for (const param of variant.params) {
        declaredOutputNames.add(param.name);
      }
    }

    for (const field of pattern.outputFields) {
      if (!declaredOutputNames.has(field.name)) {
        warnings.push(
          `Sync "${sync.name}": when-clause output field "${field.name}" ` +
          `is not a declared output of ${conceptName}/${pattern.action} ` +
          `(declared: ${[...declaredOutputNames].join(', ') || 'none'})`,
        );
      }
    }
  }

  // --- Validate then-clause fields ---
  for (const action of sync.then) {
    const conceptName = action.concept.split('/').pop() || action.concept;
    if (conceptName === 'Web') continue;

    const ast = conceptASTs.get(conceptName);
    if (!ast) continue;

    const actionDecl = findAction(ast, action.action);
    if (!actionDecl) continue;

    const declaredInputNames = new Set(actionDecl.params.map(p => p.name));

    // Check that provided fields match declared params
    for (const field of action.fields) {
      if (!declaredInputNames.has(field.name)) {
        warnings.push(
          `Sync "${sync.name}": then-clause field "${field.name}" ` +
          `is not a declared parameter of ${conceptName}/${action.action} ` +
          `(declared: ${[...declaredInputNames].join(', ') || 'none'})`,
        );
      }
    }

    // Check that required input params are provided
    const providedFieldNames = new Set(action.fields.map(f => f.name));
    for (const param of actionDecl.params) {
      if (!providedFieldNames.has(param.name)) {
        warnings.push(
          `Sync "${sync.name}": then-clause for ${conceptName}/${action.action} ` +
          `is missing required parameter "${param.name}"`,
        );
      }
    }
  }

  return warnings;
}
