// @migrated dsl-constructs 2026-03-18
// AutomationRule Concept Implementation
// User-configurable event-condition-action rules that fire automatically when conditions are met.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _automationRuleHandler: FunctionalConceptHandler = {
  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'automationRule', {}, 'items');
    return complete(p, 'ok', { items: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  define(input: Record<string, unknown>) {
    const rule = input.rule as string;
    const trigger = input.trigger as string;
    const conditions = input.conditions as string;
    const actions = input.actions as string;

    let p = createProgram();
    p = spGet(p, 'automationRule', rule, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'A rule with this identity already exists' }),
      (b) => {
        let b2 = put(b, 'automationRule', rule, {
          rule,
          trigger,
          conditions,
          actions,
          enabled: false,
        });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  enable(input: Record<string, unknown>) {
    const rule = input.rule as string;

    let p = createProgram();
    p = spGet(p, 'automationRule', rule, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'automationRule', rule, { enabled: true });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'The rule was not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  disable(input: Record<string, unknown>) {
    const rule = input.rule as string;

    let p = createProgram();
    p = spGet(p, 'automationRule', rule, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'automationRule', rule, { enabled: false });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'The rule was not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  evaluate(input: Record<string, unknown>) {
    const rule = input.rule as string;
    const event = input.event as string;

    let p = createProgram();
    p = spGet(p, 'automationRule', rule, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Trigger matching and condition evaluation resolved at runtime from bindings
        return complete(b, 'ok', { matched: false });
      },
      (b) => complete(b, 'notfound', { message: 'The rule was not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  execute(input: Record<string, unknown>) {
    const rule = input.rule as string;
    const context = input.context as string;

    let p = createProgram();
    p = spGet(p, 'automationRule', rule, 'existing');
    p = branch(p, 'existing',
      (b) => {
        // Action execution resolved at runtime
        return complete(b, 'ok', { result: '' });
      },
      (b) => complete(b, 'notfound', { message: 'The rule was not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const automationRuleHandler = autoInterpret(_automationRuleHandler);

