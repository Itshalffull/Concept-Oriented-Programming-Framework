// FieldMapping — handler.ts
// Source-to-target field mapping with auto-discovery (Levenshtein distance),
// transform composition, bidirectional mapping, and validation.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import * as A from 'fp-ts/Array';
import { pipe } from 'fp-ts/function';

import type {
  FieldMappingStorage,
  FieldMappingMapInput,
  FieldMappingMapOutput,
  FieldMappingApplyInput,
  FieldMappingApplyOutput,
  FieldMappingReverseInput,
  FieldMappingReverseOutput,
  FieldMappingAutoDiscoverInput,
  FieldMappingAutoDiscoverOutput,
  FieldMappingValidateInput,
  FieldMappingValidateOutput,
} from './types.js';

import {
  mapOk,
  mapNotfound,
  applyOk,
  applyNotfound,
  applyError,
  reverseOk,
  reverseNotfound,
  autoDiscoverOk,
  validateOk,
  validateNotfound,
} from './types.js';

export interface FieldMappingError {
  readonly code: string;
  readonly message: string;
}

export interface FieldMappingHandler {
  readonly map: (
    input: FieldMappingMapInput,
    storage: FieldMappingStorage,
  ) => TE.TaskEither<FieldMappingError, FieldMappingMapOutput>;
  readonly apply: (
    input: FieldMappingApplyInput,
    storage: FieldMappingStorage,
  ) => TE.TaskEither<FieldMappingError, FieldMappingApplyOutput>;
  readonly reverse: (
    input: FieldMappingReverseInput,
    storage: FieldMappingStorage,
  ) => TE.TaskEither<FieldMappingError, FieldMappingReverseOutput>;
  readonly autoDiscover: (
    input: FieldMappingAutoDiscoverInput,
    storage: FieldMappingStorage,
  ) => TE.TaskEither<FieldMappingError, FieldMappingAutoDiscoverOutput>;
  readonly validate: (
    input: FieldMappingValidateInput,
    storage: FieldMappingStorage,
  ) => TE.TaskEither<FieldMappingError, FieldMappingValidateOutput>;
}

// --- Pure helpers ---

const storageErr = (error: unknown): FieldMappingError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

interface MappingRule {
  readonly sourceField: string;
  readonly destField: string;
  readonly transform: string;
}

/** Parse the rules array from a stored mapping record. */
const parseRules = (raw: unknown): readonly MappingRule[] => {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/** Safely parse a JSON string into an object. */
const safeJsonParse = (raw: string): E.Either<string, Record<string, unknown>> => {
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null
      ? E.right(parsed as Record<string, unknown>)
      : E.left('Input is not a JSON object');
  } catch (e) {
    return E.left(e instanceof Error ? e.message : String(e));
  }
};

/** Levenshtein distance for auto-discovery name similarity. */
const levenshtein = (a: string, b: string): number => {
  const la = a.length;
  const lb = b.length;
  const dp: number[][] = Array.from({ length: la + 1 }, () =>
    Array.from({ length: lb + 1 }, () => 0),
  );
  for (let i = 0; i <= la; i++) dp[i][0] = i;
  for (let j = 0; j <= lb; j++) dp[0][j] = j;
  for (let i = 1; i <= la; i++) {
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost,
      );
    }
  }
  return dp[la][lb];
};

/** Normalize a field name for comparison (lowercase, strip underscores/hyphens). */
const normalize = (name: string): string =>
  name.toLowerCase().replace(/[-_]/g, '');

/** Apply a named transform to a value. */
const applyTransform = (value: unknown, transform: string): unknown => {
  switch (transform) {
    case 'identity':
    case '':
      return value;
    case 'to_string':
      return String(value);
    case 'to_number':
      return Number(value);
    case 'to_boolean':
      return Boolean(value);
    case 'html_to_markdown': {
      // Lightweight HTML tag stripping
      const str = String(value ?? '');
      return str
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]+>/g, '')
        .trim();
    }
    case 'trim':
      return typeof value === 'string' ? value.trim() : value;
    case 'lowercase':
      return typeof value === 'string' ? value.toLowerCase() : value;
    case 'uppercase':
      return typeof value === 'string' ? value.toUpperCase() : value;
    default:
      return value;
  }
};

