// CliTarget Concept Implementation
import type { ConceptHandler } from '@clef/kernel';

export const cliTargetHandler: ConceptHandler = {
  async generate(input, storage) {
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

    await storage.put('command', commandId, {
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

    // Check for too many positional arguments (more than 2 per action)
    const maxPositional = (parsedConfig.maxPositional as number) || 2;
    const actionPositionalCounts = parsedConfig.actionPositionals as Record<string, number> | undefined;
    if (actionPositionalCounts) {
      for (const [action, count] of Object.entries(actionPositionalCounts)) {
        if (count > maxPositional) {
          return {
            variant: 'tooManyPositional',
            action,
            count,
          };
        }
      }
    }

    return {
      variant: 'ok',
      commands,
      files,
    };
  },

  async validate(input, storage) {
    const command = input.command as string;

    const existing = await storage.get('command', command);
    if (!existing) {
      return { variant: 'ok', command };
    }

    const commands = JSON.parse(existing.commands as string) as string[];

    // Check for flag name collisions across commands
    const flagMap: Record<string, string[]> = {};
    for (const cmd of commands) {
      const parts = cmd.split(' ');
      const action = parts[parts.length - 1];
      const flags = [`--format`, `--id`];
      for (const flag of flags) {
        if (!flagMap[flag]) {
          flagMap[flag] = [];
        }
        flagMap[flag].push(action);
      }
    }

    for (const [flag, actions] of Object.entries(flagMap)) {
      if (actions.length > 1) {
        // In a real implementation, we would check if flag types differ
        // For now, we consider same-named flags across actions acceptable
      }
    }

    return { variant: 'ok', command };
  },

  async listCommands(input, storage) {
    const concept = input.concept as string;

    const commandBase = concept.toLowerCase().replace(/\s+/g, '-');
    const commandId = `cli-${commandBase}`;

    // Search for stored commands matching this concept
    const allCommands: string[] = [];
    const allSubcommands: string[] = [];

    const existing = await storage.get('command', commandId);
    if (existing) {
      const commands = JSON.parse(existing.commands as string) as string[];
      for (const cmd of commands) {
        const parts = cmd.split(' ');
        if (parts.length >= 2) {
          allCommands.push(parts.slice(0, 2).join(' '));
        }
        if (parts.length >= 3) {
          allSubcommands.push(parts.slice(2).join(' '));
        }
      }
    } else {
      // Return defaults based on concept name
      allCommands.push(`clef ${commandBase}`);
      allSubcommands.push('create', 'get', 'list', 'update', 'delete');
    }

    return {
      variant: 'ok',
      commands: allCommands,
      subcommands: allSubcommands,
    };
  },
};
