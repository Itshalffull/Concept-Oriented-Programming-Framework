// Relation — handler.ts
// Typed, labeled, bidirectional connections between entities with cardinality
// constraints and bidirectional traversal.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  RelationStorage,
  RelationDefineRelationInput,
  RelationDefineRelationOutput,
  RelationLinkInput,
  RelationLinkOutput,
  RelationUnlinkInput,
  RelationUnlinkOutput,
  RelationGetRelatedInput,
  RelationGetRelatedOutput,
} from './types.js';

import {
  defineRelationOk,
  defineRelationExists,
  linkOk,
  linkInvalid,
  unlinkOk,
  unlinkNotfound,
  getRelatedOk,
  getRelatedNotfound,
} from './types.js';

export interface RelationError {
  readonly code: string;
  readonly message: string;
}

export interface RelationHandler {
  readonly defineRelation: (
    input: RelationDefineRelationInput,
    storage: RelationStorage,
  ) => TE.TaskEither<RelationError, RelationDefineRelationOutput>;
  readonly link: (
    input: RelationLinkInput,
    storage: RelationStorage,
  ) => TE.TaskEither<RelationError, RelationLinkOutput>;
  readonly unlink: (
    input: RelationUnlinkInput,
    storage: RelationStorage,
  ) => TE.TaskEither<RelationError, RelationUnlinkOutput>;
  readonly getRelated: (
    input: RelationGetRelatedInput,
    storage: RelationStorage,
  ) => TE.TaskEither<RelationError, RelationGetRelatedOutput>;
}

// --- Pure helpers ---

