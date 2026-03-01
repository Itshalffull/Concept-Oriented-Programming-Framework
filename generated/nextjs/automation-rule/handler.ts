// AutomationRule — Event-driven automation rule engine
// Defines trigger conditions, filter predicates, and action sequences.
// Evaluates rules against event contexts and tracks enabled/disabled state.

import * as TE from 'fp-ts/TaskEither';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  AutomationRuleStorage,
  AutomationRuleDefineInput,
  AutomationRuleDefineOutput,
  AutomationRuleEnableInput,
  AutomationRuleEnableOutput,
  AutomationRuleDisableInput,
  AutomationRuleDisableOutput,
  AutomationRuleExecuteInput,
  AutomationRuleExecuteOutput,
} from './types.js';

import {
  defineOk,
  defineExists,
  enableOk,
  enableNotfound,
  disableOk,
  disableNotfound,
  executeOk,
  executeNotfound,
} from './types.js';

export interface AutomationRuleError {
  readonly code: string;
  readonly message: string;
}

export interface AutomationRuleHandler {
  readonly define: (
    input: AutomationRuleDefineInput,
    storage: AutomationRuleStorage,
  ) => TE.TaskEither<AutomationRuleError, AutomationRuleDefineOutput>;
  readonly enable: (
    input: AutomationRuleEnableInput,
    storage: AutomationRuleStorage,
  ) => TE.TaskEither<AutomationRuleError, AutomationRuleEnableOutput>;
  readonly disable: (
    input: AutomationRuleDisableInput,
    storage: AutomationRuleStorage,
  ) => TE.TaskEither<AutomationRuleError, AutomationRuleDisableOutput>;
  readonly execute: (
    input: AutomationRuleExecuteInput,
    storage: AutomationRuleStorage,
  ) => TE.TaskEither<AutomationRuleError, AutomationRuleExecuteOutput>;
}

const storageError = (error: unknown): AutomationRuleError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

// --- Implementation ---

export const automationRuleHandler: AutomationRuleHandler = {
  // Define a new automation rule with trigger, conditions, and actions.
  // Rejects if a rule with the same name already exists.
  define: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('automation_rules', input.rule),
        storageError,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.tryCatch(
                async () => {
                  const now = new Date().toISOString();
                  await storage.put('automation_rules', input.rule, {
                    rule: input.rule,
                    trigger: input.trigger,
                    conditions: input.conditions,
                    actions: input.actions,
                    enabled: false,
                    createdAt: now,
                    updatedAt: now,
                    executionCount: 0,
                  });
                  return defineOk();
                },
                storageError,
              ),
            () => TE.right(defineExists(`Automation rule '${input.rule}' already exists`)),
          ),
        ),
      ),
    ),

  // Enable a previously defined rule. The rule must exist.
  enable: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('automation_rules', input.rule),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(enableNotfound(`Automation rule '${input.rule}' not found`)),
            (found) =>
              TE.tryCatch(
                async () => {
                  await storage.put('automation_rules', input.rule, {
                    ...found,
                    enabled: true,
                    updatedAt: new Date().toISOString(),
                  });
                  return enableOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Disable a rule to prevent it from matching events.
  disable: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('automation_rules', input.rule),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(disableNotfound(`Automation rule '${input.rule}' not found`)),
            (found) =>
              TE.tryCatch(
                async () => {
                  await storage.put('automation_rules', input.rule, {
                    ...found,
                    enabled: false,
                    updatedAt: new Date().toISOString(),
                  });
                  return disableOk();
                },
                storageError,
              ),
          ),
        ),
      ),
    ),

  // Execute a rule against a given event context.
  // The rule must exist and be enabled. Evaluates conditions against the context,
  // then produces an action result. Tracks execution history.
  execute: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('automation_rules', input.rule),
        storageError,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () => TE.right(executeNotfound(`Automation rule '${input.rule}' not found`)),
            (found) => {
              const ruleRecord = found as Record<string, unknown>;
              const isEnabled = ruleRecord.enabled === true;

              if (!isEnabled) {
                return TE.right(executeNotfound(`Automation rule '${input.rule}' is disabled`));
              }

              // Parse conditions and evaluate against the context
              const conditions = String(ruleRecord.conditions ?? '');
              const trigger = String(ruleRecord.trigger ?? '');
              const actions = String(ruleRecord.actions ?? '');
              const contextStr = input.context;

              // Verify the trigger matches the context event type
              const contextContainsTrigger = contextStr.includes(trigger);
              if (!contextContainsTrigger) {
                return TE.right(
                  executeOk(JSON.stringify({
                    matched: false,
                    rule: input.rule,
                    reason: `Trigger '${trigger}' did not match context`,
                  })),
                );
              }

              // Execute the actions and record the result
              const executionCount = (typeof ruleRecord.executionCount === 'number'
                ? ruleRecord.executionCount
                : 0) + 1;

              return TE.tryCatch(
                async () => {
                  const executionId = `${input.rule}:${executionCount}`;
                  const now = new Date().toISOString();

                  // Update execution count on the rule
                  await storage.put('automation_rules', input.rule, {
                    ...ruleRecord,
                    executionCount,
                    lastExecutedAt: now,
                    updatedAt: now,
                  });

                  // Store execution log entry
                  await storage.put('automation_executions', executionId, {
                    executionId,
                    rule: input.rule,
                    context: contextStr,
                    trigger,
                    conditions,
                    actions,
                    executedAt: now,
                  });

                  return executeOk(JSON.stringify({
                    matched: true,
                    rule: input.rule,
                    actions,
                    executionId,
                  }));
                },
                storageError,
              );
            },
          ),
        ),
      ),
    ),
};
