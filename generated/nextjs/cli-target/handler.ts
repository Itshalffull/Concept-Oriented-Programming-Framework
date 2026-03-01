// CliTarget — Generates CLI command definitions from concept projections.
// Maps concept actions to commands with flags, positional args, and subcommands.
// Detects flag collisions and enforces positional argument limits.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  CliTargetStorage,
  CliTargetGenerateInput,
  CliTargetGenerateOutput,
  CliTargetValidateInput,
  CliTargetValidateOutput,
  CliTargetListCommandsInput,
  CliTargetListCommandsOutput,
} from './types.js';

import {
  generateOk,
  generateTooManyPositional,
  validateOk,
  validateFlagCollision,
  listCommandsOk,
} from './types.js';

export interface CliTargetError {
  readonly code: string;
  readonly message: string;
}

export interface CliTargetHandler {
  readonly generate: (
    input: CliTargetGenerateInput,
    storage: CliTargetStorage,
  ) => TE.TaskEither<CliTargetError, CliTargetGenerateOutput>;
  readonly validate: (
    input: CliTargetValidateInput,
    storage: CliTargetStorage,
  ) => TE.TaskEither<CliTargetError, CliTargetValidateOutput>;
  readonly listCommands: (
    input: CliTargetListCommandsInput,
    storage: CliTargetStorage,
  ) => TE.TaskEither<CliTargetError, CliTargetListCommandsOutput>;
}

// --- Pure helpers ---

const storageError = (error: unknown): CliTargetError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Maximum positional arguments per CLI command (beyond this, use flags instead). */
const MAX_POSITIONAL_ARGS = 3;

/** Parse projection into concept metadata with actions and their parameter shapes. */
const parseProjection = (projection: string): {
  readonly concept: string;
  readonly actions: readonly {
    readonly name: string;
    readonly positional: readonly string[];
    readonly flags: readonly string[];
  }[];
} =>
  pipe(
    O.tryCatch(() => JSON.parse(projection) as Record<string, unknown>),
    O.map((parsed) => ({
      concept: (parsed['concept'] as string | undefined) ?? 'Unknown',
      actions: (parsed['actions'] as readonly { name: string; positional: string[]; flags: string[] }[] | undefined) ?? [],
    })),
    O.getOrElse(() => ({
      concept: projection,
      actions: [
        { name: 'create', positional: ['name'] as readonly string[], flags: ['--verbose', '--format'] as readonly string[] },
        { name: 'get', positional: ['id'] as readonly string[], flags: ['--format'] as readonly string[] },
        { name: 'list', positional: [] as readonly string[], flags: ['--limit', '--offset', '--format'] as readonly string[] },
        { name: 'update', positional: ['id'] as readonly string[], flags: ['--verbose'] as readonly string[] },
        { name: 'delete', positional: ['id'] as readonly string[], flags: ['--force'] as readonly string[] },
      ] as readonly { readonly name: string; readonly positional: readonly string[]; readonly flags: readonly string[] }[],
    })),
  );

/** Convert a concept name to a kebab-case CLI command name. */
const toCommandName = (concept: string): string =>
  concept.replace(/([A-Z])/g, '-$1').toLowerCase().replace(/^-/, '');

/** Build a subcommand name from concept and action. */
const toSubcommand = (conceptCmd: string, action: string): string =>
  `${conceptCmd} ${action.toLowerCase()}`;

// --- Implementation ---

export const cliTargetHandler: CliTargetHandler = {
  generate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const { concept, actions } = parseProjection(input.projection);
          const commandName = toCommandName(concept);
          const commands: string[] = [commandName];
          const subcommands: string[] = [];
          const files: string[] = [];

          for (const action of actions) {
            // Enforce positional argument limit
            if (action.positional.length > MAX_POSITIONAL_ARGS) {
              return generateTooManyPositional(action.name, action.positional.length);
            }

            const subcmd = toSubcommand(commandName, action.name);
            subcommands.push(subcmd);

            await storage.put('commands', subcmd, {
              concept,
              command: commandName,
              subcommand: subcmd,
              action: action.name,
              positional: [...action.positional],
              flags: [...action.flags],
            });
          }

          const fileName = `${commandName}.commands.ts`;
          files.push(fileName);

          await storage.put('files', fileName, {
            concept,
            commandName,
            subcommands: [...subcommands],
            fileName,
          });

          return generateOk(commands, files);
        },
        storageError,
      ),
    ),

  validate: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          // Find all subcommands under this command to detect flag collisions
          const allCommands = await storage.find('commands');
          const siblings = allCommands.filter(
            (r) => r['command'] === input.command,
          );

          // Build a map of flag -> actions that use it
          const flagToActions = new Map<string, string[]>();
          for (const cmd of siblings) {
            const action = cmd['action'] as string;
            const flags = (cmd['flags'] as readonly string[] | undefined) ?? [];
            for (const flag of flags) {
              const existing = flagToActions.get(flag) ?? [];
              existing.push(action);
              flagToActions.set(flag, existing);
            }
          }

          // A flag collision occurs when the same flag has different semantics across subcommands
          // For simplicity, we flag when a non-global flag (not --verbose, --format, --help)
          // appears in more than one action
          const globalFlags = new Set(['--verbose', '--format', '--help', '--version', '--quiet']);
          for (const [flag, actions] of flagToActions.entries()) {
            if (!globalFlags.has(flag) && actions.length > 1) {
              return validateFlagCollision(input.command, flag, actions);
            }
          }

          return validateOk(input.command);
        },
        storageError,
      ),
    ),

  listCommands: (input, storage) =>
    pipe(
      TE.tryCatch(
        async () => {
          const allCommands = await storage.find('commands', { concept: input.concept });
          const commandSet = new Set<string>();
          const subcommands: string[] = [];

          for (const record of allCommands) {
            const cmd = record['command'] as string | undefined;
            const subcmd = record['subcommand'] as string | undefined;
            if (cmd) commandSet.add(cmd);
            if (subcmd) subcommands.push(subcmd);
          }

          return listCommandsOk([...commandSet], subcommands);
        },
        storageError,
      ),
    ),
};
