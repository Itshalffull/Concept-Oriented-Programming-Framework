#!/usr/bin/env node
// ============================================================
// COPF CLI — Entry Point
//
// Routes commands to their handlers. Generated concept commands
// are imported from the generated Commander.js command tree.
// The `interface` command is the generation infrastructure and
// is the only non-generated command handler.
//
// Usage:
//   copf interface <subcommand> [args...]
//   copf <concept-command> <action> [options]
// ============================================================

import { interfaceCommand } from './commands/interface.js';

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
  interface <subcommand>          Interface generation
    generate                       Generate all configured interfaces
    plan                           Show generation plan without executing
    validate                       Validate interface manifest and projections
    files                          List generated output files
    clean                          Remove orphaned generated files

All other commands (check, generate, deploy, etc.) are generated from
concept specs via the interface generation pipeline. Run:

  copf interface generate --manifest examples/devtools/devtools.interface.yaml

to regenerate CLI commands into tools/copf-cli/src/commands/.

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
      case 'interface':
        await interfaceCommand(parsed.positional, parsed.flags);
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
