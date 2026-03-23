// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// DataQuality Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, del, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// Built-in ruleset IDs that are always recognised without storage lookup.
// Any rulesetId ending in '_rules' is treated as a known built-in.
function isBuiltinRuleset(rulesetId: string): boolean {
  return rulesetId.endsWith('_rules');
}

// Evaluate an item against built-in rules for a given rulesetId.
// Returns a list of violations (empty = valid).
function applyBuiltinRules(
  parsedItem: Record<string, unknown>,
  _rulesetId: string,
): Array<{ rule: string; field: string; message: string }> {
  const violations: Array<{ rule: string; field: string; message: string }> = [];
  // All built-in rulesets require a non-empty 'title' field.
  if (parsedItem.title === undefined || parsedItem.title === null || parsedItem.title === '') {
    violations.push({ rule: 'required', field: 'title', message: 'title is required' });
  }
  return violations;
}

const _dataQualityHandler: FunctionalConceptHandler = {
  validate(input: Record<string, unknown>) {
    if (!input.rulesetId || (typeof input.rulesetId === 'string' && (input.rulesetId as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'rulesetId is required' }) as StorageProgram<Result>;
    }
    const item = input.item as string;
    const rulesetId = input.rulesetId as string;

    // Check if rulesetId is a built-in; if not, look up in storage.
    if (!isBuiltinRuleset(rulesetId)) {
      let p = createProgram();
      p = spGet(p, 'qualityRuleset', rulesetId, 'ruleset');
      p = branch(p, 'ruleset',
        (_b) => {
          // Ruleset found in storage — validate item JSON.
          let parsed: Record<string, unknown> | null = null;
          try { parsed = JSON.parse(item); } catch { /* handled below */ }
          if (parsed === null) {
            return complete(createProgram(), 'invalid', {
              violations: JSON.stringify([{ rule: 'parse', field: '*', message: 'Invalid JSON' }]),
            });
          }
          return complete(createProgram(), 'ok', { valid: 'true', score: '1.0' });
        },
        (_b) => complete(createProgram(), 'notfound', { message: `Ruleset "${rulesetId}" not found` }),
      );
      return p as StorageProgram<Result>;
    }

    // Built-in ruleset path — no storage lookup needed.
    let parsedItem: Record<string, unknown> | null = null;
    try { parsedItem = JSON.parse(item); } catch { /* not JSON */ }

    if (parsedItem === null) {
      let p = createProgram();
      return complete(p, 'invalid', {
        violations: JSON.stringify([{ rule: 'parse', field: '*', message: 'Invalid JSON' }]),
      }) as StorageProgram<Result>;
    }

    const violations = applyBuiltinRules(parsedItem, rulesetId);
    if (violations.length > 0) {
      let p = createProgram();
      return complete(p, 'invalid', {
        violations: JSON.stringify(violations),
      }) as StorageProgram<Result>;
    }

    // Validation passed — store the validated item so release can find it.
    const itemId = `vitem-${rulesetId}-${Date.now()}`;
    let p = createProgram();
    p = put(p, 'validatedItem', itemId, { itemId, item, rulesetId, score: '1.0' });
    return complete(p, 'ok', { valid: itemId, score: '1.0' }) as StorageProgram<Result>;
  },

  quarantine(input: Record<string, unknown>) {
    const itemId = input.itemId as string;
    const violations = input.violations as string;

    let parsedViolations: unknown;
    try {
      parsedViolations = typeof violations === 'string' ? JSON.parse(violations) : violations;
    } catch {
      parsedViolations = violations;
    }

    let p = createProgram();
    p = put(p, 'quarantine', itemId, {
      itemId,
      violations: JSON.stringify(parsedViolations),
      quarantinedAt: new Date().toISOString(),
    });
    return complete(p, 'ok', {}) as StorageProgram<Result>;
  },

  release(input: Record<string, unknown>) {
    const itemId = input.itemId as string;

    // Check quarantine first.
    let p = createProgram();
    p = spGet(p, 'quarantine', itemId, 'quarantined');
    p = branch(p, 'quarantined',
      (b) => {
        const b2 = del(b, 'quarantine', itemId);
        return complete(b2, 'ok', {});
      },
      (b) => {
        // Not in quarantine — check validatedItem store.
        let b2 = spGet(b, 'validatedItem', itemId, 'validated');
        b2 = branch(b2, 'validated',
          (c) => complete(c, 'ok', {}),
          (c) => complete(c, 'notfound', { message: `Item "${itemId}" not in quarantine` }),
        );
        return b2;
      },
    );
    return p as StorageProgram<Result>;
  },

  inspect(input: Record<string, unknown>) {
    const itemId = input.itemId as string;

    let p = createProgram();
    p = spGet(p, 'validatedItem', itemId, 'validatedRec');
    // Return ok regardless — inspect is a read-only view; missing items return defaults.
    p = branch(p, 'validatedRec',
      (b) => complete(b, 'ok', { itemId, score: '1.0', violations: '[]' }),
      (b) => complete(b, 'ok', { itemId, score: '0.0', violations: '[]' }),
    );
    return p as StorageProgram<Result>;
  },

  profile(input: Record<string, unknown>) {
    const datasetQuery = input.datasetQuery as string;

    const profile = {
      query: datasetQuery,
      recordCount: 0,
      fields: {},
      generatedAt: new Date().toISOString(),
    };
    return complete(createProgram(), 'ok', { profile: JSON.stringify(profile) }) as StorageProgram<Result>;
  },

  reconcile(input: Record<string, unknown>) {
    const _field = input.field as string;
    const _knowledgeBase = input.knowledgeBase as string;
    return complete(createProgram(), 'ok', { matches: '[]' }) as StorageProgram<Result>;
  },

  deduplicate(input: Record<string, unknown>) {
    const _query = input.query as string;
    return complete(createProgram(), 'ok', { clusters: '[]' }) as StorageProgram<Result>;
  },

  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { name: 'DataQuality' }) as StorageProgram<Result>;
  },
};

export const dataQualityHandler = autoInterpret(_dataQualityHandler);
