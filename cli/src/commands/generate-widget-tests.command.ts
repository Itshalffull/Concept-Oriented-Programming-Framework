// Commander wrapper for widget test generation.
// Registered on the generated CLI program by main.ts so that
// `clef generate-widget-tests [--widget name] [--force] [--dry-run]` works.
//
// Delegates to scripts/generate-widget-tests.ts by spawning it as a
// child process, forwarding the relevant flags. This avoids duplicating
// the generation logic and keeps the CLI command a thin wrapper.

import { Command } from 'commander';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const ROOT = resolve(fileURLToPath(new URL('../../..', import.meta.url)));

export const generateWidgetTestsCommand = new Command('generate-widget-tests')
  .description('Generate React Testing Library conformance tests from .widget specs.')
  .option('--widget <name>', 'Generate tests for a specific widget (matched against file path)')
  .option('--force', 'Force overwrite of existing test files (ignore patches)')
  .option('--dry-run', 'Show what would be generated without writing files')
  .action(async (opts: { widget?: string; force?: boolean; dryRun?: boolean }) => {
    const scriptPath = resolve(ROOT, 'scripts', 'generate-widget-tests.ts');
    const args: string[] = [];

    if (opts.dryRun) args.push('--dry-run');
    if (opts.force) args.push('--force');
    if (opts.widget) args.push(`--filter=${opts.widget}`);

    const child = spawn(
      'npx',
      ['tsx', scriptPath, ...args],
      { cwd: ROOT, stdio: 'inherit', shell: true },
    );

    return new Promise<void>((resolvePromise, reject) => {
      child.on('close', (code) => {
        if (code === 0) resolvePromise();
        else reject(new Error(`generate-widget-tests exited with code ${code}`));
      });
      child.on('error', reject);
    });
  });
