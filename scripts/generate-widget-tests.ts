#!/usr/bin/env npx tsx
// ============================================================
// Thin dispatcher for TestGeneration/run with target=widget
// (MAG-913 INV-9).
//
// This script used to parse every .widget file and render
// framework-specific test code (React / Vue / Svelte / Vanilla /
// Playwright) directly. All of that work now lives inside the
// TestGeneration sync chain, with renderer selection driven by
// PluginRegistry (see MAG-907 register-react-renderer and
// register-playwright-renderer syncs).
//
// For the previous imperative implementation (used as a fallback
// while TestGeneration's discovery logic is being built out in
// follow-up cards MAG-910/911/912/914), see:
//   scripts/_legacy/generate-widget-tests-legacy.ts
//
// Usage:
//   npx tsx --tsconfig tsconfig.json scripts/generate-widget-tests.ts [target]
//   npx tsx --tsconfig tsconfig.json scripts/generate-widget-tests.ts --fallback-legacy
//
// `target` defaults to "widget".
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
  const target = argv.find((a) => !a.startsWith('--')) ?? 'widget';

  if (fallbackLegacy) {
    const code = await runLegacy('generate-widget-tests-legacy.ts');
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
        `Falling back to legacy script.`,
    );
    const code = await runLegacy('generate-widget-tests-legacy.ts');
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
      '[TestGeneration] Widget discovery logic not yet implemented — nothing generated. ' +
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
