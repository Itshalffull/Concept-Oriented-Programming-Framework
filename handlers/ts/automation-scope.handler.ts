// @clef-handler style=functional
// ============================================================
// AutomationScope Handler
//
// Allowlist/denylist gate controlling which concept actions
// the SyncAutomationProvider may invoke at runtime. Each scope
// holds pattern rules grouped by category. Mode determines
// whether matched patterns are permitted or denied.
// See Architecture doc Sections 16.11, 16.12.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, branch, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

/** Glob-style match: supports '*' as wildcard within segment. */
function globMatch(pattern: string, value: string): boolean {
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '@@MULTI@@')
    .replace(/\*/g, '[^/]*')
    .replace(/@@MULTI@@/g, '.*');
  return new RegExp(`^${regexStr}$`).test(value);
}

const _handler: FunctionalConceptHandler = {
  configure(input: Record<string, unknown>) {
    const scope = (input.scope as string) || '';
    const mode = (input.mode as string) || '';

    if (!scope || scope.trim() === '') {
      return complete(createProgram(), 'error', { message: 'scope is required' }) as StorageProgram<Result>;
    }
    if (mode !== 'allowlist' && mode !== 'denylist') {
      return complete(createProgram(), 'invalid', { mode, message: 'mode must be "allowlist" or "denylist"' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'automation-scope', scope, 'existing');

    return branch(p, 'existing',
      (b) => {
        // Update existing scope — clear rules when mode changes
        let b2 = putFrom(b, 'automation-scope', scope, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const prevMode = existing.mode as string;
          const rules = prevMode === mode ? (existing.rules || []) : [];
          return { ...existing, mode, rules, active: true };
        });
        return complete(b2, 'ok', { scope }) as StorageProgram<Result>;
      },
      (b) => {
        // Create new scope
        let b2 = put(b, 'automation-scope', scope, {
          scope,
          mode,
          rules: [],
          active: true,
        });
        return complete(b2, 'ok', { scope }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  add_rule(input: Record<string, unknown>) {
    const scope = (input.scope as string) || '';
    const actionPattern = (input.action_pattern as string) || '';
    const category = (input.category as string) || '';

    if (!scope || scope.trim() === '') {
      return complete(createProgram(), 'error', { message: 'scope is required' }) as StorageProgram<Result>;
    }
    if (!actionPattern || actionPattern.trim() === '') {
      return complete(createProgram(), 'error', { message: 'action_pattern is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'automation-scope', scope, 'existing');

    return branch(p, 'existing',
      (b) => {
        // Check if there's a mode set, then add the rule
        return completeFrom(b, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          if (!existing.mode) {
            return { scope, _no_mode: true };
          }
          const rules = ((existing.rules as Array<{ action_pattern: string; category: string }>) || []);
          const alreadyExists = rules.some(r => r.action_pattern === actionPattern);
          const newRules = alreadyExists ? rules : [...rules, { action_pattern: actionPattern, category }];
          return { scope, rule_count: newRules.length, _new_rules: newRules };
        }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', { scope }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  remove_rule(input: Record<string, unknown>) {
    const scope = (input.scope as string) || '';
    const actionPattern = (input.action_pattern as string) || '';

    if (!scope || scope.trim() === '') {
      return complete(createProgram(), 'error', { message: 'scope is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'automation-scope', scope, 'existing');

    return branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'automation-scope', scope, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const rules = ((existing.rules as Array<{ action_pattern: string; category: string }>) || []);
          const filtered = rules.filter(r => r.action_pattern !== actionPattern);
          return { ...existing, rules: filtered };
        });
        return completeFrom(b2, 'ok', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const rules = ((existing.rules as Array<{ action_pattern: string; category: string }>) || []);
          const filtered = rules.filter(r => r.action_pattern !== actionPattern);
          if (filtered.length === rules.length) {
            // Return notfound data in the 'ok' payload — caller must check
            return { scope, rule_count: filtered.length, _not_found: true };
          }
          return { scope, rule_count: filtered.length };
        }) as StorageProgram<Result>;
      },
      (b) => complete(b, 'notfound', { action_pattern: actionPattern }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  check(input: Record<string, unknown>) {
    const scope = (input.scope as string) || '';
    const actionRef = (input.action_ref as string) || '';

    if (!scope || scope.trim() === '') {
      return complete(createProgram(), 'error', { message: 'scope is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'automation-scope', scope, 'existing');

    // Use completeFrom to compute the result from the fetched scope
    return branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        const mode = existing.mode as string;
        const rules = ((existing.rules as Array<{ action_pattern: string; category: string }>) || []);
        const matched = rules.some(r => globMatch(r.action_pattern, actionRef));

        if (mode === 'allowlist') {
          if (matched) {
            return { _variant: 'ok', scope, action_ref: actionRef };
          } else {
            return { _variant: 'denied', scope, action_ref: actionRef, reason: `Action "${actionRef}" is not in the allowlist` };
          }
        } else {
          // denylist
          if (matched) {
            return { _variant: 'denied', scope, action_ref: actionRef, reason: `Action "${actionRef}" is blocked by denylist` };
          } else {
            return { _variant: 'ok', scope, action_ref: actionRef };
          }
        }
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', { scope }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },

  list_rules(input: Record<string, unknown>) {
    const scope = (input.scope as string) || '';

    if (!scope || scope.trim() === '') {
      return complete(createProgram(), 'error', { message: 'scope is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'automation-scope', scope, 'existing');

    return branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const existing = bindings.existing as Record<string, unknown>;
        const rules = (existing.rules as Array<{ action_pattern: string; category: string }>) || [];
        return { rules };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', { scope }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },
};

export const automationScopeHandler = autoInterpret(_handler);
