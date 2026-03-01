// SearchIndex — handler.ts
// Inverted index operations: document indexing with tokenization,
// full-text search with TF-IDF ranking, processor pipeline, and reindexing.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  SearchIndexStorage,
  SearchIndexCreateIndexInput,
  SearchIndexCreateIndexOutput,
  SearchIndexIndexItemInput,
  SearchIndexIndexItemOutput,
  SearchIndexRemoveItemInput,
  SearchIndexRemoveItemOutput,
  SearchIndexSearchInput,
  SearchIndexSearchOutput,
  SearchIndexAddProcessorInput,
  SearchIndexAddProcessorOutput,
  SearchIndexReindexInput,
  SearchIndexReindexOutput,
} from './types.js';

import {
  createIndexOk,
  createIndexExists,
  indexItemOk,
  indexItemNotfound,
  removeItemOk,
  removeItemNotfound,
  searchOk,
  searchNotfound,
  addProcessorOk,
  addProcessorNotfound,
  reindexOk,
  reindexNotfound,
} from './types.js';

export interface SearchIndexError {
  readonly code: string;
  readonly message: string;
}

export interface SearchIndexHandler {
  readonly createIndex: (
    input: SearchIndexCreateIndexInput,
    storage: SearchIndexStorage,
  ) => TE.TaskEither<SearchIndexError, SearchIndexCreateIndexOutput>;
  readonly indexItem: (
    input: SearchIndexIndexItemInput,
    storage: SearchIndexStorage,
  ) => TE.TaskEither<SearchIndexError, SearchIndexIndexItemOutput>;
  readonly removeItem: (
    input: SearchIndexRemoveItemInput,
    storage: SearchIndexStorage,
  ) => TE.TaskEither<SearchIndexError, SearchIndexRemoveItemOutput>;
  readonly search: (
    input: SearchIndexSearchInput,
    storage: SearchIndexStorage,
  ) => TE.TaskEither<SearchIndexError, SearchIndexSearchOutput>;
  readonly addProcessor: (
    input: SearchIndexAddProcessorInput,
    storage: SearchIndexStorage,
  ) => TE.TaskEither<SearchIndexError, SearchIndexAddProcessorOutput>;
  readonly reindex: (
    input: SearchIndexReindexInput,
    storage: SearchIndexStorage,
  ) => TE.TaskEither<SearchIndexError, SearchIndexReindexOutput>;
}

// --- Pure helpers ---

const storageErr = (error: unknown): SearchIndexError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Common English stop words to filter during tokenization. */
const STOP_WORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'but', 'by', 'for',
  'if', 'in', 'into', 'is', 'it', 'no', 'not', 'of', 'on', 'or',
  'such', 'that', 'the', 'their', 'then', 'there', 'these', 'they',
  'this', 'to', 'was', 'will', 'with',
]);

/** Tokenize text into normalized terms. */
const tokenize = (text: string): readonly string[] => {
  const raw = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1);
  return raw.filter((t) => !STOP_WORDS.has(t));
};

/** Apply a named processor to text. */
const applyProcessor = (text: string, processor: string): string => {
  switch (processor) {
    case 'lowercase':
      return text.toLowerCase();
    case 'strip_html':
      return text.replace(/<[^>]+>/g, '');
    case 'trim':
      return text.trim();
    case 'stem':
      // Naive English suffix stemming
      return text.replace(/(ing|ed|ly|tion|ness|ment|able)$/i, '');
    default:
      return text;
  }
};

