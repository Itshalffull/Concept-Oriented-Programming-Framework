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
