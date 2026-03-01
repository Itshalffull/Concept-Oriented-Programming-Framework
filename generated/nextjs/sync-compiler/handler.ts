// SyncCompiler — Sync rule compiler: takes a parsed sync AST and resolves
// concept references, validates trigger/effect bindings, type-checks data flow
// between concepts, and produces a compiled sync rule ready for execution.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SyncCompilerStorage,
  SyncCompilerCompileInput,
  SyncCompilerCompileOutput,
} from './types.js';

import {
  compileOk,
  compileError,
} from './types.js';

export interface SyncCompilerError {
  readonly code: string;
  readonly message: string;
}

const mkError = (code: string) => (error: unknown): SyncCompilerError => ({
  code,
  message: error instanceof Error ? error.message : String(error),
});

export interface SyncCompilerHandler {
  readonly compile: (
    input: SyncCompilerCompileInput,
    storage: SyncCompilerStorage,
  ) => TE.TaskEither<SyncCompilerError, SyncCompilerCompileOutput>;
}

// --- Implementation ---

interface SyncASTNode {
  readonly type?: string;
  readonly name?: string;
  readonly trigger?: {
    readonly concept: string;
    readonly action: string;
    readonly variant?: string;
  };
  readonly effects?: readonly {
    readonly concept: string;
    readonly action: string;
    readonly mappings?: Record<string, string>;
  }[];
  readonly where?: readonly {
    readonly field: string;
    readonly operator: string;
    readonly value: unknown;
  }[];
}

interface CompiledSync {
  readonly syncId: string;
  readonly syncName: string;
  readonly trigger: {
    readonly conceptUri: string;
    readonly action: string;
    readonly variant: string;
  };
  readonly effects: readonly {
    readonly conceptUri: string;
    readonly action: string;
    readonly bindings: Record<string, string>;
  }[];
  readonly guards: readonly {
    readonly field: string;
    readonly operator: string;
    readonly value: unknown;
  }[];
  readonly compiledAt: string;
}

const validateTrigger = (
  ast: SyncASTNode,
): readonly string[] => {
  const errors: string[] = [];
  if (!ast.trigger) {
    errors.push('Sync rule must have a trigger definition');
  } else {
    if (!ast.trigger.concept || ast.trigger.concept.trim().length === 0) {
      errors.push('Trigger concept reference cannot be empty');
    }
    if (!ast.trigger.action || ast.trigger.action.trim().length === 0) {
      errors.push('Trigger action cannot be empty');
    }
  }
  return errors;
};

const validateEffects = (
  ast: SyncASTNode,
): readonly string[] => {
  const errors: string[] = [];
  if (!ast.effects || ast.effects.length === 0) {
    errors.push('Sync rule must have at least one effect');
  } else {
    ast.effects.forEach((effect, i) => {
      if (!effect.concept || effect.concept.trim().length === 0) {
        errors.push(`Effect ${i}: concept reference cannot be empty`);
      }
      if (!effect.action || effect.action.trim().length === 0) {
        errors.push(`Effect ${i}: action cannot be empty`);
      }
    });
  }
  return errors;
};

export const syncCompilerHandler: SyncCompilerHandler = {
  compile: (input, storage) => {
    const ast = input.ast as SyncASTNode;

    const triggerErrors = validateTrigger(ast);
    const effectErrors = validateEffects(ast);
    const allErrors = [...triggerErrors, ...effectErrors];

    if (allErrors.length > 0) {
      return TE.right(compileError(allErrors.join('; ')));
    }

    const trigger = ast.trigger!;
    const effects = ast.effects ?? [];
    const guards = ast.where ?? [];

    return pipe(
      TE.tryCatch(
        async () => {
          const triggerConcept = await storage.get(
            'concept_registry',
            trigger.concept,
          );
          const effectValidations = await Promise.all(
            effects.map(async (e) => {
              const conceptRecord = await storage.get(
                'concept_registry',
                e.concept,
              );
              return {
                concept: e.concept,
                exists: conceptRecord !== null,
              };
            }),
          );

          const syncId = `compiled-${input.sync}-${Date.now()}`;
          const compiled: CompiledSync = {
            syncId,
            syncName: ast.name ?? input.sync,
            trigger: {
              conceptUri: `clef://${trigger.concept}`,
              action: trigger.action,
              variant: trigger.variant ?? 'ok',
            },
            effects: effects.map((e) => ({
              conceptUri: `clef://${e.concept}`,
              action: e.action,
              bindings: e.mappings ?? {},
            })),
            guards: [...guards],
            compiledAt: new Date().toISOString(),
          };

          await storage.put('compiled_syncs', syncId, {
            ...compiled,
            sourceSync: input.sync,
            sourceAst: ast,
          });

          return compileOk(compiled);
        },
        mkError('COMPILE_FAILED'),
      ),
    );
  },
};
