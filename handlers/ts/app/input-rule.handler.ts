// InputRule handler — functional StorageProgram style
// Declarative input-time pattern matching that dispatches to ActionBinding.
// Covers markdown shortcuts, trigger characters, paste handlers, and drop
// handlers through a single kind-tagged extension surface. Conflict resolution:
// highest priority wins; within the same priority tier, longest-pattern wins.
//
// NOTE: The concept action `register` matches the handler lifecycle method name.
// The `register` method here implements the concept action. The conformance test
// generator detects this case and skips lifecycle introspection gracefully.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, find, get, put, del, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const VALID_KINDS = ['pattern', 'trigger-char', 'paste', 'drop'] as const;
type ValidKind = typeof VALID_KINDS[number];

type Result = { variant: string; [key: string]: unknown };

const _inputRuleHandler: FunctionalConceptHandler = {

  register(input: Record<string, unknown>) {
    const rule = input.rule != null ? String(input.rule) : '';
    const kind = input.kind != null ? String(input.kind) : '';
    const pattern = input.pattern != null ? String(input.pattern) : '';
    const action_ref = input.action_ref != null ? String(input.action_ref) : '';
    const priority = typeof input.priority === 'number' ? input.priority : 0;
    const scope = input.scope != null ? String(input.scope) : null;

    // Validate kind before anything else
    if (!VALID_KINDS.includes(kind as ValidKind)) {
      return complete(createProgram(), 'invalid_kind', {
        message: `kind must be one of: ${VALID_KINDS.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    // Validate required non-empty fields
    if (!rule || rule.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'rule identifier is required',
      }) as StorageProgram<Result>;
    }
    if (!pattern || pattern.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'pattern is required',
      }) as StorageProgram<Result>;
    }
    if (!action_ref || action_ref.trim() === '') {
      return complete(createProgram(), 'error', {
        message: 'action_ref is required',
      }) as StorageProgram<Result>;
    }

    // Check for duplicate rule ID
    let p = createProgram();
    p = get(p, 'rules', rule, 'existing');
    return branch(p,
      (b) => b.existing != null,
      (b) => complete(b, 'duplicate', { rule }) as StorageProgram<Result>,
      (b) => {
        // Scan all rules for same kind+pattern+scope+priority — reject ambiguous duplicates
        let b2 = find(b, 'rules', '_all_rules');
        return branch(b2,
          (bindings) => {
            const allRules = (bindings._all_rules ?? []) as Array<Record<string, unknown>>;
            return allRules.some((r) =>
              r.kind === kind &&
              r.pattern === pattern &&
              r.priority === priority &&
              ((r.scope as string | null) ?? null) === scope,
            );
          },
          (bp) => complete(bp, 'duplicate', { rule }) as StorageProgram<Result>,
          (bp) => {
            const cp = put(bp, 'rules', rule, {
              rule,
              kind,
              pattern,
              action_ref,
              priority,
              scope,
            });
            return complete(cp, 'ok', { rule }) as StorageProgram<Result>;
          },
        );
      },
    ) as StorageProgram<Result>;
  },

  unregister(input: Record<string, unknown>) {
    const rule = input.rule != null ? String(input.rule) : '';

    if (!rule || rule.trim() === '') {
      return complete(createProgram(), 'notfound', {
        message: 'rule identifier is required',
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'rules', rule, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', {
        message: `rule '${rule}' not found`,
      }) as StorageProgram<Result>,
      (b) => {
        const dp = del(b, 'rules', rule);
        return complete(dp, 'ok', { rule }) as StorageProgram<Result>;
      },
    ) as StorageProgram<Result>;
  },

  match(input: Record<string, unknown>) {
    const kind = input.kind != null ? String(input.kind) : '';
    const inputText = input.input != null ? String(input.input) : '';
    const scope = input.scope != null ? String(input.scope) : null;

    if (!kind || kind.trim() === '') {
      return complete(createProgram(), 'no_match', {}) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = find(p, 'rules', {}, '_all_rules');
    // Compute the match result into an intermediate binding
    p = mapBindings(p, (bindings) => {
      const allRules = (bindings._all_rules ?? []) as Array<Record<string, unknown>>;

      // Filter by kind
      const kindMatches = allRules.filter((r) => r.kind === kind);

      // Filter by scope:
      //   - Global rule (scope = null) matches any request (scope present or absent)
      //   - Scoped rule (scope = X) only matches when request scope = X
      const scopeMatches = kindMatches.filter((r) => {
        const ruleScope = (r.scope as string | null) ?? null;
        if (ruleScope === null) return true;         // global — always eligible
        return ruleScope === scope;                  // scoped — must match
      });

      // Filter by pattern match against input
      const patternMatches = scopeMatches.filter((r) => {
        const pat = r.pattern as string;
        try {
          const regex = new RegExp(pat);
          return regex.test(inputText);
        } catch {
          return false;
        }
      });

      if (patternMatches.length === 0) {
        return null; // signals no match
      }

      // Sort: highest priority first; longest pattern as tiebreaker within same priority
      patternMatches.sort((a, b) => {
        const priDiff = (b.priority as number) - (a.priority as number);
        if (priDiff !== 0) return priDiff;
        return (b.pattern as string).length - (a.pattern as string).length;
      });

      const winner = patternMatches[0];
      const pat = winner.pattern as string;

      // Extract captures for pattern-kind rules
      let captures = '[]';
      if (winner.kind === 'pattern') {
        try {
          const regex = new RegExp(pat);
          const m = inputText.match(regex);
          if (m && m.length > 1) {
            captures = JSON.stringify(m.slice(1));
          }
        } catch {
          // leave captures as '[]'
        }
      }

      return {
        rule: winner.rule as string,
        action_ref: winner.action_ref as string,
        captures,
      };
    }, '_match_result');

    return branch(p,
      (b) => b._match_result == null,
      (b) => complete(b, 'no_match', {}) as StorageProgram<Result>,
      (b) => completeFrom(b, 'ok', (bindings) => {
        const m = bindings._match_result as Record<string, unknown>;
        return { rule: m.rule, action_ref: m.action_ref, captures: m.captures };
      }) as StorageProgram<Result>,
    ) as StorageProgram<Result>;
  },
};

export const inputRuleHandler = autoInterpret(_inputRuleHandler);
export default inputRuleHandler;