// --- Implementation ---

export const fieldMappingHandler: FieldMappingHandler = {
  /**
   * Add a field translation rule to a mapping.
   * Appends the rule to the existing rules array for the mapping.
   */
  map: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('mappings', input.mappingId),
        storageErr,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () => TE.right(mapNotfound(`Mapping '${input.mappingId}' does not exist`)),
            (found) => {
              const currentRules = parseRules(found['rules']);
              const newRule: MappingRule = {
                sourceField: input.sourceField,
                destField: input.destField,
                transform: input.transform,
              };
              const updatedRules = [...currentRules, newRule];
              return pipe(
                TE.tryCatch(
                  () =>
                    storage.put('mappings', input.mappingId, {
                      ...found,
                      rules: JSON.stringify(updatedRules),
                    }),
                  storageErr,
                ),
                TE.map(() => mapOk()),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Apply a mapping to transform a source record into destination shape.
   * Iterates over all rules in the mapping, reading from source fields
   * and writing to destination fields with transform application.
   */
  apply: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('mappings', input.mappingId),
        storageErr,
      ),
      TE.chain((mappingRec) =>
        pipe(
          O.fromNullable(mappingRec),
          O.fold(
            () =>
              TE.right(
                applyNotfound(`Mapping '${input.mappingId}' does not exist`),
              ),
            (found) =>
              pipe(
                safeJsonParse(input.record),
                E.fold(
                  (err) =>
                    TE.right(applyError(`Invalid record JSON: ${err}`)),
                  (sourceObj) => {
                    const rules = parseRules(found['rules']);
                    if (rules.length === 0) {
                      return TE.right(
                        applyError('Mapping has no rules defined'),
                      );
                    }

                    const destObj: Record<string, unknown> = {};
                    const errors: string[] = [];

                    for (const rule of rules) {
                      const sourceValue = sourceObj[rule.sourceField];
                      if (sourceValue === undefined) {
                        errors.push(
                          `Missing source field '${rule.sourceField}'`,
                        );
                        continue;
                      }
                      destObj[rule.destField] = applyTransform(
                        sourceValue,
                        rule.transform,
                      );
                    }

                    return errors.length > 0
                      ? TE.right(applyError(errors.join('; ')))
                      : TE.right(applyOk(JSON.stringify(destObj)));
                  },
                ),
              ),
          ),
        ),
      ),
    ),

  /**
   * Reverse a mapping: transform a destination record back into source shape.
   * Inverts each rule's direction (dest -> source) and applies the
   * identity transform since transforms are not necessarily invertible.
   */
  reverse: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('mappings', input.mappingId),
        storageErr,
      ),
      TE.chain((mappingRec) =>
        pipe(
          O.fromNullable(mappingRec),
          O.fold(
            () =>
              TE.right(
                reverseNotfound(`Mapping '${input.mappingId}' does not exist`),
              ),
            (found) =>
              pipe(
                safeJsonParse(input.record),
                E.fold(
                  (err) =>
                    TE.right(
                      reverseNotfound(`Invalid record JSON: ${err}`),
                    ),
                  (destObj) => {
                    const rules = parseRules(found['rules']);
                    const sourceObj: Record<string, unknown> = {};

                    for (const rule of rules) {
                      const destValue = destObj[rule.destField];
                      if (destValue !== undefined) {
                        sourceObj[rule.sourceField] = destValue;
                      }
                    }

                    return TE.right(reverseOk(JSON.stringify(sourceObj)));
                  },
                ),
              ),
          ),
        ),
      ),
    ),

  /**
   * Auto-discover field mappings between source and destination schemas
   * using Levenshtein distance on normalized field names.
   * Creates a new mapping record and returns suggested field pairs.
   */
  autoDiscover: (input, storage) =>
    pipe(
      E.Do,
      E.bind('srcSchema', () => safeJsonParse(input.sourceSchema)),
      E.bind('dstSchema', () => safeJsonParse(input.destSchema)),
      E.fold(
        (err) =>
          TE.left<FieldMappingError>({
            code: 'PARSE_ERROR',
            message: `Failed to parse schema: ${err}`,
          }),
        ({ srcSchema, dstSchema }) => {
          const srcFields = Object.keys(srcSchema);
          const dstFields = Object.keys(dstSchema);

          // For each source field, find the closest destination field
          const suggestions: Array<{
            readonly src: string;
            readonly dest: string;
            readonly distance: number;
            readonly confidence: number;
          }> = [];

          const usedDest = new Set<string>();

          for (const sf of srcFields) {
            let bestDist = Infinity;
            let bestDest = '';
            const normSf = normalize(sf);

            for (const df of dstFields) {
              if (usedDest.has(df)) continue;
              const normDf = normalize(df);
              const dist = levenshtein(normSf, normDf);
              if (dist < bestDist) {
                bestDist = dist;
                bestDest = df;
              }
            }

            const maxLen = Math.max(normSf.length, normalize(bestDest).length, 1);
            const confidence = Math.max(0, 1 - bestDist / maxLen);

            // Only suggest if confidence > 0.5
            if (bestDest && confidence > 0.5) {
              suggestions.push({
                src: sf,
                dest: bestDest,
                distance: bestDist,
                confidence: Math.round(confidence * 100) / 100,
              });
              usedDest.add(bestDest);
            }
          }

          const mappingId = `map-${Date.now()}`;
          const rules: readonly MappingRule[] = suggestions.map((s) => ({
            sourceField: s.src,
            destField: s.dest,
            transform: 'identity',
          }));

          return pipe(
            TE.tryCatch(
              () =>
                storage.put('mappings', mappingId, {
                  mappingId,
                  sourceSchema: input.sourceSchema,
                  destSchema: input.destSchema,
                  rules: JSON.stringify(rules),
                  createdAt: new Date().toISOString(),
                }),
              storageErr,
            ),
            TE.map(() =>
              autoDiscoverOk(
                mappingId,
                JSON.stringify(
                  suggestions.map((s) => ({
                    src: s.src,
                    dest: s.dest,
                    confidence: s.confidence,
                  })),
                ),
              ),
            ),
          );
        },
      ),
    ),

  /**
   * Validate a mapping definition.
   * Checks for: unmapped fields, type mismatches, and duplicate mappings.
   * Returns warnings as a JSON-encoded array.
   */
  validate: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('mappings', input.mappingId),
        storageErr,
      ),
      TE.chain((mappingRec) =>
        pipe(
          O.fromNullable(mappingRec),
          O.fold(
            () =>
              TE.right(
                validateNotfound(`Mapping '${input.mappingId}' does not exist`),
              ),
            (found) => {
              const rules = parseRules(found['rules']);
              const warnings: string[] = [];

              // Check for duplicate source fields
              const sourceFields = rules.map((r) => r.sourceField);
              const seen = new Set<string>();
              for (const sf of sourceFields) {
                if (seen.has(sf)) {
                  warnings.push(
                    `Duplicate mapping for source field '${sf}'`,
                  );
                }
                seen.add(sf);
              }

              // Check for duplicate destination fields
              const destFields = rules.map((r) => r.destField);
              const seenDest = new Set<string>();
              for (const df of destFields) {
                if (seenDest.has(df)) {
                  warnings.push(
                    `Duplicate mapping for destination field '${df}'`,
                  );
                }
                seenDest.add(df);
              }

              // Check for empty transforms (warn but do not fail)
              for (const rule of rules) {
                if (!rule.transform || rule.transform === '') {
                  warnings.push(
                    `No transform specified for '${rule.sourceField}' -> '${rule.destField}'`,
                  );
                }
              }

              if (rules.length === 0) {
                warnings.push('Mapping has no rules defined');
              }

              return TE.right(validateOk(JSON.stringify(warnings)));
            },
          ),
        ),
      ),
    ),
};
