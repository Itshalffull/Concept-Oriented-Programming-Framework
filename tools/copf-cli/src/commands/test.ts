// ============================================================
// copf test [concept] [--integration]
//
// Runs conformance tests for a specific concept or all concepts,
// or full integration tests when --integration is specified.
//
// Conformance tests are generated from invariants in the spec
// (Section 7.4) and executed against the concept implementation.
//
// Integration tests start the sync engine, register all concepts,
// and run flow-level tests.
// ============================================================

import { readFileSync, existsSync } from 'fs';
import { resolve, relative, join } from 'path';
import { spawn } from 'child_process';
import { parseConceptFile } from '../../../../kernel/src/parser.js';
import { createInMemoryStorage } from '../../../../kernel/src/storage.js';
import { schemaGenHandler } from '../../../../implementations/typescript/framework/schema-gen.impl.js';
import { typescriptGenHandler } from '../../../../implementations/typescript/framework/typescript-gen.impl.js';
import type { ConceptAST, ConceptManifest } from '../../../../kernel/src/types.js';
import { findFiles } from '../util.js';

export async function testCommand(
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  if (flags.integration) {
    await runIntegrationTests(flags);
    return;
  }

  const conceptFilter = positional[0]?.toLowerCase();
  await runConformanceTests(conceptFilter, flags);
}

