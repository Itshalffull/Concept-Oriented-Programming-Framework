export interface ParsedArgs {
  command: string;
  positional: string[];
  flags: Record<string, string | boolean>;
}

export function parseArgs(argv: string[]): ParsedArgs {
  // Skip the first two args (node and script path)
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

async function boot(): Promise<void> {
  // Try the generated CLI entrypoint (commands.ts, written by the
  // interface generator to cli/src/). It contains all concept commands
  // with merge logic for shared command groups (e.g. scaffold-*).
  try {
    const generatedCli = await import('./commands.ts');
    const program = (generatedCli.default ?? generatedCli.program) as
      | { parseAsync?: (argv: string[]) => Promise<void>; addCommand?: (cmd: unknown) => void }
      | undefined;

    if (program?.parseAsync) {
      // Register hand-written commands (interface, etc.) on the generated program
      try {
        const { interfaceCliCommand } = await import('./commands/interface-cli.command.ts');
        if (program.addCommand) program.addCommand(interfaceCliCommand);
      } catch { /* interface command not available */ }

      await program.parseAsync(process.argv);
      return;
    }
  } catch {
    // Generated entrypoint not available yet — fall through to legacy CLI
  }

  // Fallback: hand-written CLI with basic commands
  const fallbackCli = await import('./index.ts');
  await fallbackCli.runCli(process.argv);
}

void boot();
