// ProgressiveSchema — handler.ts
// Accept content at any formality level and incrementally formalize it
// via structure detection, suggestion acceptance, and schema promotion.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  ProgressiveSchemaStorage,
  ProgressiveSchemaCaptureFreeformInput,
  ProgressiveSchemaCaptureFreeformOutput,
  ProgressiveSchemaDetectStructureInput,
  ProgressiveSchemaDetectStructureOutput,
  ProgressiveSchemaAcceptSuggestionInput,
  ProgressiveSchemaAcceptSuggestionOutput,
  ProgressiveSchemaRejectSuggestionInput,
  ProgressiveSchemaRejectSuggestionOutput,
  ProgressiveSchemaPromoteInput,
  ProgressiveSchemaPromoteOutput,
  ProgressiveSchemaInferSchemaInput,
  ProgressiveSchemaInferSchemaOutput,
} from './types.js';

import {
  captureFreeformOk,
  detectStructureOk,
  detectStructureNotfound,
  acceptSuggestionOk,
  acceptSuggestionNotfound,
  rejectSuggestionOk,
  rejectSuggestionNotfound,
  promoteOk,
  promoteNotfound,
  promoteIncomplete,
  inferSchemaOk,
  inferSchemaError,
} from './types.js';

export interface ProgressiveSchemaError {
  readonly code: string;
  readonly message: string;
}

export interface ProgressiveSchemaHandler {
  readonly captureFreeform: (
    input: ProgressiveSchemaCaptureFreeformInput,
    storage: ProgressiveSchemaStorage,
  ) => TE.TaskEither<ProgressiveSchemaError, ProgressiveSchemaCaptureFreeformOutput>;
  readonly detectStructure: (
    input: ProgressiveSchemaDetectStructureInput,
    storage: ProgressiveSchemaStorage,
  ) => TE.TaskEither<ProgressiveSchemaError, ProgressiveSchemaDetectStructureOutput>;
  readonly acceptSuggestion: (
    input: ProgressiveSchemaAcceptSuggestionInput,
    storage: ProgressiveSchemaStorage,
  ) => TE.TaskEither<ProgressiveSchemaError, ProgressiveSchemaAcceptSuggestionOutput>;
  readonly rejectSuggestion: (
    input: ProgressiveSchemaRejectSuggestionInput,
    storage: ProgressiveSchemaStorage,
  ) => TE.TaskEither<ProgressiveSchemaError, ProgressiveSchemaRejectSuggestionOutput>;
  readonly promote: (
    input: ProgressiveSchemaPromoteInput,
    storage: ProgressiveSchemaStorage,
  ) => TE.TaskEither<ProgressiveSchemaError, ProgressiveSchemaPromoteOutput>;
  readonly inferSchema: (
    input: ProgressiveSchemaInferSchemaInput,
    storage: ProgressiveSchemaStorage,
  ) => TE.TaskEither<ProgressiveSchemaError, ProgressiveSchemaInferSchemaOutput>;
}

// --- Pure helpers ---

const storageErr = (error: unknown): ProgressiveSchemaError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Generate a unique ID from a prefix and timestamp. */
const generateId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

interface DetectedField {
  readonly id: string;
  readonly field: string;
  readonly value: string;
  readonly type: string;
  readonly confidence: number;
}

/** Detect dates in ISO format (YYYY-MM-DD). */
const detectDates = (content: string): readonly DetectedField[] => {
  const datePattern = /\b(\d{4}-\d{2}-\d{2})\b/g;
  const results: DetectedField[] = [];
  let match: RegExpExecArray | null;
  while ((match = datePattern.exec(content)) !== null) {
    results.push({
      id: generateId('sug'),
      field: 'date',
      value: match[1],
      type: 'date',
      confidence: 0.95,
    });
  }
  return results;
};

