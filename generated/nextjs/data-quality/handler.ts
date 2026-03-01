// DataQuality — handler.ts
// Quality rule evaluation, quarantine management, dataset profiling,
// and knowledge-base reconciliation.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  DataQualityStorage,
  DataQualityValidateInput,
  DataQualityValidateOutput,
  DataQualityQuarantineInput,
  DataQualityQuarantineOutput,
  DataQualityReleaseInput,
  DataQualityReleaseOutput,
  DataQualityProfileInput,
  DataQualityProfileOutput,
  DataQualityReconcileInput,
  DataQualityReconcileOutput,
} from './types.js';

import {
  validateOk,
  validateInvalid,
  validateNotfound,
  quarantineOk,
  releaseOk,
  releaseNotfound,
  profileOk,
  reconcileOk,
} from './types.js';

export interface DataQualityError {
  readonly code: string;
  readonly message: string;
}

export interface DataQualityHandler {
  readonly validate: (
    input: DataQualityValidateInput,
    storage: DataQualityStorage,
  ) => TE.TaskEither<DataQualityError, DataQualityValidateOutput>;
  readonly quarantine: (
    input: DataQualityQuarantineInput,
    storage: DataQualityStorage,
  ) => TE.TaskEither<DataQualityError, DataQualityQuarantineOutput>;
  readonly release: (
    input: DataQualityReleaseInput,
    storage: DataQualityStorage,
  ) => TE.TaskEither<DataQualityError, DataQualityReleaseOutput>;
  readonly profile: (
    input: DataQualityProfileInput,
    storage: DataQualityStorage,
  ) => TE.TaskEither<DataQualityError, DataQualityProfileOutput>;
  readonly reconcile: (
    input: DataQualityReconcileInput,
    storage: DataQualityStorage,
  ) => TE.TaskEither<DataQualityError, DataQualityReconcileOutput>;
}

// --- Pure helpers ---

const storageErr = (error: unknown): DataQualityError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Safely parse a JSON string. */
const safeJsonParse = (raw: string): E.Either<string, Record<string, unknown>> => {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? E.right(parsed as Record<string, unknown>)
      : E.left('Not a JSON object');
  } catch (e) {
    return E.left(e instanceof Error ? e.message : String(e));
  }
};

interface QualityRule {
  readonly field: string;
  readonly rule: string;
  readonly params?: Record<string, unknown>;
}