/** Parse a JSON string array. */
const parseStringArray = (raw: unknown): readonly string[] => {
  if (typeof raw !== 'string') return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

/** Composite key for an indexed item within a specific index. */
const itemKey = (indexId: string, itemId: string): string =>
  `${indexId}::item::${itemId}`;

/** Key for the inverted index posting list for a term within an index. */
const postingKey = (indexId: string, term: string): string =>
  `${indexId}::term::${term}`;

// --- Implementation ---

export const searchIndexHandler: SearchIndexHandler = {
  /**
   * Create a new search index with configuration.
   * Checks for duplicates before persisting the index definition.
   */
  createIndex: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('indexes', input.index),
        storageErr,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              pipe(
                TE.tryCatch(
                  () =>
                    storage.put('indexes', input.index, {
                      indexId: input.index,
                      config: input.config,
                      processors: JSON.stringify([]),
                      itemCount: 0,
                      createdAt: new Date().toISOString(),
                    }),
                  storageErr,
                ),
                TE.map(() => createIndexOk(input.index)),
              ),
            () => TE.right(createIndexExists(input.index)),
          ),
        ),
      ),
    ),

  /**
   * Index a document item through the processor pipeline and add it to
   * the inverted index. Tokenizes the data, removes stop words, and
   * updates the posting list for each term.
   */
  indexItem: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('indexes', input.index),
        storageErr,
      ),
      TE.chain((indexRec) =>
        pipe(
          O.fromNullable(indexRec),
          O.fold(
            () => TE.right(indexItemNotfound(input.index)),
            (found) => {
              const processors = parseStringArray(found['processors']);

              // Run data through processor pipeline
              let processedData = input.data;
              for (const proc of processors) {
                processedData = applyProcessor(processedData, proc);
              }

              // Tokenize the processed data
              const tokens = tokenize(processedData);

              // Build term frequency map for this document
              const termFreq = new Map<string, number>();
              for (const token of tokens) {
                termFreq.set(token, (termFreq.get(token) ?? 0) + 1);
              }

              return pipe(
                TE.tryCatch(
                  async () => {
                    // Store the item's raw data and tokens
                    await storage.put(
                      'index_items',
                      itemKey(input.index, input.item),
                      {
                        indexId: input.index,
                        itemId: input.item,
                        data: input.data,
                        tokens: JSON.stringify(tokens),
                        termFreq: JSON.stringify(
                          Object.fromEntries(termFreq),
                        ),
                        indexedAt: new Date().toISOString(),
                      },
                    );

                    // Update posting lists for each term
                    for (const [term, freq] of termFreq.entries()) {
                      const key = postingKey(input.index, term);
                      const existing = await storage.get('postings', key);
                      const currentPostings: Record<string, number> = existing
                        ? (() => {
                            try {
                              return JSON.parse(
                                String(existing['items'] ?? '{}'),
                              );
                            } catch {
                              return {};
                            }
                          })()
                        : {};

                      currentPostings[input.item] = freq;
                      await storage.put('postings', key, {
                        term,
                        indexId: input.index,
                        items: JSON.stringify(currentPostings),
                      });
                    }

                    // Update item count
                    const currentCount = Number(found['itemCount'] ?? 0);
                    await storage.put('indexes', input.index, {
                      ...found,
                      itemCount: currentCount + 1,
                    });
                  },
                  storageErr,
                ),
                TE.map(() => indexItemOk(input.index)),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Remove an item from the index, cleaning up its posting list entries.
   */
  removeItem: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('indexes', input.index),
        storageErr,
      ),
      TE.chain((indexRec) =>
        pipe(
          O.fromNullable(indexRec),
          O.fold(
            () => TE.right(removeItemNotfound(input.index)),
            (found) =>
              pipe(
                TE.tryCatch(
                  () =>
                    storage.get(
                      'index_items',
                      itemKey(input.index, input.item),
                    ),
                  storageErr,
                ),
                TE.chain((itemRec) =>
                  pipe(
                    O.fromNullable(itemRec),
                    O.fold(
                      () => TE.right(removeItemOk(input.index)),
                      (itemFound) => {
                        const tokens = parseStringArray(itemFound['tokens']);
                        const uniqueTerms = [...new Set(tokens)];

                        return pipe(
                          TE.tryCatch(
                            async () => {
                              // Remove from each posting list
                              for (const term of uniqueTerms) {
                                const key = postingKey(input.index, term);
                                const postingRec = await storage.get(
                                  'postings',
                                  key,
                                );
                                if (postingRec) {
                                  const items = (() => {
                                    try {
                                      return JSON.parse(
                                        String(postingRec['items'] ?? '{}'),
                                      );
                                    } catch {
                                      return {};
                                    }
                                  })();
                                  delete items[input.item];
                                  await storage.put('postings', key, {
                                    ...postingRec,
                                    items: JSON.stringify(items),
                                  });
                                }
                              }

                              // Delete the item record
                              await storage.delete(
                                'index_items',
                                itemKey(input.index, input.item),
                              );

                              // Update item count
                              const currentCount = Number(
                                found['itemCount'] ?? 0,
                              );
                              await storage.put('indexes', input.index, {
                                ...found,
                                itemCount: Math.max(0, currentCount - 1),
                              });
                            },
                            storageErr,
                          ),
                          TE.map(() => removeItemOk(input.index)),
                        );
                      },
                    ),
                  ),
                ),
              ),
          ),
        ),
      ),
    ),

  /**
   * Execute a full-text search query against the index.
   * Tokenizes the query, looks up posting lists, and computes TF-IDF
   * relevance scores for ranking results.
   */
  search: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('indexes', input.index),
        storageErr,
      ),
      TE.chain((indexRec) =>
        pipe(
          O.fromNullable(indexRec),
          O.fold(
            () => TE.right(searchNotfound(input.index)),
            (found) => {
              const queryTokens = tokenize(input.query);
              const totalDocs = Number(found['itemCount'] ?? 0);

              if (queryTokens.length === 0) {
                return TE.right(searchOk(JSON.stringify([])));
              }

              return pipe(
                TE.tryCatch(
                  async () => {
                    // Gather posting lists for all query terms
                    const scores = new Map<string, number>();

                    for (const term of queryTokens) {
                      const key = postingKey(input.index, term);
                      const postingRec = await storage.get('postings', key);
                      if (!postingRec) continue;

                      const items: Record<string, number> = (() => {
                        try {
                          return JSON.parse(
                            String(postingRec['items'] ?? '{}'),
                          );
                        } catch {
                          return {};
                        }
                      })();

                      const docFreq = Object.keys(items).length;
                      // IDF: log(totalDocs / docFreq)
                      const idf =
                        docFreq > 0
                          ? Math.log((totalDocs + 1) / (docFreq + 1)) + 1
                          : 0;

                      for (const [itemId, tf] of Object.entries(items)) {
                        const tfidf = tf * idf;
                        scores.set(
                          itemId,
                          (scores.get(itemId) ?? 0) + tfidf,
                        );
                      }
                    }

                    // Sort by score descending
                    const ranked = [...scores.entries()]
                      .sort((a, b) => b[1] - a[1])
                      .map(([itemId, score]) => ({
                        item: itemId,
                        score: Math.round(score * 1000) / 1000,
                      }));

                    return ranked;
                  },
                  storageErr,
                ),
                TE.map((ranked) => searchOk(JSON.stringify(ranked))),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Append a processor to the index pipeline.
   * Processors transform item data before tokenization during indexing.
   */
  addProcessor: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('indexes', input.index),
        storageErr,
      ),
      TE.chain((indexRec) =>
        pipe(
          O.fromNullable(indexRec),
          O.fold(
            () => TE.right(addProcessorNotfound(input.index)),
            (found) => {
              const processors = parseStringArray(found['processors']);
              const updatedProcessors = [...processors, input.processor];

              return pipe(
                TE.tryCatch(
                  () =>
                    storage.put('indexes', input.index, {
                      ...found,
                      processors: JSON.stringify(updatedProcessors),
                    }),
                  storageErr,
                ),
                TE.map(() => addProcessorOk(input.index)),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Rebuild the entire index by re-processing all tracked items through
   * the current processor pipeline. Returns the count of reindexed items.
   */
  reindex: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('indexes', input.index),
        storageErr,
      ),
      TE.chain((indexRec) =>
        pipe(
          O.fromNullable(indexRec),
          O.fold(
            () => TE.right(reindexNotfound(input.index)),
            (found) => {
              const processors = parseStringArray(found['processors']);

              return pipe(
                TE.tryCatch(
                  () =>
                    storage.find('index_items', { indexId: input.index }),
                  storageErr,
                ),
                TE.chain((items) =>
                  pipe(
                    TE.tryCatch(
                      async () => {
                        let count = 0;

                        for (const item of items) {
                          const itemId = String(item['itemId'] ?? '');
                          const rawData = String(item['data'] ?? '');

                          // Re-process through pipeline
                          let processedData = rawData;
                          for (const proc of processors) {
                            processedData = applyProcessor(
                              processedData,
                              proc,
                            );
                          }

                          // Re-tokenize
                          const tokens = tokenize(processedData);
                          const termFreq = new Map<string, number>();
                          for (const token of tokens) {
                            termFreq.set(
                              token,
                              (termFreq.get(token) ?? 0) + 1,
                            );
                          }

                          // Update the item record
                          await storage.put(
                            'index_items',
                            itemKey(input.index, itemId),
                            {
                              ...item,
                              tokens: JSON.stringify(tokens),
                              termFreq: JSON.stringify(
                                Object.fromEntries(termFreq),
                              ),
                              reindexedAt: new Date().toISOString(),
                            },
                          );

                          // Update posting lists
                          for (const [term, freq] of termFreq.entries()) {
                            const key = postingKey(input.index, term);
                            const existing = await storage.get(
                              'postings',
                              key,
                            );
                            const currentPostings: Record<string, number> =
                              existing
                                ? (() => {
                                    try {
                                      return JSON.parse(
                                        String(existing['items'] ?? '{}'),
                                      );
                                    } catch {
                                      return {};
                                    }
                                  })()
                                : {};

                            currentPostings[itemId] = freq;
                            await storage.put('postings', key, {
                              term,
                              indexId: input.index,
                              items: JSON.stringify(currentPostings),
                            });
                          }

                          count += 1;
                        }

                        return count;
                      },
                      storageErr,
                    ),
                    TE.map((count) => reindexOk(count)),
                  ),
                ),
              );
            },
          ),
        ),
      ),
    ),
};
