// @migrated dsl-constructs 2026-03-18
// CliTarget Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const cliTargetHandler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const projection = input.projection as string;
    const config = input.config as string;

    const parsedConfig = JSON.parse(config || '{}');
    const binaryName = (parsedConfig.binaryName as string) || 'clef';
    const shell = (parsedConfig.shell as string) || 'bash';
    const outputFormats = (parsedConfig.outputFormats as string[]) || ['json', 'table'];

    const conceptName = projection.replace(/-projection$/, '').replace(/-/g, ' ');
    const commandBase = conceptName.toLowerCase().replace(/\s+/g, '-');

    const commands = [
      `${binaryName} ${commandBase} create`,
      `${binaryName} ${commandBase} get`,
      `${binaryName} ${commandBase} list`,
      `${binaryName} ${commandBase} update`,
      `${binaryName} ${commandBase} delete`,
    ];

    const mainFile = [
      `#!/usr/bin/env node`,
      `// Generated CLI for ${conceptName}`,
      `// Binary: ${binaryName}`,
      ``,
      `import { Command } from 'commander';`,
      ``,
      `const program = new Command();`,
      `program.name('${binaryName}');`,
      `program.version('1.0.0');`,
      ``,
      `const ${commandBase.replace(/-/g, '')} = program.command('${commandBase}');`,
      ``,
      `${commandBase.replace(/-/g, '')}.command('create')`,
      `  .description('Create a new ${conceptName}')`,
      `  .option('--format <format>', 'Output format', '${outputFormats[0]}')`,
      `  .action((opts) => { /* handler */ });`,
      ``,
      `${commandBase.replace(/-/g, '')}.command('get')`,
      `  .description('Get a ${conceptName} by ID')`,
      `  .argument('<id>', '${conceptName} ID')`,
      `  .option('--format <format>', 'Output format', '${outputFormats[0]}')`,
      `  .action((id, opts) => { /* handler */ });`,
      ``,
      `${commandBase.replace(/-/g, '')}.command('list')`,
      `  .description('List all ${conceptName} entries')`,
      `  .option('--format <format>', 'Output format', '${outputFormats[0]}')`,
      `  .action((opts) => { /* handler */ });`,
      ``,
      `${commandBase.replace(/-/g, '')}.command('update')`,
      `  .description('Update a ${conceptName}')`,
      `  .argument('<id>', '${conceptName} ID')`,
      `  .option('--format <format>', 'Output format', '${outputFormats[0]}')`,
      `  .action((id, opts) => { /* handler */ });`,
      ``,
      `${commandBase.replace(/-/g, '')}.command('delete')`,
      `  .description('Delete a ${conceptName}')`,
      `  .argument('<id>', '${conceptName} ID')`,
      `  .action((id) => { /* handler */ });`,
      ``,
      `program.parse();`,
    ].join('\n');

    const completionFile = shell === 'zsh'
      ? `#compdef ${binaryName}\n_${binaryName}() { /* zsh completion */ }`
      : `# ${shell} completion for ${binaryName}\ncomplete -W "${commands.map(c => c.split(' ').slice(1).join(' ')).join(' ')}" ${binaryName}`;

    const files = [
      `src/cli/${commandBase}.ts`,
      `src/cli/completion.${shell}`,
    ];

    const commandId = `cli-${commandBase}-${Date.now()}`;

    // Check for too many positional arguments (more than 2 per action)
    const maxPositional = (parsedConfig.maxPositional as number) || 2;
    const actionPositionalCounts = parsedConfig.actionPositionals as Record<string, number> | undefined;
    if (actionPositionalCounts) {
      for (const [action, count] of Object.entries(actionPositionalCounts)) {
        if (count > maxPositional) {
          let p = createProgram();
          return complete(p, 'tooManyPositional', { action, count }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
        }
      }
    }

    let p = createProgram();
    p = put(p, 'command', commandId, {
      commandId,
      binaryName,
      shell,
      outputFormats: JSON.stringify(outputFormats),
      concept: conceptName,
      commands: JSON.stringify(commands),
      files: JSON.stringify(files),
      mainFile,
      completionFile,
      projection,
      config,
      generatedAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { commands, files }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  validate(input: Record<string, unknown>) {
    const command = input.command as string;

    let p = createProgram();
    p = spGet(p, 'command', command, 'existing');
    // Flag collision detection resolved at runtime from bindings
    return complete(p, 'ok', { command }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  listCommands(input: Record<string, unknown>) {
    const concept = input.concept as string;
    const commandBase = concept.toLowerCase().replace(/\s+/g, '-');
    const commandId = `cli-${commandBase}`;

    let p = createProgram();
    p = spGet(p, 'command', commandId, 'existing');
    // Command list extraction resolved at runtime from bindings
    return complete(p, 'ok', { commands: [], subcommands: [] }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
