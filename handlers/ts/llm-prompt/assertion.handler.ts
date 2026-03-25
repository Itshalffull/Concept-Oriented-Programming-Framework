// @clef-handler style=functional
// Assertion Concept Implementation
// Computational constraints embedded in the LLM execution lifecycle.
// Hard assertions halt the pipeline on max retries; soft suggestions log and continue.
import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;

function nextId(): string {
  return `assertion-${++idCounter}`;
}

const VALID_SEVERITIES = new Set(['hard', 'soft']);

/**
 * Evaluate a constraint predicate string against an output string.
 * Supports a minimal expression language:
 *   output.is_valid_json         — output is valid JSON
 *   output.length > N            — character length comparison
 *   output.contains_no_pii      — no email-like or SSN-like patterns
 *   output.matches_schema(...)   — treated as always true (schema validation delegated)
 *   true / false                 — literal boolean
 */
function evaluateConstraint(constraint: string, output: string): boolean {
  const expr = constraint.trim();

  if (expr === 'true') return true;
  if (expr === 'false') return false;

  if (expr === 'output.is_valid_json') {
    try { JSON.parse(output); return true; } catch { return false; }
  }

  if (expr === 'output.contains_no_pii') {
    const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
    const ssnPattern = /\d{3}-\d{2}-\d{4}/;
    return !emailPattern.test(output) && !ssnPattern.test(output);
  }

  // output.length > N  or  output.length < N  or  output.length >= N  etc.
  const lengthMatch = expr.match(/^output\.length\s*(>|<|>=|<=|==|!=)\s*(\d+)$/);
  if (lengthMatch) {
    const op = lengthMatch[1];
    const n = parseInt(lengthMatch[2], 10);
    const len = output.length;
    switch (op) {
      case '>':  return len > n;
      case '<':  return len < n;
      case '>=': return len >= n;
      case '<=': return len <= n;
      case '==': return len === n;
      case '!=': return len !== n;
    }
  }

  // output.matches_schema(...) — delegate to downstream; treat as pass for now
  if (expr.startsWith('output.matches_schema(')) return true;

  // Unknown constraint — treat as invalid (but we already validated on define)
  return false;
}

/** Check whether a constraint expression is syntactically recognizable. */
function isValidConstraint(constraint: string): boolean {
  const expr = constraint.trim();
  if (expr === 'true' || expr === 'false') return true;
  if (expr === 'output.is_valid_json') return true;
  if (expr === 'output.contains_no_pii') return true;
  if (/^output\.length\s*(>|<|>=|<=|==|!=)\s*\d+$/.test(expr)) return true;
  if (/^output\.matches_schema\(.*\)$/.test(expr)) return true;
  return false;
}