/** Parse rules array from stored ruleset. */
const parseRules = (raw: unknown): readonly QualityRule[] => {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

interface Violation {
  readonly rule: string;
  readonly field: string;
  readonly message: string;
}

/** Evaluate a single quality rule against an item value. */
const evaluateRule = (
  item: Record<string, unknown>,
  rule: QualityRule,
): O.Option<Violation> => {
  const value = item[rule.field];

  switch (rule.rule) {
    case 'required':
      return value === undefined || value === null || value === ''
        ? O.some({ rule: 'required', field: rule.field, message: `Field '${rule.field}' is required` })
        : O.none;

    case 'non_empty':
      return typeof value === 'string' && value.trim() === ''
        ? O.some({ rule: 'non_empty', field: rule.field, message: `Field '${rule.field}' must not be empty` })
        : O.none;

    case 'min_length': {
      const minLen = Number(rule.params?.['min'] ?? 1);
      return typeof value === 'string' && value.length < minLen
        ? O.some({ rule: 'min_length', field: rule.field, message: `Field '${rule.field}' must be at least ${minLen} characters` })
        : O.none;
    }

    case 'max_length': {
      const maxLen = Number(rule.params?.['max'] ?? 255);
      return typeof value === 'string' && value.length > maxLen
        ? O.some({ rule: 'max_length', field: rule.field, message: `Field '${rule.field}' must be at most ${maxLen} characters` })
        : O.none;
    }

    case 'type': {
      const expectedType = String(rule.params?.['type'] ?? 'string');
      return typeof value !== expectedType
        ? O.some({ rule: 'type', field: rule.field, message: `Field '${rule.field}' must be of type '${expectedType}'` })
        : O.none;
    }

    case 'pattern': {
      const pattern = String(rule.params?.['pattern'] ?? '');
      if (!pattern || typeof value !== 'string') return O.none;
      try {
        const re = new RegExp(pattern);
        return !re.test(value)
          ? O.some({ rule: 'pattern', field: rule.field, message: `Field '${rule.field}' does not match pattern '${pattern}'` })
          : O.none;
      } catch {
        return O.none;
      }
    }

    default:
      return O.none;
  }
};

/** Compute a quality score from 0..1 based on violation ratio. */
const computeScore = (
  totalRules: number,
  violations: number,
): string => {
  if (totalRules === 0) return '1.00';
  const score = Math.max(0, 1 - violations / totalRules);
  return score.toFixed(2);
};

// --- Implementation ---

export const dataQualityHandler: DataQualityHandler = {
  /**
   * Validate an item against a ruleset.
   * Parses the item JSON, fetches the ruleset, evaluates each rule,
   * and returns ok with score or invalid with violations list.
   */
  validate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('rulesets', input.rulesetId),
        storageErr,
      ),
      TE.chain((rulesetRec) =>
        pipe(
          O.fromNullable(rulesetRec),
          O.fold(
            () =>
              TE.right(
                validateNotfound(`Ruleset '${input.rulesetId}' does not exist`),
              ),
            (found) =>
              pipe(
                safeJsonParse(input.item),
                E.fold(
                  (err) =>
                    TE.right(
                      validateInvalid(
                        JSON.stringify([
                          { rule: 'json_parse', field: '_root', message: err },
                        ]),
                      ),
                    ),
                  (itemObj) => {
                    const rules = parseRules(found['rules']);
                    const violations: Violation[] = [];

                    for (const rule of rules) {
                      pipe(
                        evaluateRule(itemObj, rule),
                        O.fold(
                          () => {},
                          (v) => {
                            violations.push(v);
                          },
                        ),
                      );
                    }

                    const score = computeScore(rules.length, violations.length);

                    return violations.length > 0
                      ? TE.right(validateInvalid(JSON.stringify(violations)))
                      : TE.right(
                          validateOk('true', score),
                        );
                  },
                ),
              ),
          ),
        ),
      ),
    ),

  /**
   * Place an item into quarantine with its violation details.
   * Stores the item in the 'quarantine' relation keyed by itemId.
   */
  quarantine: (input, storage) =>
    pipe(
      TE.tryCatch(
        () =>
          storage.put('quarantine', input.itemId, {
            itemId: input.itemId,
            violations: input.violations,
            quarantinedAt: new Date().toISOString(),
          }),
        storageErr,
      ),
      TE.map(() => quarantineOk()),
    ),

  /**
   * Release an item from quarantine back into the processing chain.
   * Removes the item from the 'quarantine' relation.
   */
  release: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('quarantine', input.itemId),
        storageErr,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.right(
                releaseNotfound(`Item '${input.itemId}' is not in quarantine`),
              ),
            () =>
              pipe(
                TE.tryCatch(
                  () => storage.delete('quarantine', input.itemId),
                  storageErr,
                ),
                TE.map(() => releaseOk()),
              ),
          ),
        ),
      ),
    ),

  /**
   * Profile a dataset by computing completeness, distribution, and anomaly statistics.
   * Fetches all records matching the dataset query and aggregates field-level stats.
   */
  profile: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('items', { query: input.datasetQuery }),
        storageErr,
      ),
      TE.map((records) => {
        const totalRecords = records.length;
        const fieldStats = new Map<
          string,
          { present: number; distinct: Set<unknown>; types: Set<string> }
        >();

        for (const rec of records) {
          for (const [key, value] of Object.entries(rec)) {
            const stats = fieldStats.get(key) ?? {
              present: 0,
              distinct: new Set<unknown>(),
              types: new Set<string>(),
            };
            if (value !== null && value !== undefined && value !== '') {
              stats.present += 1;
            }
            stats.distinct.add(value);
            stats.types.add(typeof value);
            fieldStats.set(key, stats);
          }
        }

        const profileData = Object.fromEntries(
          Array.from(fieldStats.entries()).map(([field, stats]) => [
            field,
            {
              completeness:
                totalRecords > 0
                  ? Math.round((stats.present / totalRecords) * 100) / 100
                  : 0,
              distinctValues: stats.distinct.size,
              types: [...stats.types],
            },
          ]),
        );

        return profileOk(
          JSON.stringify({
            totalRecords,
            fields: profileData,
          }),
        );
      }),
    ),

  /**
   * Reconcile a field value against an external knowledge base.
   * Looks up candidate matches by searching the knowledge base for
   * similar values and returns ranked candidates.
   */
  reconcile: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.find('knowledge_bases', { name: input.knowledgeBase }),
        storageErr,
      ),
      TE.map((kbRecords) => {
        const fieldLower = input.field.toLowerCase();
        const matches = kbRecords
          .filter((rec) => {
            const value = String(rec['value'] ?? '').toLowerCase();
            return (
              value === fieldLower ||
              value.includes(fieldLower) ||
              fieldLower.includes(value)
            );
          })
          .map((rec) => ({
            value: rec['value'],
            confidence: String(rec['value'] ?? '').toLowerCase() === fieldLower
              ? 1.0
              : 0.7,
          }));

        return reconcileOk(JSON.stringify(matches));
      }),
    ),
};