async function runConformanceTests(
  conceptFilter: string | undefined,
  flags: Record<string, string | boolean>,
): Promise<void> {
  const projectDir = resolve(process.cwd());
  const specsDir = typeof flags.specs === 'string' ? flags.specs : 'specs';
  const implsDir = typeof flags.implementations === 'string'
    ? flags.implementations
    : 'implementations/typescript';

  const conceptFiles = findFiles(resolve(projectDir, specsDir), '.concept');

  if (conceptFiles.length === 0) {
    console.log('No .concept files found.');
    return;
  }

  // Filter to specific concept if requested
  const specs: { file: string; ast: ConceptAST }[] = [];
  for (const file of conceptFiles) {
    const source = readFileSync(file, 'utf-8');
    try {
      const ast = parseConceptFile(source);
      if (conceptFilter && ast.name.toLowerCase() !== conceptFilter) continue;
      specs.push({ file: relative(projectDir, file), ast });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Parse error in ${relative(projectDir, file)}: ${message}`);
    }
  }

  if (specs.length === 0) {
    if (conceptFilter) {
      console.error(`Concept "${conceptFilter}" not found.`);
    } else {
      console.log('No concepts to test.');
    }
    process.exit(1);
  }

  let totalInvariants = 0;
  let testedConcepts = 0;

  for (const { file, ast } of specs) {
    if (ast.invariants.length === 0) {
      console.log(`  [SKIP] ${ast.name} — no invariants defined`);
      continue;
    }

    // Check for implementation
    const implPath = findImplementation(projectDir, implsDir, ast.name);
    if (!implPath) {
      console.log(
        `  [SKIP] ${ast.name} — no implementation found in ${implsDir}/`,
      );
      continue;
    }

    // Generate manifest via SchemaGen
    const schemaStorage = createInMemoryStorage();
    const schemaResult = await schemaGenHandler.generate(
      { spec: file, ast },
      schemaStorage,
    );

    if (schemaResult.variant !== 'ok') {
      console.error(`  [FAIL] ${ast.name} — schema generation failed: ${schemaResult.message}`);
      continue;
    }

    const manifest = schemaResult.manifest as ConceptManifest;
    totalInvariants += manifest.invariants.length;
    testedConcepts++;

    // Run invariants directly against the handler
    const handler = await loadHandler(implPath);
    if (!handler) {
      console.error(`  [FAIL] ${ast.name} — could not load handler from ${implPath}`);
      continue;
    }

    let passed = 0;
    let failed = 0;

    for (const inv of manifest.invariants) {
      try {
        const storage = createInMemoryStorage();
        await executeInvariant(handler, inv, storage);
        passed++;
      } catch (err: unknown) {
        failed++;
        const message = err instanceof Error ? err.message : String(err);
        console.error(`    FAIL: ${inv.description}`);
        console.error(`          ${message}`);
      }
    }

    if (failed === 0) {
      console.log(
        `  [OK]   ${ast.name} — ${passed} invariant(s) passed`,
      );
    } else {
      console.log(
        `  [FAIL] ${ast.name} — ${passed} passed, ${failed} failed`,
      );
    }
  }

  console.log(
    `\n${testedConcepts} concept(s) tested, ${totalInvariants} invariant(s)`,
  );
}

async function runIntegrationTests(
  flags: Record<string, string | boolean>,
): Promise<void> {
  const projectDir = resolve(process.cwd());

  console.log('Running integration tests...\n');

  // Delegate to vitest for integration tests
  const testDir = typeof flags['test-dir'] === 'string'
    ? flags['test-dir']
    : 'tests';
  const pattern = join(testDir, '**/*.test.ts');

  return new Promise<void>((res, rej) => {
    const child = spawn(
      'npx',
      ['vitest', 'run', '--reporter=verbose', pattern],
      {
        cwd: projectDir,
        stdio: 'inherit',
        shell: true,
      },
    );

    child.on('close', (code) => {
      if (code === 0) {
        res();
      } else {
        process.exit(code || 1);
      }
    });

    child.on('error', (err) => {
      console.error(`Failed to run vitest: ${err.message}`);
      rej(err);
    });
  });
}

function findImplementation(
  projectDir: string,
  implsDir: string,
  conceptName: string,
): string | null {
  const lowerName = conceptName.toLowerCase();
  // Check in app/ and framework/ subdirectories
  const candidates = [
    join(projectDir, implsDir, 'app', `${lowerName}.impl.ts`),
    join(projectDir, implsDir, 'framework', `${lowerName}.impl.ts`),
    join(projectDir, implsDir, `${lowerName}.impl.ts`),
  ];

  for (const path of candidates) {
    if (existsSync(path)) return path;
  }
  return null;
}

async function loadHandler(
  implPath: string,
): Promise<Record<string, Function> | null> {
  try {
    const mod = await import(implPath);
    // Look for the handler export — convention is <name>Handler
    for (const key of Object.keys(mod)) {
      if (key.endsWith('Handler') && typeof mod[key] === 'object') {
        return mod[key];
      }
    }
    return null;
  } catch {
    return null;
  }
}

interface InvariantSchema {
  description: string;
  setup: InvariantStep[];
  assertions: InvariantStep[];
  freeVariables: { name: string; testValue: string }[];
}

interface InvariantStep {
  action: string;
  inputs: { name: string; value: InvariantValue }[];
  expectedVariant: string;
  expectedOutputs: { name: string; value: InvariantValue }[];
}

type InvariantValue =
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'variable'; name: string };

async function executeInvariant(
  handler: Record<string, Function>,
  inv: InvariantSchema,
  storage: { put: Function; get: Function; find: Function; del: Function; delMany: Function },
): Promise<void> {
  const bindings: Record<string, unknown> = {};

  // Initialize free variable bindings
  for (const fv of inv.freeVariables) {
    bindings[fv.name] = fv.testValue;
  }

  // Execute setup (after clause)
  for (const step of inv.setup) {
    await executeStep(handler, step, bindings, storage);
  }

  // Execute assertions (then clause)
  for (const step of inv.assertions) {
    await executeStep(handler, step, bindings, storage);
  }
}

async function executeStep(
  handler: Record<string, Function>,
  step: InvariantStep,
  bindings: Record<string, unknown>,
  storage: unknown,
): Promise<void> {
  const fn = handler[step.action];
  if (!fn) {
    throw new Error(`Handler missing action: ${step.action}`);
  }

  // Build input from step definition
  const input: Record<string, unknown> = {};
  for (const { name, value } of step.inputs) {
    input[name] = value.kind === 'literal' ? value.value : bindings[value.name];
  }

  const result = await fn(input, storage);

  // Assert variant
  if (result.variant !== step.expectedVariant) {
    throw new Error(
      `Expected variant "${step.expectedVariant}" but got "${result.variant}" from ${step.action}`,
    );
  }

  // Assert outputs
  for (const { name, value } of step.expectedOutputs) {
    const actual = result[name];
    const expected = value.kind === 'literal' ? value.value : bindings[value.name];
    if (actual !== expected) {
      throw new Error(
        `Expected ${name}=${JSON.stringify(expected)} but got ${JSON.stringify(actual)} from ${step.action}`,
      );
    }
    // If it's a variable, bind it for future steps
    if (value.kind === 'variable') {
      bindings[value.name] = actual;
    }
  }
}