const _handler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Assertion' }) as StorageProgram<Result>;
  },

  define(input: Record<string, unknown>) {
    const name = input.name as string;
    const constraint = input.constraint as string;
    const severity = input.severity as string;
    const errorMessage = input.error_message as string;
    const maxRetries = input.max_retries as number;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!constraint || constraint.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'constraint is required' }) as StorageProgram<Result>;
    }
    if (!isValidConstraint(constraint)) {
      return complete(createProgram(), 'invalid', { message: `Invalid constraint expression: ${constraint}` }) as StorageProgram<Result>;
    }
    if (!severity || !VALID_SEVERITIES.has(severity)) {
      return complete(createProgram(), 'invalid', { message: `severity must be 'hard' or 'soft'` }) as StorageProgram<Result>;
    }

    const id = nextId();
    let p = createProgram();
    p = put(p, 'assertion', id, {
      id,
      name,
      constraint,
      severity,
      error_message: errorMessage || `Assertion '${name}' failed`,
      max_retries: maxRetries ?? 3,
      retry_count: 0,
      attached_to: null,
      createdAt: new Date().toISOString(),
    });

    return complete(p, 'ok', { assertion: id }) as StorageProgram<Result>;
  },

  attach(input: Record<string, unknown>) {
    const assertion = input.assertion as string;
    const target = input.target as string;

    if (!assertion || assertion.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'assertion is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'assertion', assertion, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Assertion not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'assertion', assertion, 'rec');
        b = putFrom(b, 'assertion', assertion, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          return { ...rec, attached_to: target };
        });
        return complete(b, 'ok', { assertion });
      })(),
    ) as StorageProgram<Result>;
  },

  evaluate(input: Record<string, unknown>) {
    const assertion = input.assertion as string;
    const output = input.output as string;

    if (!assertion || assertion.trim() === '') {
      return complete(createProgram(), 'halt', {
        message: 'assertion is required',
        attempts: 0,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'assertion', assertion, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'halt', { message: 'Assertion not found', attempts: 0 }),
      (() => {
        let b = createProgram();
        b = get(b, 'assertion', assertion, 'rec');
        b = mapBindings(b, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          const constraint = rec.constraint as string;
          return evaluateConstraint(constraint, output ?? '');
        }, '_passed');

        return branch(b,
          (bindings) => bindings._passed as boolean,
          // Constraint passed — reset retry_count
          (() => {
            let c = createProgram();
            c = get(c, 'assertion', assertion, 'recPass');
            c = putFrom(c, 'assertion', assertion, (bindings) => {
              const rec = bindings.recPass as Record<string, unknown>;
              return { ...rec, retry_count: 0 };
            });
            return complete(c, 'pass', {});
          })(),
          // Constraint failed — increment retry_count and check limits
          (() => {
            let c = createProgram();
            c = get(c, 'assertion', assertion, 'recFail');
            c = putFrom(c, 'assertion', assertion, (bindings) => {
              const rec = bindings.recFail as Record<string, unknown>;
              const retryCount = (rec.retry_count as number) + 1;
              return { ...rec, retry_count: retryCount };
            });
            c = get(c, 'assertion', assertion, 'recUpdated');
            c = mapBindings(c, (bindings) => {
              const rec = bindings.recUpdated as Record<string, unknown>;
              const retryCount = rec.retry_count as number;
              const maxRetries = rec.max_retries as number;
              const severity = rec.severity as string;
              if (retryCount > maxRetries) {
                return severity === 'hard' ? 'halt' : 'warn';
              }
              return 'fail';
            }, '_outcome');

            return branch(c,
              (bindings) => bindings._outcome === 'halt',
              (() => {
                let d = createProgram();
                d = get(d, 'assertion', assertion, 'recHalt');
                return completeFrom(d, 'halt', (bindings) => {
                  const rec = bindings.recHalt as Record<string, unknown>;
                  return {
                    message: `Hard assertion '${rec.name}' exceeded max retries: ${rec.error_message}`,
                    attempts: rec.retry_count as number,
                  };
                });
              })(),
              branch(c,
                (bindings) => bindings._outcome === 'warn',
                (() => {
                  let d = createProgram();
                  d = get(d, 'assertion', assertion, 'recWarn');
                  return completeFrom(d, 'warn', (bindings) => {
                    const rec = bindings.recWarn as Record<string, unknown>;
                    return {
                      message: `Soft assertion '${rec.name}' exceeded max retries: ${rec.error_message}`,
                      attempts: rec.retry_count as number,
                    };
                  });
                })(),
                (() => {
                  let d = createProgram();
                  d = get(d, 'assertion', assertion, 'recRetry');
                  return completeFrom(d, 'fail', (bindings) => {
                    const rec = bindings.recRetry as Record<string, unknown>;
                    const retryPrompt = `Previous output failed assertion '${rec.name}':\n` +
                      `Output: ${output}\n` +
                      `Error: ${rec.error_message}\n` +
                      `Please correct and retry.`;
                    return {
                      retry_prompt: retryPrompt,
                      attempt: rec.retry_count as number,
                      max: rec.max_retries as number,
                    };
                  });
                })(),
              ),
            );
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  reset(input: Record<string, unknown>) {
    const assertion = input.assertion as string;

    if (!assertion || assertion.trim() === '') {
      return complete(createProgram(), 'notfound', { message: 'assertion is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'assertion', assertion, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Assertion not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'assertion', assertion, 'rec');
        b = putFrom(b, 'assertion', assertion, (bindings) => {
          const rec = bindings.rec as Record<string, unknown>;
          return { ...rec, retry_count: 0 };
        });
        return complete(b, 'ok', { assertion });
      })(),
    ) as StorageProgram<Result>;
  },
};

export const assertionHandler = autoInterpret(_handler);

/** Reset internal state. Useful for testing. */
export function resetAssertion(): void {
  idCounter = 0;
}
