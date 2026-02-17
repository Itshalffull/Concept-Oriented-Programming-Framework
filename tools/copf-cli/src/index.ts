#!/usr/bin/env node
// ============================================================
// COPF CLI — Entry Point
//
// Routes commands to their handlers per Section 12 of the
// architecture doc.
//
// Usage:
//   copf init <name>
//   copf check
//   copf generate --target <lang> [--concept <name>]
//   copf compile-syncs
//   copf test [concept] [--integration]
//   copf dev
//   copf deploy --manifest <file>
//   copf kit <subcommand> [args...]
// ============================================================

import { initCommand } from './commands/init.js';
import { checkCommand } from './commands/check.js';
import { generateCommand } from './commands/generate.js';
import { compileSyncsCommand } from './commands/compile-syncs.js';
import { testCommand } from './commands/test.js';
import { deployCommand } from './commands/deploy.js';
import { kitCommand } from './commands/kit.js';
import { devCommand } from './commands/dev.js';

const VERSION = '0.1.0';

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  // Skip node and script path
  const args = argv.slice(2);
  const command = args[0] || 'help';
  const positional: string[] = [];
  const flags: Record<string, string | boolean> = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = args[i + 1];
      if (next && !next.startsWith('--')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }

  return { command, positional, flags };
}

function printHelp(): void {
  console.log(`copf v${VERSION} — Concept-Oriented Programming Framework CLI

Usage: copf <command> [options]

Commands:
  init <name>                    Initialize a new COPF project
  check                          Parse and validate all concept specs
  generate --target <lang>       Generate schemas + code for all concepts
    --target typescript|rust       Target language
    --concept <Name>               Generate for a single concept only
  compile-syncs                  Compile syncs and validate against manifests
  test [concept]                 Run conformance tests for a concept
    --integration                  Run full integration tests
  dev                            Start the development server
  deploy --manifest <file>       Deploy according to manifest
  kit <subcommand>               Kit management
    init <name>                    Scaffold a new kit directory
    validate <path>                Validate kit manifest and syncs
    test <path>                    Run kit conformance + integration tests
    list                           Show kits used by the current app
    check-overrides                Verify app overrides reference valid syncs

Options:
  --help                         Show this help message
  --version                      Show version
`);
}

export async function main(argv: string[] = process.argv): Promise<void> {
  const parsed = parseArgs(argv);

  if (parsed.flags.version) {
    console.log(VERSION);
    return;
  }

  if (parsed.flags.help || parsed.command === 'help') {
    printHelp();
    return;
  }

  try {
    switch (parsed.command) {
      case 'init':
        await initCommand(parsed.positional, parsed.flags);
        break;
      case 'check':
        await checkCommand(parsed.positional, parsed.flags);
        break;
      case 'generate':
        await generateCommand(parsed.positional, parsed.flags);
        break;
      case 'compile-syncs':
        await compileSyncsCommand(parsed.positional, parsed.flags);
        break;
      case 'test':
        await testCommand(parsed.positional, parsed.flags);
        break;
      case 'dev':
        await devCommand(parsed.positional, parsed.flags);
        break;
      case 'deploy':
        await deployCommand(parsed.positional, parsed.flags);
        break;
      case 'kit':
        await kitCommand(parsed.positional, parsed.flags);
        break;
      default:
        console.error(`Unknown command: ${parsed.command}`);
        console.error('Run "copf --help" for usage information.');
        process.exit(1);
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main();
