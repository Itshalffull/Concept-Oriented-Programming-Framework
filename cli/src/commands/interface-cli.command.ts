// Commander wrapper for the hand-written interface command.
// Registered on the generated CLI program by main.ts so that
// `clef interface generate|plan|validate|files|clean` works.

import { Command } from 'commander';

export const interfaceCliCommand = new Command('interface')
  .description('Generate, plan, validate, list, or clean interface outputs.')
  .argument('<subcommand>', 'generate | plan | validate | files | clean')
  .option('--manifest <path>', 'Path to interface manifest YAML')
  .option('--json', 'Output as JSON')
  .allowUnknownOption(true)
  .action(async (subcommand: string, opts: Record<string, string | boolean>) => {
    const { interfaceCommand } = await import('./interface.ts');
    await interfaceCommand([subcommand], opts);
  });
