// @clef-handler style=functional
// ============================================================
// Guardrail Concept Implementation
//
// Safety enforcement layer that validates LLM inputs and outputs
// against configurable rules. Supports content filtering (toxicity,
// PII, prompt injection), topic restrictions, format validation,
// and custom predicate checks. Idempotent safety checks that never
// modify content -- they only pass, flag, or block.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, find, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_TYPES = [
  'content_filter', 'topic_restriction', 'pii_detection',
  'prompt_injection', 'format_validation', 'custom_predicate',
];

const VALID_ACTIONS = ['block', 'warn', 'redact', 'escalate'];
const VALID_SEVERITIES = ['critical', 'high', 'medium', 'low'];

let _guardrailCounter = 0;
function generateGuardrailId(): string {
  return `guard-${Date.now()}-${++_guardrailCounter}`;
}

let _ruleCounter = 0;
function generateRuleId(): string {
  return `rule-${Date.now()}-${++_ruleCounter}`;
}

/**
 * Check content against a rule pattern. Stub implementation.
 * Production would use NLP models, regex engines, or external APIs.
 */
function checkPattern(content: string, pattern: string): boolean {
  try {
    const regex = new RegExp(pattern, 'i');
    return regex.test(content);
  } catch {
    return content.toLowerCase().includes(pattern.toLowerCase());
  }
}

