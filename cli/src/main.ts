// ============================================================
// Clef CLI — Bootstrap Entrypoint
//
// Thin bootstrap that delegates to the generated Commander.js
// program (index.ts) for all commands. The only hand-written
// commands are `interface` and `generate` — the meta-commands
// that produce everything else. Once generated, the Commander
// program handles all concept-derived commands.
//
// Usage:
//   clef interface generate --manifest <path>   # bootstrap step
//   clef <command> [args...]                     # generated commands
// ============================================================

// --- Argument Parser ---

interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
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

// --- Bootstrap commands (hand-written, always available) ---

const BOOTSTRAP_COMMANDS = new Set([
  'interface', 'bind', 'generate', 'compile-syncs', 'init', 'kit', 'suite', 'inspect',
]);

async function runBootstrapCommand(
  command: string,
  positional: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  switch (command) {
    case 'interface':
    case 'bind': {
      const { interfaceCommand } = await import('./commands/interface.js');
      await interfaceCommand(positional, flags);
      break;
    }
    case 'generate': {
      const { generateCommand } = await import('./commands/generate.js');
      await generateCommand(positional, flags);
      break;
    }
    case 'compile-syncs': {
      const { compileSyncsCommand } = await import('./commands/compile-syncs.js');
      await compileSyncsCommand(positional, flags);
      break;
    }
    case 'init': {
      const { initCommand } = await import('./commands/init.js');
      await initCommand(positional, flags);
      break;
    }
    case 'kit':
    case 'suite': {
      const { kitCommand } = await import('./commands/suite.js');
      await kitCommand(positional, flags);
      break;
    }
    case 'inspect': {
      const { runInspect } = await import('./commands/inspect.js');
      await runInspect(positional, flags);
      break;
    }
  }
}

// --- Main ---

async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv);

  // Bootstrap commands are always available (hand-written)
  if (BOOTSTRAP_COMMANDS.has(command)) {
    await runBootstrapCommand(command, positional, flags);
    return;
  }

  // Everything else delegates to the generated Commander.js program.
  // This program is produced by `clef interface generate` and lives
  // in index.ts alongside this file.
  try {
    const { default: program } = await import('./index.js');
    if (program && typeof program.parseAsync === 'function') {
      await program.parseAsync(process.argv);
      return;
    }
  } catch {
    // Generated CLI not available — run `clef interface generate` first
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(`Usage: clef <command> [args...]

Bootstrap commands (always available):
  interface      Interface generation (generate|plan|validate|files|clean)
  generate       Generate schemas and code from concept specs
  compile-syncs  Compile sync specifications
  init           Initialize a new Clef project
  kit            Suite management (list|add|info|validate)
  inspect        Inspect syntax trees and parsed structures

Generated commands (available after 'clef interface generate'):
  Run 'clef <generated-command> --help' for details.
`);
    return;
  }

  console.error(`Unknown command: ${command}`);
  console.error(`Run 'clef interface generate --manifest <path>' to generate CLI commands.`);
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
