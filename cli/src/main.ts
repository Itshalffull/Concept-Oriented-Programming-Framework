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
  try {
    const generatedCli = await import('../../generated/devtools/cli/index.ts');
    const program = (generatedCli.default ?? generatedCli.program) as { parseAsync?: (argv: string[]) => Promise<void> };

    if (program?.parseAsync) {
      await program.parseAsync(process.argv);
      return;
    }
  } catch (err) {
    const importError =
      err instanceof Error &&
      ('code' in err) &&
      (err as Error & { code?: string }).code === 'ERR_MODULE_NOT_FOUND';

    if (!importError) {
      throw err;
    }
  }

  const fallbackCli = await import('./index.ts');
  await fallbackCli.runCli(process.argv);
}

void boot();