/** Detect hashtags (#tag-name). */
const detectTags = (content: string): readonly DetectedField[] => {
  const tagPattern = /#([\w-]+)/g;
  const results: DetectedField[] = [];
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(content)) !== null) {
    results.push({
      id: generateId('sug'),
      field: 'tag',
      value: match[1],
      type: 'string',
      confidence: 0.9,
    });
  }
  return results;
};

/** Detect email addresses. */
const detectEmails = (content: string): readonly DetectedField[] => {
  const emailPattern = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
  const results: DetectedField[] = [];
  let match: RegExpExecArray | null;
  while ((match = emailPattern.exec(content)) !== null) {
    results.push({
      id: generateId('sug'),
      field: 'email',
      value: match[1],
      type: 'email',
      confidence: 0.92,
    });
  }
  return results;
};

/** Detect URLs. */
const detectUrls = (content: string): readonly DetectedField[] => {
  const urlPattern = /\bhttps?:\/\/[^\s]+/g;
  const results: DetectedField[] = [];
  let match: RegExpExecArray | null;
  while ((match = urlPattern.exec(content)) !== null) {
    results.push({
      id: generateId('sug'),
      field: 'url',
      value: match[0],
      type: 'url',
      confidence: 0.88,
    });
  }
  return results;
};

/** Detect mentions (@name). */
const detectMentions = (content: string): readonly DetectedField[] => {
  const mentionPattern = /@(\w+)/g;
  const results: DetectedField[] = [];
  let match: RegExpExecArray | null;
  while ((match = mentionPattern.exec(content)) !== null) {
    results.push({
      id: generateId('sug'),
      field: 'mention',
      value: match[1],
      type: 'string',
      confidence: 0.85,
    });
  }
  return results;
};

