// @migrated dsl-constructs 2026-03-18
// CloudFormationProvider Concept Implementation
// AWS CloudFormation IaC provider. Generates CloudFormation templates,
// manages change sets, applies stacks, and handles teardown.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, del, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const RELATION = 'cfn';

const _cloudFormationProviderHandler: FunctionalConceptHandler = {
  generate(input: Record<string, unknown>) {
    const plan = input.plan as string;
    const requiredCapabilities = input.requiredCapabilities as string[] | undefined;

    const stackId = `stack-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const files = ['template.yaml', 'parameters.json'];

    let p = createProgram();
    p = put(p, RELATION, stackId, {
      stack: stackId,
      plan,
      requiredCapabilities: requiredCapabilities ? JSON.stringify(requiredCapabilities) : '',
      status: 'generated',
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { stack: stackId, files }) as StorageProgram<Result>;
  },

  preview(input: Record<string, unknown>) {
    const stack = input.stack as string;

    let p = createProgram();
    p = get(p, RELATION, stack, 'record');

    return branch(p, 'record',
      (thenP) => {
        const changeSetId = `cs-${Date.now()}`;
        return complete(thenP, 'ok', {
          stack,
          changeSetId,
          toCreate: 0,
          toUpdate: 0,
          toDelete: 0,
        });
      },
      (elseP) => complete(elseP, 'changeSetEmpty', { stack }),
    ) as StorageProgram<Result>;
  },

  apply(input: Record<string, unknown>) {
    const stack = input.stack as string;
    const capabilities = input.capabilities as string[] | undefined;

    let p = createProgram();
    p = get(p, RELATION, stack, 'record');

    return branch(p, 'record',
      (thenP) => {
        // Check capabilities
        thenP = mapBindings(thenP, (bindings) => {
          const record = bindings.record as Record<string, unknown>;
          const requiredCapabilities = record.requiredCapabilities
            ? JSON.parse(record.requiredCapabilities as string) as string[]
            : [];
          if (requiredCapabilities.length > 0 && (!capabilities || !requiredCapabilities.every((c: string) => capabilities.includes(c)))) {
            return requiredCapabilities;
          }
          return null;
        }, 'missingCaps');

        return branch(thenP,
          (bindings) => bindings.missingCaps !== null,
          (capFailP) => completeFrom(capFailP, 'insufficientCapabilities', (bindings) => ({
            stack,
            required: bindings.missingCaps as string[],
          })),
          (capOkP) => {
            const stackArn = `arn:aws:cloudformation:us-east-1:123456789:stack/${stack}`;
            capOkP = putFrom(capOkP, RELATION, stack, (bindings) => {
              const record = bindings.record as Record<string, unknown>;
              return {
                ...record,
                stackId: stackArn,
                status: 'applied',
                appliedAt: new Date().toISOString(),
              };
            });
            return complete(capOkP, 'ok', { stack, stackId: stackArn, created: [], updated: [] });
          },
        );
      },
      (elseP) => complete(elseP, 'rollbackComplete', { stack, reason: 'Stack not found' }),
    ) as StorageProgram<Result>;
  },

  teardown(input: Record<string, unknown>) {
    const stack = input.stack as string;

    let p = createProgram();
    p = get(p, RELATION, stack, 'record');

    return branch(p, 'record',
      (thenP) => {
        thenP = del(thenP, RELATION, stack);
        return complete(thenP, 'ok', { stack, destroyed: [stack] });
      },
      (elseP) => complete(elseP, 'ok', { stack, destroyed: [] }),
    ) as StorageProgram<Result>;
  },
};

export const cloudFormationProviderHandler = autoInterpret(_cloudFormationProviderHandler);
