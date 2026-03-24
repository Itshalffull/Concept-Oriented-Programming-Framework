// @clef-handler style=functional
// ============================================================
// Rule Handler
//
// Define quality checks with evaluation criteria, severity,
// categorization, and remediation guidance. Rules are the atomic
// unit of quality policy -- each expresses one quality expectation
// independently. Providers perform actual code evaluation.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, merge, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ---------------------------------------------------------------------------
// Functional handler (pure StorageProgram construction)
// ---------------------------------------------------------------------------

const _handler: FunctionalConceptHandler = {

  // ---- register (framework concept lifecycle) ----------------------------
  register(_input: Record<string, unknown>): StorageProgram<Result> {
    return complete(createProgram(), 'ok', { name: 'Rule' });
  },

  // ---- define ------------------------------------------------------------
  define(input: Record<string, unknown>): StorageProgram<Result> {
    const ruleId = input.ruleId as string;
    const name = input.name as string;
    const description = input.description as string;
    const category = input.category as string;
    const severity = input.severity as string;
    const effort = (input.effort as string | undefined) ?? null;
    const tags = (input.tags as string[] | undefined) ?? [];
    const cleanCodeAttribute = (input.cleanCodeAttribute as string | undefined) ?? null;

    // Use ruleId as the storage key for direct lookup
    let p = createProgram();
    p = get(p, 'rule', ruleId, '_existing');

    return branch(p,
      (bindings) => bindings._existing != null,
      // Duplicate -- rule already registered
      (b) => complete(b, 'duplicate', { ruleId }),
      // Create new rule
      (b) => {
        let b2 = put(b, 'rule', ruleId, {
          ruleId,
          name,
          description,
          category,
          severity,
          effort,
          tags,
          enabled: true,
          cleanCodeAttribute,
          lastEvaluated: null,
          targetsChecked: null,
          violationsFound: null,
        });
        return complete(b2, 'ok', { rule: ruleId });
      },
    );
  },

  // ---- evaluate ----------------------------------------------------------
  evaluate(input: Record<string, unknown>): StorageProgram<Result> {
    const ruleId = input.ruleId as string;
    const targets = input.targets as string[];

    let p = createProgram();
    p = get(p, 'rule', ruleId, '_rule');

    return branch(p,
      (bindings) => bindings._rule == null,
      // Unknown rule
      (b) => complete(b, 'unknownRule', { ruleId }),
      // Rule exists -- check if enabled
      (b) => {
        return branch(b,
          (bindings) => {
            const rule = bindings._rule as Record<string, unknown>;
            return rule.enabled === false;
          },
          // Disabled
          (b2) => complete(b2, 'disabled', { ruleId }),
          // Enabled -- perform evaluation (stub: no violations by default)
          (b2) => {
            const now = new Date().toISOString();
            // Update evaluation stats using ruleId as key (known statically)
            let b3 = merge(b2, 'rule', ruleId, {
              lastEvaluated: now,
              targetsChecked: targets.length,
              violationsFound: 0,
            });

            return complete(b3, 'ok', {
              rule: ruleId,
              violations: [] as unknown[],
              clean: targets,
            });
          },
        );
      },
    );
  },

  // ---- enable ------------------------------------------------------------
  enable(input: Record<string, unknown>): StorageProgram<Result> {
    const ruleId = input.ruleId as string;

    let p = createProgram();
    p = get(p, 'rule', ruleId, '_rule');

    return branch(p,
      (bindings) => bindings._rule == null,
      // Unknown rule
      (b) => complete(b, 'unknownRule', { ruleId }),
      // Found
      (b) => {
        return branch(b,
          (bindings) => {
            const rule = bindings._rule as Record<string, unknown>;
            return rule.enabled === true;
          },
          // Already enabled
          (b2) => complete(b2, 'alreadyEnabled', { rule: ruleId }),
          // Enable it
          (b2) => {
            let b3 = merge(b2, 'rule', ruleId, { enabled: true });
            return complete(b3, 'ok', { rule: ruleId });
          },
        );
      },
    );
  },

  // ---- disable -----------------------------------------------------------
  disable(input: Record<string, unknown>): StorageProgram<Result> {
    const ruleId = input.ruleId as string;

    let p = createProgram();
    p = get(p, 'rule', ruleId, '_rule');

    return branch(p,
      (bindings) => bindings._rule == null,
      // Unknown rule
      (b) => complete(b, 'unknownRule', { ruleId }),
      // Found
      (b) => {
        return branch(b,
          (bindings) => {
            const rule = bindings._rule as Record<string, unknown>;
            return rule.enabled === false;
          },
          // Already disabled
          (b2) => complete(b2, 'alreadyDisabled', { rule: ruleId }),
          // Disable it
          (b2) => {
            let b3 = merge(b2, 'rule', ruleId, { enabled: false });
            return complete(b3, 'ok', { rule: ruleId });
          },
        );
      },
    );
  },

  // ---- list --------------------------------------------------------------
  list(input: Record<string, unknown>): StorageProgram<Result> {
    const category = (input.category as string | undefined) ?? null;
    const severity = (input.severity as string | undefined) ?? null;
    const tags = (input.tags as string[] | undefined) ?? null;

    let p = createProgram();
    p = find(p, 'rule', {}, '_allRules');

    p = mapBindings(p, (bindings) => {
      let rules = (bindings._allRules || []) as Record<string, unknown>[];

      if (category) {
        rules = rules.filter(r => r.category === category);
      }
      if (severity) {
        rules = rules.filter(r => r.severity === severity);
      }
      if (tags && tags.length > 0) {
        rules = rules.filter(r => {
          const ruleTags = (r.tags || []) as string[];
          return tags.some(t => ruleTags.includes(t));
        });
      }

      return rules.map(r => ({
        ruleId: r.ruleId,
        name: r.name,
        category: r.category,
        severity: r.severity,
        enabled: r.enabled,
        violationsFound: r.violationsFound ?? null,
      }));
    }, '_filtered');

    return completeFrom(p, 'ok', (bindings) => ({
      rules: bindings._filtered as unknown[],
    }));
  },
};

// ---------------------------------------------------------------------------
// Export auto-interpreted handler (works with both imperative and functional
// test harnesses)
// ---------------------------------------------------------------------------

export const ruleHandler = autoInterpret(_handler);
export default ruleHandler;