/** Parse a JSON string array. */
const parseJsonArray = (raw: unknown): readonly Record<string, unknown>[] => {
  if (typeof raw !== 'string') return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// --- Implementation ---

export const progressiveSchemaHandler: ProgressiveSchemaHandler = {
  /**
   * Store freeform content at the lowest formality level.
   * Generates an item ID and persists the raw content with formality='freeform'.
   */
  captureFreeform: (input, storage) => {
    const itemId = generateId('ps');
    return pipe(
      TE.tryCatch(
        () =>
          storage.put('items', itemId, {
            itemId,
            content: input.content,
            formality: 'freeform',
            properties: JSON.stringify({}),
            suggestions: JSON.stringify([]),
            promotionHistory: JSON.stringify([]),
            createdAt: new Date().toISOString(),
          }),
        storageErr,
      ),
      TE.map(() => captureFreeformOk(itemId)),
    );
  },

  /**
   * Run structure detectors against a stored item's content.
   * Detects dates, hashtags, emails, URLs, and mentions with confidence scores.
   * Stores suggestions on the item for later acceptance/rejection.
   */
  detectStructure: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('items', input.itemId),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                detectStructureNotfound(`Item '${input.itemId}' does not exist`),
              ),
            (found) => {
              const content = String(found['content'] ?? '');
              const allSuggestions: readonly DetectedField[] = [
                ...detectDates(content),
                ...detectTags(content),
                ...detectEmails(content),
                ...detectUrls(content),
                ...detectMentions(content),
              ];

              return pipe(
                TE.tryCatch(
                  () =>
                    storage.put('items', input.itemId, {
                      ...found,
                      suggestions: JSON.stringify(allSuggestions),
                      formality:
                        allSuggestions.length > 0
                          ? 'partially_structured'
                          : String(found['formality']),
                    }),
                  storageErr,
                ),
                TE.map(() =>
                  detectStructureOk(JSON.stringify(allSuggestions)),
                ),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Accept a detected suggestion, promoting it to a typed property on the item.
   * Moves the suggestion from the suggestions list into the properties map.
   */
  acceptSuggestion: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('items', input.itemId),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                acceptSuggestionNotfound(`Item '${input.itemId}' does not exist`),
              ),
            (found) => {
              const suggestions = parseJsonArray(found['suggestions']);
              const suggestion = suggestions.find(
                (s) => String(s['id']) === input.suggestionId,
              );

              if (!suggestion) {
                return TE.right(
                  acceptSuggestionNotfound(
                    `Suggestion '${input.suggestionId}' not found on item '${input.itemId}'`,
                  ),
                );
              }

              const remainingSuggestions = suggestions.filter(
                (s) => String(s['id']) !== input.suggestionId,
              );

              // Add to properties
              const currentProps = parseJsonArray(found['properties']);
              const properties =
                typeof found['properties'] === 'string'
                  ? (() => {
                      try {
                        return JSON.parse(found['properties'] as string);
                      } catch {
                        return {};
                      }
                    })()
                  : {};

              const field = String(suggestion['field'] ?? '');
              const value = suggestion['value'];
              properties[field] = value;

              // Track promotion history
              const history = parseJsonArray(found['promotionHistory']);
              const newHistory = [
                ...history,
                {
                  action: 'accepted',
                  suggestionId: input.suggestionId,
                  field,
                  timestamp: new Date().toISOString(),
                },
              ];

              return pipe(
                TE.tryCatch(
                  () =>
                    storage.put('items', input.itemId, {
                      ...found,
                      suggestions: JSON.stringify(remainingSuggestions),
                      properties: JSON.stringify(properties),
                      promotionHistory: JSON.stringify(newHistory),
                    }),
                  storageErr,
                ),
                TE.map(() => acceptSuggestionOk()),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Reject a suggestion, removing it from the suggestions list without
   * promoting it to a property.
   */
  rejectSuggestion: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('items', input.itemId),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                rejectSuggestionNotfound(`Item '${input.itemId}' does not exist`),
              ),
            (found) => {
              const suggestions = parseJsonArray(found['suggestions']);
              const suggestion = suggestions.find(
                (s) => String(s['id']) === input.suggestionId,
              );

              if (!suggestion) {
                return TE.right(
                  rejectSuggestionNotfound(
                    `Suggestion '${input.suggestionId}' not found on item '${input.itemId}'`,
                  ),
                );
              }

              const remainingSuggestions = suggestions.filter(
                (s) => String(s['id']) !== input.suggestionId,
              );

              const history = parseJsonArray(found['promotionHistory']);
              const newHistory = [
                ...history,
                {
                  action: 'rejected',
                  suggestionId: input.suggestionId,
                  timestamp: new Date().toISOString(),
                },
              ];

              return pipe(
                TE.tryCatch(
                  () =>
                    storage.put('items', input.itemId, {
                      ...found,
                      suggestions: JSON.stringify(remainingSuggestions),
                      promotionHistory: JSON.stringify(newHistory),
                    }),
                  storageErr,
                ),
                TE.map(() => rejectSuggestionOk()),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Promote an item to full schema conformance.
   * Fetches the target schema, checks for missing required fields,
   * and either promotes (ok) or reports gaps (incomplete).
   */
  promote: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('items', input.itemId),
        storageErr,
      ),
      TE.chain((record) =>
        pipe(
          O.fromNullable(record),
          O.fold(
            () =>
              TE.right(
                promoteNotfound(`Item '${input.itemId}' does not exist`),
              ),
            (found) =>
              pipe(
                TE.tryCatch(
                  () => storage.get('schemas', input.targetSchema),
                  storageErr,
                ),
                TE.chain((schemaRec) => {
                  // Parse item properties
                  const properties = (() => {
                    try {
                      return JSON.parse(String(found['properties'] ?? '{}'));
                    } catch {
                      return {};
                    }
                  })();

                  // Parse target schema required fields
                  const requiredFields: readonly string[] = schemaRec
                    ? (() => {
                        try {
                          const s = JSON.parse(
                            String(schemaRec['required'] ?? '[]'),
                          );
                          return Array.isArray(s) ? s : [];
                        } catch {
                          return [];
                        }
                      })()
                    : [];

                  // Check for missing required fields
                  const gaps = requiredFields.filter(
                    (f) =>
                      properties[f] === undefined ||
                      properties[f] === null ||
                      properties[f] === '',
                  );

                  if (gaps.length > 0) {
                    return TE.right(
                      promoteIncomplete(
                        JSON.stringify(
                          gaps.map((f) => ({
                            field: f,
                            reason: 'missing_required',
                          })),
                        ),
                      ),
                    );
                  }

                  // Promote: update formality to 'fully_typed'
                  const history = parseJsonArray(found['promotionHistory']);
                  const newHistory = [
                    ...history,
                    {
                      action: 'promoted',
                      targetSchema: input.targetSchema,
                      timestamp: new Date().toISOString(),
                    },
                  ];

                  return pipe(
                    TE.tryCatch(
                      () =>
                        storage.put('items', input.itemId, {
                          ...found,
                          formality: 'fully_typed',
                          schema: input.targetSchema,
                          promotionHistory: JSON.stringify(newHistory),
                        }),
                      storageErr,
                    ),
                    TE.map(() =>
                      promoteOk(
                        JSON.stringify({
                          itemId: input.itemId,
                          schema: input.targetSchema,
                          formality: 'fully_typed',
                          properties,
                        }),
                      ),
                    ),
                  );
                }),
              ),
          ),
        ),
      ),
    ),

  /**
   * Infer a common schema from multiple items by analyzing their properties.
   * Collects all fields across items, computes frequency and type distribution,
   * and proposes required vs optional fields.
   */
  inferSchema: (input, storage) =>
    pipe(
      (() => {
        try {
          const itemIds = JSON.parse(input.items);
          return Array.isArray(itemIds) ? E.right(itemIds as readonly string[]) : E.left('Input must be a JSON array of item IDs');
        } catch {
          return E.left('Invalid JSON for items');
        }
      })(),
      E.fold(
        (err) => TE.right(inferSchemaError(err)),
        (itemIds) => {
          if (itemIds.length < 2) {
            return TE.right(
              inferSchemaError('Need at least 2 items to infer a schema'),
            );
          }

          return pipe(
            TE.tryCatch(
              async () => {
                const items: Record<string, unknown>[] = [];
                for (const id of itemIds) {
                  const rec = await storage.get('items', id as string);
                  if (rec) {
                    const props = (() => {
                      try {
                        return JSON.parse(String(rec['properties'] ?? '{}'));
                      } catch {
                        return {};
                      }
                    })();
                    items.push(props);
                  }
                }
                return items;
              },
              storageErr,
            ),
            TE.chain((items) => {
              if (items.length < 2) {
                return TE.right(
                  inferSchemaError('Not enough valid items found'),
                );
              }

              // Collect field frequency and types
              const fieldInfo = new Map<
                string,
                { count: number; types: Set<string> }
              >();

              for (const item of items) {
                for (const [key, value] of Object.entries(item)) {
                  const info = fieldInfo.get(key) ?? {
                    count: 0,
                    types: new Set<string>(),
                  };
                  info.count += 1;
                  info.types.add(typeof value);
                  fieldInfo.set(key, info);
                }
              }

              const threshold = items.length * 0.8;
              const required: string[] = [];
              const optional: string[] = [];
              const fields: Record<
                string,
                { type: string; required: boolean }
              > = {};

              for (const [field, info] of fieldInfo.entries()) {
                const isRequired = info.count >= threshold;
                const primaryType =
                  info.types.size === 1
                    ? [...info.types][0]
                    : 'mixed';
                fields[field] = { type: primaryType, required: isRequired };
                if (isRequired) required.push(field);
                else optional.push(field);
              }

              return TE.right(
                inferSchemaOk(
                  JSON.stringify({
                    fields,
                    required,
                    optional,
                    sampleSize: items.length,
                  }),
                ),
              );
            }),
          );
        },
      ),
    ),
};
