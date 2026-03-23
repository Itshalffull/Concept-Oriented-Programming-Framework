// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Quorum Concept Handler
// Minimum participation threshold for decision validity.
import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const _quorumHandler: FunctionalConceptHandler = {
  setThreshold(input: Record<string, unknown>) {
    if (!input.thresholdType || (typeof input.thresholdType === 'string' && (input.thresholdType as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'thresholdType is required' }) as StorageProgram<Result>;
    }
    const id = `quorum-${Date.now()}`;
    const value = typeof input.value === 'string' ? parseFloat(input.value as string) : (input.value as number ?? 0);
    const thresholdType = input.thresholdType as string;
    let p = createProgram();
    p = put(p, 'quorum', id, {
      id,
      thresholdType,
      value,
      type: thresholdType,
      absoluteThreshold: thresholdType === 'Absolute' ? value : null,
      fractionalThreshold: thresholdType === 'Fractional' ? value : null,
      scope: input.scope,
    });
    return complete(p, 'ok', { id, rule: id, quorum: id }) as StorageProgram<Result>;
  },

  check(input: Record<string, unknown>) {
    // Support both field name styles
    const quorumId = (input.quorum ?? input.rule) as string;
    const totalVotes = typeof input.totalVotes === 'string' ? parseFloat(input.totalVotes as string)
      : (input.totalVotes ?? input.participation as number ?? 0);
    const totalEligible = typeof input.totalEligible === 'string' ? parseFloat(input.totalEligible as string)
      : (input.totalEligible ?? input.total as number ?? 1);

    let p = createProgram();

    if (quorumId) {
      p = get(p, 'quorum', quorumId, 'record');
      return branch(p, 'record',
        (b) => complete(b, 'ok', { totalVotes, totalEligible }),
        (b) => complete(b, 'not_found', { quorum: quorumId }),
      ) as StorageProgram<Result>;
    }

    // No quorum ID — find first rule and check
    p = find(p, 'quorum', {}, 'allRules');
    return branch(p,
      (bindings) => (bindings.allRules as unknown[]).length > 0,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rules = bindings.allRules as Array<Record<string, unknown>>;
        const rule = rules[0];
        const threshold = rule.thresholdType === 'Absolute'
          ? (rule.absoluteThreshold as number ?? rule.value as number)
          : (rule.fractionalThreshold as number ?? rule.value as number);
        let met = true;
        if (rule.thresholdType === 'Absolute') {
          met = totalVotes >= threshold;
        } else if (rule.thresholdType === 'Fractional') {
          met = totalEligible > 0 && (totalVotes / totalEligible) >= threshold;
        }
        return { totalVotes, totalEligible, met };
      }),
      (b) => complete(b, 'not_found', { message: 'no quorum rules configured' }),
    ) as StorageProgram<Result>;
  },

  updateThreshold(input: Record<string, unknown>) {
    const ruleId = (input.rule ?? input.quorum) as string;
    if (!ruleId || (typeof ruleId === 'string' && ruleId.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'rule is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    p = get(p, 'quorum', ruleId, 'record');

    return branch(p, 'record',
      (b) => {
        const newType = (input.newType ?? input.thresholdType) as string;
        const newValue = typeof (input.newValue ?? input.value) === 'string'
          ? parseFloat((input.newValue ?? input.value) as string)
          : ((input.newValue ?? input.value) as number ?? 0);
        let b2 = put(b, 'quorum', ruleId, {
          id: ruleId,
          thresholdType: newType,
          value: newValue,
          type: newType,
          absoluteThreshold: newType === 'Absolute' ? newValue : null,
          fractionalThreshold: newType === 'Fractional' ? newValue : null,
        });
        return complete(b2, 'ok', { rule: ruleId, quorum: ruleId });
      },
      (b) => complete(b, 'not_found', { rule: ruleId }),
    ) as StorageProgram<Result>;
  },
};

export const quorumHandler = autoInterpret(_quorumHandler);