const _guardrailHandler: FunctionalConceptHandler = {
  create(input: Record<string, unknown>) {
    const name = input.name as string;
    const guardrailType = input.guardrail_type as string;
    const config = input.config as {
      threshold: number;
      action_on_violation: string;
      categories: string[];
    };

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!VALID_TYPES.includes(guardrailType)) {
      return complete(createProgram(), 'invalid', { message: `Unknown type: ${guardrailType}` }) as StorageProgram<Result>;
    }
    if (!VALID_ACTIONS.includes(config.action_on_violation)) {
      return complete(createProgram(), 'invalid', { message: `Invalid action_on_violation: ${config.action_on_violation}` }) as StorageProgram<Result>;
    }

    const id = generateGuardrailId();
    let p = createProgram();
    p = put(p, 'guardrails', id, {
      id,
      name,
      guardrail_type: guardrailType,
      config,
      rules: [],
      violation_log: [],
    });

    return complete(p, 'ok', { guardrail: id }) as StorageProgram<Result>;
  },

  addRule(input: Record<string, unknown>) {
    const guardrailId = input.guardrail as string;
    const pattern = input.pattern as string;
    const severity = input.severity as string;

    let p = createProgram();
    p = get(p, 'guardrails', guardrailId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Guardrail not found' }),
      (() => {
        const ruleId = generateRuleId();
        let b = createProgram();
        b = get(b, 'guardrails', guardrailId, 'existing');
        b = putFrom(b, 'guardrails', guardrailId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const rules = [...(existing.rules as { id: string; pattern: string; severity: string }[])];
          rules.push({ id: ruleId, pattern, severity });
          return { ...existing, rules };
        });
        return complete(b, 'ok', { rule_id: ruleId });
      })(),
    ) as StorageProgram<Result>;
  },

  checkInput(input: Record<string, unknown>) {
    const guardrailId = input.guardrail as string;
    const message = input.message as string;

    let p = createProgram();
    p = get(p, 'guardrails', guardrailId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'violation', {
        rule_id: 'unknown', severity: 'high',
        explanation: 'Guardrail not found', action: 'block',
      }),
      (() => {
        let b = createProgram();
        b = get(b, 'guardrails', guardrailId, 'existing');
        b = mapBindings(b, (bindings) => {
          const guard = bindings.existing as Record<string, unknown>;
          const rules = guard.rules as { id: string; pattern: string; severity: string }[];
          const config = guard.config as { threshold: number; action_on_violation: string };

          for (const rule of rules) {
            if (checkPattern(message, rule.pattern)) {
              return {
                violated: true,
                rule_id: rule.id,
                severity: rule.severity,
                explanation: `Input matches rule pattern: ${rule.pattern}`,
                action: config.action_on_violation,
              };
            }
          }
          return { violated: false };
        }, 'checkResult');

        return branch(b,
          (bindings) => (bindings.checkResult as Record<string, unknown>).violated === true,
          (() => {
            let v = createProgram();
            v = get(v, 'guardrails', guardrailId, 'existing');
            v = mapBindings(v, (bindings) => {
              const guard = bindings.existing as Record<string, unknown>;
              const rules = guard.rules as { id: string; pattern: string; severity: string }[];
              const config = guard.config as { threshold: number; action_on_violation: string };
              for (const rule of rules) {
                if (checkPattern(message, rule.pattern)) {
                  return { rule_id: rule.id, severity: rule.severity, action: config.action_on_violation };
                }
              }
              return { rule_id: 'unknown', severity: 'medium', action: 'warn' };
            }, 'violationInfo');

            // Log violation
            v = putFrom(v, 'guardrails', guardrailId, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              const info = bindings.violationInfo as Record<string, unknown>;
              const log = [...(existing.violation_log as unknown[])];
              log.push({
                timestamp: new Date().toISOString(),
                input_hash: message.slice(0, 32),
                rule_id: info.rule_id,
                severity: info.severity,
                action_taken: info.action,
              });
              return { ...existing, violation_log: log };
            });

            return completeFrom(v, 'violation', (bindings) => {
              const info = bindings.violationInfo as Record<string, unknown>;
              return {
                rule_id: info.rule_id as string,
                severity: info.severity as string,
                explanation: `Input violates rule: ${info.rule_id}`,
                action: info.action as string,
              };
            });
          })(),
          complete(createProgram(), 'pass', {}),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  checkOutput(input: Record<string, unknown>) {
    const guardrailId = input.guardrail as string;
    const response = input.response as string;

    // Reuse same logic as checkInput but for output direction
    let p = createProgram();
    p = get(p, 'guardrails', guardrailId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'violation', {
        rule_id: 'unknown', severity: 'high',
        explanation: 'Guardrail not found', action: 'block',
      }),
      (() => {
        let b = createProgram();
        b = get(b, 'guardrails', guardrailId, 'existing');
        b = mapBindings(b, (bindings) => {
          const guard = bindings.existing as Record<string, unknown>;
          const rules = guard.rules as { id: string; pattern: string; severity: string }[];
          const config = guard.config as { threshold: number; action_on_violation: string };

          for (const rule of rules) {
            if (checkPattern(response, rule.pattern)) {
              return {
                violated: true, rule_id: rule.id, severity: rule.severity,
                explanation: `Output matches rule: ${rule.pattern}`,
                action: config.action_on_violation,
              };
            }
          }
          return { violated: false };
        }, 'checkResult');

        return branch(b,
          (bindings) => (bindings.checkResult as Record<string, unknown>).violated === true,
          (() => {
            let v = createProgram();
            v = get(v, 'guardrails', guardrailId, 'existing');
            v = mapBindings(v, (bindings) => {
              const guard = bindings.existing as Record<string, unknown>;
              const rules = guard.rules as { id: string; pattern: string; severity: string }[];
              const config = guard.config as { threshold: number; action_on_violation: string };
              for (const rule of rules) {
                if (checkPattern(response, rule.pattern)) {
                  return { rule_id: rule.id, severity: rule.severity, action: config.action_on_violation };
                }
              }
              return { rule_id: 'unknown', severity: 'medium', action: 'warn' };
            }, 'violationInfo');

            return completeFrom(v, 'violation', (bindings) => {
              const info = bindings.violationInfo as Record<string, unknown>;
              return {
                rule_id: info.rule_id as string, severity: info.severity as string,
                explanation: `Output violates rule: ${info.rule_id}`,
                action: info.action as string,
              };
            });
          })(),
          complete(createProgram(), 'pass', {}),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  check(input: Record<string, unknown>) {
    const guardrailId = input.guardrail as string;
    const content = input.content as string;
    const direction = input.direction as string;

    let p = createProgram();
    p = get(p, 'guardrails', guardrailId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'blocked', { rule_id: 'unknown', message: 'Guardrail not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'guardrails', guardrailId, 'existing');
        b = mapBindings(b, (bindings) => {
          const guard = bindings.existing as Record<string, unknown>;
          const rules = guard.rules as { id: string; pattern: string; severity: string }[];
          const config = guard.config as { threshold: number; action_on_violation: string };

          for (const rule of rules) {
            if (checkPattern(content, rule.pattern)) {
              return {
                matched: true, rule_id: rule.id, severity: rule.severity,
                action: config.action_on_violation,
              };
            }
          }
          return { matched: false };
        }, 'checkResult');

        return branch(b,
          (bindings) => (bindings.checkResult as Record<string, unknown>).matched === true,
          (() => {
            let m = createProgram();
            m = get(m, 'guardrails', guardrailId, 'existing');
            m = mapBindings(m, (bindings) => {
              const guard = bindings.existing as Record<string, unknown>;
              const rules = guard.rules as { id: string; pattern: string; severity: string }[];
              const config = guard.config as { threshold: number; action_on_violation: string };
              for (const rule of rules) {
                if (checkPattern(content, rule.pattern)) {
                  return { rule_id: rule.id, severity: rule.severity, action: config.action_on_violation };
                }
              }
              return { rule_id: 'unknown', severity: 'medium', action: 'warn' };
            }, 'matchInfo');

            return branch(m,
              (bindings) => (bindings.matchInfo as Record<string, unknown>).action === 'block',
              completeFrom(createProgram(), 'blocked', (bindings) => {
                const info = bindings.matchInfo as Record<string, unknown>;
                return { rule_id: info.rule_id as string, message: `Content blocked by rule ${info.rule_id}` };
              }),
              completeFrom(createProgram(), 'flagged', (bindings) => {
                const info = bindings.matchInfo as Record<string, unknown>;
                return {
                  rule_id: info.rule_id as string,
                  message: `Content flagged by rule ${info.rule_id}`,
                  severity: info.severity as string,
                };
              }),
            );
          })(),
          complete(createProgram(), 'pass', {}),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  getViolations(input: Record<string, unknown>) {
    const guardrailId = input.guardrail as string;
    const filters = (input.filters as { after?: string; severity?: string } | null) ?? null;

    let p = createProgram();
    p = get(p, 'guardrails', guardrailId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'empty', { message: 'No violations found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'guardrails', guardrailId, 'existing');
        b = mapBindings(b, (bindings) => {
          const guard = bindings.existing as Record<string, unknown>;
          let violations = guard.violation_log as Record<string, unknown>[];

          if (filters) {
            if (filters.after) {
              violations = violations.filter(v => (v.timestamp as string) > filters.after!);
            }
            if (filters.severity) {
              violations = violations.filter(v => v.severity === filters.severity);
            }
          }

          return violations;
        }, 'filtered');

        return branch(b,
          (bindings) => (bindings.filtered as unknown[]).length === 0,
          complete(createProgram(), 'empty', { message: 'No violations found' }),
          completeFrom(createProgram(), 'ok', (bindings) => ({
            violations: bindings.filtered as unknown[],
          })),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  removeRule(input: Record<string, unknown>) {
    const guardrailId = input.guardrail as string;
    const ruleId = input.rule_id as string;

    let p = createProgram();
    p = get(p, 'guardrails', guardrailId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Rule not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'guardrails', guardrailId, 'existing');
        b = mapBindings(b, (bindings) => {
          const guard = bindings.existing as Record<string, unknown>;
          const rules = guard.rules as { id: string }[];
          return rules.some(r => r.id === ruleId);
        }, 'ruleExists');

        return branch(b,
          (bindings) => !(bindings.ruleExists as boolean),
          complete(createProgram(), 'notfound', { message: 'Rule not found' }),
          (() => {
            let u = createProgram();
            u = get(u, 'guardrails', guardrailId, 'existing');
            u = putFrom(u, 'guardrails', guardrailId, (bindings) => {
              const existing = bindings.existing as Record<string, unknown>;
              const rules = (existing.rules as { id: string }[]).filter(r => r.id !== ruleId);
              return { ...existing, rules };
            });
            return complete(u, 'ok', { guardrail: guardrailId });
          })(),
        );
      })(),
    ) as StorageProgram<Result>;
  },
};

export const guardrailHandler = autoInterpret(_guardrailHandler);
