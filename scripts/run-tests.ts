#!/usr/bin/env npx tsx
// ============================================================
// Thin dispatcher for Builder/test (MAG-917 INV-13).
//
// Test execution used to run as a plain `npx vitest` — the
// dormant quality-signal syncs in repertoire/concepts/testing
// that pattern-match on Builder/test completions never fired,
// so RuntimeCoverage / QualitySignal / FlakyTest rows never
// materialized. This script routes execution through the
// kernel so Builder/test produces a visible completion, and
// the wired sync chain (unit-tests-publish-quality-signal,
// etc.) publishes signals the rest of the Score layer can see.
//
// The Builder handler's `test` action shells out to
// `npx vitest run --reporter=json`, parses the report, and
// returns an `ok(passed, failed, skipped, duration, testType)`
// completion (or a failure variant on `failed > 0`).
//
// Usage:
//   npx tsx --tsconfig tsconfig.json scripts/run-tests.ts [concept] [--lang=typescript]
// ============================================================

import { getKernel } from '../clef-base/lib/kernel';

async function main() {
  const argv = process.argv.slice(2);
  const concept = argv.find((a) => !a.startsWith('--')) ?? 'clef';
  const language = (argv.find((a) => a.startsWith('--lang='))?.split('=')[1]) ?? 'typescript';
  const platform = (argv.find((a) => a.startsWith('--platform='))?.split('=')[1]) ?? process.platform;
  const testType = (argv.find((a) => a.startsWith('--type='))?.split('=')[1]) ?? 'unit';

  const kernel = getKernel();
  const result = (await kernel.invokeConcept(
    'urn:clef/Builder',
    'test',
    {
      concept,
      language,
      platform,
      testType,
      execute: true,
    },
  )) as Record<string, unknown>;

  if (result.variant === 'error') {
    console.error(`Builder/test errored: ${String(result.reason ?? 'unknown')}`);
    process.exit(1);
  }

  const passed = Number(result.passed ?? 0);
  const failed = Number(result.failed ?? 0);
  const skipped = Number(result.skipped ?? 0);
  const duration = Number(result.duration ?? 0);

  console.log(
    `Builder/test (${language}/${testType}): ${passed} passed, ${failed} failed, ${skipped} skipped (${duration}ms)`,
  );

  if (failed > 0 && Array.isArray(result.failures)) {
    for (const f of result.failures as Array<{ test: string; message: string }>) {
      console.error(`  FAIL ${f.test}: ${f.message.split('\n')[0]}`);
    }
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
