#!/usr/bin/env npx tsx
// ============================================================
// Thin dispatcher for TestGeneration/run (MAG-913 INV-9).
//
// This script used to walk the filesystem, parse every .concept
// file, render TypeScript test code, and write it to
// generated/tests/. All of that imperative work is now owned by
// the TestGeneration derived concept and its sync chain
// (ExtractInvariants -> BuildTestPlan -> RenderForEachPlatform
// -> WriteArtifact). This file invokes the concept through the
// kernel so the pipeline is visible to Score, Pilot, and
// FlowTrace as a first-class concept invocation instead of a
// one-off Node script.
//
// For the previous imperative implementation (used as a fallback
// while TestGeneration's discovery logic is being built out in
// follow-up cards MAG-910/911/912/914), see:
//   scripts/_legacy/generate-all-tests-legacy.ts
//
// Usage:
//   npx tsx --tsconfig tsconfig.json scripts/generate-all-tests.ts [target]
//   npx tsx --tsconfig tsconfig.json scripts/generate-all-tests.ts --fallback-legacy
//
// `target` defaults to "all"; valid values: all | concept | widget | sync.
// ============================================================

import { spawn } from 'child_process';
import { resolve } from 'path';
import { getKernel } from '../clef-base/lib/kernel';

async function runLegacy(scriptName: string): Promise<number> {
  const legacyPath = resolve(__dirname, '_legacy', scriptName);
  console.warn(`[TestGeneration] Falling back to legacy script: ${scriptName}`);
  return new Promise((resolvePromise) => {
    const child = spawn('npx', ['tsx', '--tsconfig', 'tsconfig.json', legacyPath], {
      stdio: 'inherit',
      cwd: resolve(__dirname, '..'),
    });
    child.on('exit', (code) => resolvePromise(code ?? 1));
  });
}

async function main() {
  const argv = process.argv.slice(2);
  const fallbackLegacy = argv.includes('--fallback-legacy');
  const target = argv.find((a) => !a.startsWith('--')) ?? 'all';

  if (fallbackLegacy) {
    const code = await runLegacy('generate-all-tests-legacy.ts');
    process.exit(code);
  }

  const kernel = getKernel();
  const result = (await kernel.invokeConcept(
    'urn:clef/TestGeneration',
    'run',
    { target },
  )) as Record<string, unknown>;

  if (result.variant === 'error' || result.variant === 'unimplemented') {
    console.warn(
      `[TestGeneration] Pipeline reported ${String(result.variant)}: ${String(result.message ?? 'unknown')}. ` +
        `Falling back to legacy script. Suppress with --force-concept.`,
    );
    const code = await runLegacy('generate-all-tests-legacy.ts');
    process.exit(code);
  }

  if (result.variant !== 'ok') {
    console.error(`TestGeneration failed: variant=${String(result.variant)} message=${String(result.message ?? 'unknown')}`);
    process.exit(1);
  }

  const generated = Number(result.generated ?? 0);
  const changed = Number(result.changed ?? 0);
  const failed = Number(result.failed ?? 0);

  if (generated === 0 && changed === 0 && failed === 0) {
    console.warn(
      '[TestGeneration] Discovery logic not yet implemented — nothing generated. ' +
        'See follow-up cards MAG-910/911/912/914. ' +
        'Re-run with --fallback-legacy to use the previous imperative script.',
    );
  }

  console.log(`Generated: ${generated}, Changed: ${changed}, Failed: ${failed}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
