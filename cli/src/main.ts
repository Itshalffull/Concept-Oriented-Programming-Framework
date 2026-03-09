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
import { pathToFileURL } from 'node:url';

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
      const { suiteCommand } = await import('./commands/suite.js');
      await suiteCommand(positional, flags);
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

export async function main(): Promise<void> {
  const { command, positional, flags } = parseArgs(process.argv);

  // Bootstrap commands are always available (hand-written)
  if (BOOTSTRAP_COMMANDS.has(command)) {
    await runBootstrapCommand(command, positional, flags);
    return;
  }

  // Boot the kernel before delegating to the generated CLI.
  // All generated commands call globalThis.kernel.handleRequest(),
  // so the kernel must be running first.
  try {
    const { kernelBootHandler } = await import('../../handlers/ts/framework/kernel-boot.handler.js');
    const { createInMemoryStorage } = await import('../../runtime/adapters/storage.js');
    const bootStorage = createInMemoryStorage();
    const projectRoot = process.cwd();
    const result = await kernelBootHandler.boot(
      { projectRoot },
      bootStorage,
    );
    if (result.variant === 'ok' || result.variant === 'syncCompilationFailed') {
      const concepts = (result.concepts as string[]) || [];
      if (result.variant === 'syncCompilationFailed') {
        console.error(`[kernel] Booted with ${concepts.length} concepts, but some syncs failed to compile`);
      }
    } else {
      console.error(`[kernel] Boot failed: ${result.variant}`);
    }
  } catch (err) {
    if (!(err instanceof SyntaxError) &&
        !(err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ERR_MODULE_NOT_FOUND')) {
      console.error(`[kernel] Boot error: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Everything else delegates to the generated Commander.js program.
  // This program is produced by `clef interface generate` and lives
  // in index.ts alongside this file.
  try {
    const mod = await import('./index.js');
    const program = mod.default;
    if (program && typeof program.parseAsync === 'function') {
      program.exitOverride(); // Don't call process.exit — throw instead
      try {
        await program.parseAsync(process.argv);
      } catch (err: unknown) {
        // Commander throws CommanderError for --help, --version, and validation
        if (err && typeof err === 'object' && 'exitCode' in err) {
          process.exit((err as { exitCode: number }).exitCode);
        }
        throw err;
      }
      return;
    }
  } catch (err: unknown) {
    // Only swallow module-not-found errors (generated CLI not yet built).
    // Re-throw actual runtime errors so they're visible.
    if (err && typeof err === 'object' && 'code' in err && (err as { code: string }).code === 'ERR_MODULE_NOT_FOUND') {
      // Generated CLI not available — run `clef interface generate` first
    } else if (err instanceof SyntaxError) {
      // Generated CLI has a syntax error — treat as not available
    } else {
      throw err;
    }
  }

  if (command === 'help' || command === '--help' || command === '-h') {
    console.log(`Usage: clef <command> [args...]

Bootstrap commands (always available):
  interface      Interface generation (generate|plan|validate|files|clean)
  generate       Generate schemas and code from concept specs
  compile-syncs  Compile sync specifications
  init           Initialize a new Clef project
  suite          Suite management (list|add|info|validate)
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

function isDirectExecution(): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(entry).href;
}

if (isDirectExecution()) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
