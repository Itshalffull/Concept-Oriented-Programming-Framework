// @clef-handler style=functional
// ============================================================
// QualityGate Handler
//
// Define and evaluate quality threshold conditions that produce
// pass/fail decisions. Compose metric thresholds, finding limits,
// and custom conditions into named gates for deployment blocking,
// PR decoration, and quality trend tracking.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, merge, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_OPERATORS = ['lt', 'lte', 'gt', 'gte', 'eq'];

// ---------------------------------------------------------------------------
// Functional handler (pure StorageProgram construction)
// ---------------------------------------------------------------------------

const _handler: FunctionalConceptHandler = {

  // ---- register -----------------------------------------------------------
  register(_input: Record<string, unknown>): StorageProgram<Result> {
    return complete(createProgram(), 'ok', { name: 'QualityGate' });
  },

  // ---- define -------------------------------------------------------------
  define(input: Record<string, unknown>): StorageProgram<Result> {
    const name = input.name as string;
    const description = (input.description as string | undefined) ?? null;
    const conditions = (input.conditions as Array<Record<string, unknown>>) || [];

    // Validate operators
    for (const cond of conditions) {
      const op = cond.operator as string;
      if (!VALID_OPERATORS.includes(op)) {
        return complete(createProgram(), 'invalidCondition', {
          conditionId: cond.conditionId as string,
          message: `Invalid operator "${op}". Must be one of: ${VALID_OPERATORS.join(', ')}`,
        });
      }
    }

    let p = createProgram();
    p = find(p, 'gate', { name }, '_existing');

    return branch(p,
      (bindings) => {
        const existing = (bindings._existing || []) as unknown[];
        return existing.length > 0;
      },
      (b) => complete(b, 'duplicate', { name }),
      (b) => {
        const gateId = `gate-${name}-${Date.now()}`;
        let b2 = put(b, 'gate', gateId, {
          name, description, conditions,
          evaluations: [], overrides: [],
        });
        return complete(b2, 'ok', { gate: gateId });
      },
    );
  },

  // ---- evaluate ------------------------------------------------------------
  evaluate(input: Record<string, unknown>): StorageProgram<Result> {
    const gateId = input.gate as string;
    const _baseline = (input.baseline as string | undefined) ?? null;

    let p = createProgram();
    p = get(p, 'gate', gateId, '_gate');

    return branch(p,
      (bindings) => bindings._gate == null,
      (b) => complete(b, 'gateNotFound', { gate: gateId }),
      (b) => {
        // Compute evaluation results via mapBindings
        let b2 = mapBindings(b, (bindings) => {
          const gate = bindings._gate as Record<string, unknown>;
          const conditions = (gate.conditions || []) as Array<Record<string, unknown>>;
          const now = new Date().toISOString();

          const results: Array<{
            conditionId: string; actualValue: number;
            threshold: number; passed: boolean;
          }> = [];

          for (const cond of conditions) {
            const conditionId = cond.conditionId as string;
            const threshold = cond.threshold as number;
            const operator = cond.operator as string;
            // Stub: actualValue defaults to 0.0 -- real implementation
            // would query metric/finding stores
            const actualValue = 0.0;

            let passed = false;
            switch (operator) {
              case 'lt': passed = actualValue < threshold; break;
              case 'lte': passed = actualValue <= threshold; break;
              case 'gt': passed = actualValue > threshold; break;
              case 'gte': passed = actualValue >= threshold; break;
              case 'eq': passed = actualValue === threshold; break;
            }
            results.push({ conditionId, actualValue, threshold, passed });
          }

          const failures = results.filter(r => !r.passed);
          const passing = results.filter(r => r.passed);
          const allPassed = failures.length === 0;

          const evaluations = [...((gate.evaluations || []) as unknown[])];
          evaluations.push({ evaluatedAt: now, passed: allPassed, results });

          return { results, failures, passing, allPassed, evaluations };
        }, '_evalResult');

        b2 = merge(b2, 'gate', gateId, {});

        return branch(b2,
          (bindings) => {
            const evalResult = bindings._evalResult as Record<string, unknown>;
            return evalResult.allPassed as boolean;
          },
          (b3) => completeFrom(b3, 'passed', (bindings) => {
            const evalResult = bindings._evalResult as Record<string, unknown>;
            return { gate: gateId, results: evalResult.results };
          }),
          (b3) => completeFrom(b3, 'failed', (bindings) => {
            const evalResult = bindings._evalResult as Record<string, unknown>;
            return {
              gate: gateId,
              failures: evalResult.failures,
              passing: evalResult.passing,
            };
          }),
        );
      },
    );
  },

  // ---- override ------------------------------------------------------------
  override(input: Record<string, unknown>): StorageProgram<Result> {
    const gateId = input.gate as string;
    const reason = input.reason as string;
    const overriddenBy = input.overriddenBy as string;

    let p = createProgram();
    p = get(p, 'gate', gateId, '_gate');

    return branch(p,
      (bindings) => bindings._gate == null,
      (b) => complete(b, 'gateNotFound', { gate: gateId }),
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const gate = bindings._gate as Record<string, unknown>;
          const overrides = [...((gate.overrides || []) as unknown[])];
          overrides.push({
            reason, overriddenBy,
            overriddenAt: new Date().toISOString(),
          });
          return { ...gate, overrides };
        }, '_updated');
        b2 = merge(b2, 'gate', gateId, {});
        return complete(b2, 'ok', { gate: gateId });
      },
    );
  },

  // ---- trend ---------------------------------------------------------------
  trend(input: Record<string, unknown>): StorageProgram<Result> {
    const gateId = input.gate as string;
    const count = (input.count as number | undefined) ?? 20;

    let p = createProgram();
    p = get(p, 'gate', gateId, '_gate');

    return branch(p,
      (bindings) => bindings._gate == null,
      (b) => complete(b, 'gateNotFound', { gate: gateId }),
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const gate = bindings._gate as Record<string, unknown>;
          const evaluations = ((gate.evaluations || []) as Array<Record<string, unknown>>)
            .slice(-count)
            .map(e => ({
              evaluatedAt: e.evaluatedAt,
              passed: e.passed,
              failureCount: ((e.results || []) as Array<Record<string, unknown>>)
                .filter(r => !(r.passed as boolean)).length,
            }));
          return { evaluations };
        });
      },
    );
  },
};

// ---------------------------------------------------------------------------
// Export auto-interpreted handler
// ---------------------------------------------------------------------------

export const qualityGateHandler = autoInterpret(_handler);
export default qualityGateHandler;