const storageErr = (error: unknown): RelationError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Parse a JSON string array, defaulting to empty. */
const parseStringArray = (raw: unknown): readonly string[] => {
  if (typeof raw === 'string') {
    try {
      const p = JSON.parse(raw);
      return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? (raw as readonly string[]) : [];
};

/** Parse cardinality from schema string. Format: "one-to-one" | "one-to-many" | "many-to-many" */
interface Cardinality {
  readonly sourceMax: number;
  readonly targetMax: number;
}

const parseCardinality = (schema: string): Cardinality => {
  const lower = schema.toLowerCase();
  if (lower.includes('one-to-one')) return { sourceMax: 1, targetMax: 1 };
  if (lower.includes('one-to-many')) return { sourceMax: Infinity, targetMax: 1 };
  if (lower.includes('many-to-one')) return { sourceMax: 1, targetMax: Infinity };
  // Default: many-to-many (no constraint)
  return { sourceMax: Infinity, targetMax: Infinity };
};

/** Composite key for a link edge. */
const linkEdgeKey = (relation: string, source: string, target: string): string =>
  `${relation}::${source}::${target}`;

/** Key for forward adjacency list: relation::entity -> targets */
const fwdKey = (relation: string, entity: string): string =>
  `fwd::${relation}::${entity}`;

/** Key for reverse adjacency list: relation::entity -> sources */
const revKey = (relation: string, entity: string): string =>
  `rev::${relation}::${entity}`;

// --- Implementation ---

export const relationHandler: RelationHandler = {
  /**
   * Register a typed relation with its schema (label, directionality, cardinality).
   * Checks for duplicate definitions.
   */
  defineRelation: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('relation_defs', input.relation),
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
                    storage.put('relation_defs', input.relation, {
                      relation: input.relation,
                      schema: input.schema,
                      createdAt: new Date().toISOString(),
                    }),
                  storageErr,
                ),
                TE.map(() => defineRelationOk(input.relation)),
              ),
            () => TE.right(defineRelationExists(input.relation)),
          ),
        ),
      ),
    ),

  /**
   * Create a bidirectional link between source and target within a relation.
   * Validates that the relation is defined and that cardinality constraints
   * are not violated before persisting.
   */
  link: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('relation_defs', input.relation),
        storageErr,
      ),
      TE.chain((relDef) =>
        pipe(
          O.fromNullable(relDef),
          O.fold(
            () =>
              TE.right(
                linkInvalid(input.relation, `Relation '${input.relation}' is not defined`),
              ),
            (def) => {
              const schema = String(def['schema'] ?? '');
              const cardinality = parseCardinality(schema);

              return pipe(
                // Check if edge already exists
                TE.tryCatch(
                  () => storage.get('link_edges', linkEdgeKey(input.relation, input.source, input.target)),
                  storageErr,
                ),
                TE.chain((existingEdge) =>
                  existingEdge !== null
                    ? TE.right(
                        linkInvalid(
                          input.relation,
                          `Link already exists between '${input.source}' and '${input.target}'`,
                        ),
                      )
                    : pipe(
                        // Cardinality check: how many targets does source already have?
                        TE.tryCatch(
                          () => storage.get('links', fwdKey(input.relation, input.source)),
                          storageErr,
                        ),
                        TE.chain((fwdRec) => {
                          const currentTargets = fwdRec
                            ? parseStringArray(fwdRec['items'])
                            : [];

                          if (currentTargets.length >= cardinality.sourceMax) {
                            return TE.right(
                              linkInvalid(
                                input.relation,
                                `Cardinality violated: source '${input.source}' already has ${currentTargets.length} link(s) (max ${cardinality.sourceMax})`,
                              ),
                            );
                          }

                          return pipe(
                            // Check reverse cardinality
                            TE.tryCatch(
                              () => storage.get('links', revKey(input.relation, input.target)),
                              storageErr,
                            ),
                            TE.chain((revRec) => {
                              const currentSources = revRec
                                ? parseStringArray(revRec['items'])
                                : [];

                              if (currentSources.length >= cardinality.targetMax) {
                                return TE.right(
                                  linkInvalid(
                                    input.relation,
                                    `Cardinality violated: target '${input.target}' already has ${currentSources.length} link(s) (max ${cardinality.targetMax})`,
                                  ),
                                );
                              }

                              // All checks pass — persist the link
                              return pipe(
                                TE.tryCatch(
                                  async () => {
                                    // Store edge
                                    await storage.put(
                                      'link_edges',
                                      linkEdgeKey(input.relation, input.source, input.target),
                                      {
                                        relation: input.relation,
                                        source: input.source,
                                        target: input.target,
                                      },
                                    );
                                    // Update forward adjacency
                                    const newTargets = [...currentTargets, input.target];
                                    await storage.put(
                                      'links',
                                      fwdKey(input.relation, input.source),
                                      { items: JSON.stringify(newTargets) },
                                    );
                                    // Update reverse adjacency
                                    const newSources = [...currentSources, input.source];
                                    await storage.put(
                                      'links',
                                      revKey(input.relation, input.target),
                                      { items: JSON.stringify(newSources) },
                                    );
                                  },
                                  storageErr,
                                ),
                                TE.map(() =>
                                  linkOk(input.relation, input.source, input.target),
                                ),
                              );
                            }),
                          );
                        }),
                      ),
                ),
              );
            },
          ),
        ),
      ),
    ),

  /**
   * Remove a link between source and target within a relation.
   * Cleans up both the edge record and both adjacency lists.
   */
  unlink: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('link_edges', linkEdgeKey(input.relation, input.source, input.target)),
        storageErr,
      ),
      TE.chain((existing) =>
        pipe(
          O.fromNullable(existing),
          O.fold(
            () =>
              TE.right(unlinkNotfound(input.relation, input.source, input.target)),
            () =>
              pipe(
                TE.tryCatch(
                  async () => {
                    // Delete edge
                    await storage.delete(
                      'link_edges',
                      linkEdgeKey(input.relation, input.source, input.target),
                    );
                    // Update forward adjacency
                    const fwdRec = await storage.get(
                      'links',
                      fwdKey(input.relation, input.source),
                    );
                    if (fwdRec) {
                      const targets = parseStringArray(fwdRec['items']).filter(
                        (t) => t !== input.target,
                      );
                      await storage.put(
                        'links',
                        fwdKey(input.relation, input.source),
                        { items: JSON.stringify(targets) },
                      );
                    }
                    // Update reverse adjacency
                    const revRec = await storage.get(
                      'links',
                      revKey(input.relation, input.target),
                    );
                    if (revRec) {
                      const sources = parseStringArray(revRec['items']).filter(
                        (s) => s !== input.source,
                      );
                      await storage.put(
                        'links',
                        revKey(input.relation, input.target),
                        { items: JSON.stringify(sources) },
                      );
                    }
                  },
                  storageErr,
                ),
                TE.map(() => unlinkOk(input.relation, input.source, input.target)),
              ),
          ),
        ),
      ),
    ),

  /**
   * Get all entities connected to the given entity within the relation,
   * traversing both forward (source->targets) and reverse (target->sources)
   * adjacency lists and returning the deduplicated union.
   */
  getRelated: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('relation_defs', input.relation),
        storageErr,
      ),
      TE.chain((relDef) =>
        pipe(
          O.fromNullable(relDef),
          O.fold(
            () =>
              TE.right(getRelatedNotfound(input.relation, input.entity)),
            () =>
              pipe(
                TE.tryCatch(
                  async () => {
                    const fwdRec = await storage.get(
                      'links',
                      fwdKey(input.relation, input.entity),
                    );
                    const revRec = await storage.get(
                      'links',
                      revKey(input.relation, input.entity),
                    );
                    const forwardTargets = fwdRec
                      ? parseStringArray(fwdRec['items'])
                      : [];
                    const reverseSources = revRec
                      ? parseStringArray(revRec['items'])
                      : [];
                    // Deduplicate and merge both directions
                    const all = [...new Set([...forwardTargets, ...reverseSources])];
                    return getRelatedOk(JSON.stringify(all));
                  },
                  storageErr,
                ),
              ),
          ),
        ),
      ),
    ),
};
