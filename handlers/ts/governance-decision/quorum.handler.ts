// @clef-handler style=functional
// Quorum Concept Implementation
// Ensures minimum participation before a governance decision is valid.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const ACTIVE_RULE_KEY = 'active-quorum-rule';

let idCounter = 0;
function nextId(): string {
  return `quorum-${++idCounter}`;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Quorum' }) as StorageProgram<Result>;
  },

  setThreshold(input: Record<string, unknown>) {
    const thresholdType = input.thresholdType as string;
    const value = input.value as number;

    if (!thresholdType || thresholdType.trim() === '') {
      return complete(createProgram(), 'error', { message: 'thresholdType is required' }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'quorum_rule', id, { id, thresholdType, thresholdValue: value });
    p = put(p, 'quorum_rule', ACTIVE_RULE_KEY, { id, thresholdType, thresholdValue: value });
    return complete(p, 'ok', { rule: id }) as StorageProgram<Result>;
  },

  check(input: Record<string, unknown>) {
    const totalVotes = input.totalVotes as number;
    const totalEligible = input.totalEligible as number;

    let p = createProgram();
    p = get(p, 'quorum_rule', ACTIVE_RULE_KEY, 'activeRule');

    return branch(
      p,
      (b) => !b.activeRule,
      complete(createProgram(), 'error', { message: 'No quorum rule configured' }),
      (() => {
        let b2 = createProgram();
        b2 = mapBindings(b2, (b) => {
          const rule = b.activeRule as Record<string, unknown>;
          const type = rule.thresholdType as string;
          const val = rule.thresholdValue as number;
          if (type === 'Absolute') return val;
          if (type === 'Fractional') return Math.ceil(totalEligible * val);
          return 0;
        }, '_required');
        return branch(
          b2,
          (b) => totalVotes >= (b._required as number),
          completeFrom(createProgram(), 'ok', (b) => ({ totalVotes, required: b._required as number })),
          completeFrom(createProgram(), 'ok', (b) => ({
            totalVotes,
            required: b._required as number,
            shortfall: (b._required as number) - totalVotes,
          })),
        ) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  updateThreshold(input: Record<string, unknown>) {
    const ruleId = input.rule as string;
    const newType = input.newType as string;
    const newValue = input.newValue as number;

    if (!ruleId) {
      return complete(createProgram(), 'error', { message: 'rule is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'quorum_rule', ruleId, 'ruleRecord');

    return branch(
      p,
      (b) => !b.ruleRecord,
      complete(createProgram(), 'not_found', { rule: ruleId }),
      (() => {
        let b2 = createProgram();
        b2 = put(b2, 'quorum_rule', ruleId, { id: ruleId, thresholdType: newType, thresholdValue: newValue });
        return complete(b2, 'ok', { rule: ruleId }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },
};

export const quorumHandler = autoInterpret(_handler);
