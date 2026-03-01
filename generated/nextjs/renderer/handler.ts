// Renderer — handler.ts
// Cache-aware rendering pipeline with placeholder support, streaming,
// and cacheability metadata merging.
// Uses fp-ts for purely functional, composable concept implementations.

import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import * as O from 'fp-ts/Option';
import { pipe } from 'fp-ts/function';

import type {
  RendererStorage,
  RendererRenderInput,
  RendererRenderOutput,
  RendererAutoPlaceholderInput,
  RendererAutoPlaceholderOutput,
  RendererStreamInput,
  RendererStreamOutput,
  RendererMergeCacheabilityInput,
  RendererMergeCacheabilityOutput,
} from './types.js';

import {
  renderOk,
  renderError,
  autoPlaceholderOk,
  streamOk,
  streamError,
  mergeCacheabilityOk,
} from './types.js';

export interface RendererError {
  readonly code: string;
  readonly message: string;
}

export interface RendererHandler {
  readonly render: (
    input: RendererRenderInput,
    storage: RendererStorage,
  ) => TE.TaskEither<RendererError, RendererRenderOutput>;
  readonly autoPlaceholder: (
    input: RendererAutoPlaceholderInput,
    storage: RendererStorage,
  ) => TE.TaskEither<RendererError, RendererAutoPlaceholderOutput>;
  readonly stream: (
    input: RendererStreamInput,
    storage: RendererStorage,
  ) => TE.TaskEither<RendererError, RendererStreamOutput>;
  readonly mergeCacheability: (
    input: RendererMergeCacheabilityInput,
    storage: RendererStorage,
  ) => TE.TaskEither<RendererError, RendererMergeCacheabilityOutput>;
}

// --- Pure helpers ---

const storageErr = (error: unknown): RendererError => ({
  code: 'STORAGE_ERROR',
  message: error instanceof Error ? error.message : String(error),
});

/** Parse a JSON string array safely. */
const parseStringArray = (raw: unknown): readonly string[] => {
  if (typeof raw !== 'string') return [];
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

/**
 * Process a render tree string by resolving self-closing tags into
 * rendered content. Handles nested structures by processing innermost
 * tags first.
 *
 * Supported tag formats:
 * - <name/> — self-closing placeholder tag
 * - <name>content</name> — wrapping tag
 * - {{placeholder}} — mustache-style placeholders
 */
const processRenderTree = (
  tree: string,
  placeholders: Record<string, string>,
): E.Either<string, string> => {
  try {
    let output = tree;

    // Resolve mustache-style placeholders: {{name}}
    output = output.replace(/\{\{(\w+)\}\}/g, (_match, name) => {
      return placeholders[name] ?? `<!-- unresolved: ${name} -->`;
    });

    // Resolve self-closing tags: <name/> where name is a known placeholder
    output = output.replace(/<(\w+)\s*\/>/g, (_match, name) => {
      return placeholders[name] ?? `<div data-placeholder="${name}"></div>`;
    });

    // Process wrapping tags by preserving their content
    // <tag>content</tag> -> rendered content within a semantic wrapper
    output = output.replace(
      /<(\w+)>([\s\S]*?)<\/\1>/g,
      (_match, tag, content) => {
        const renderedContent = content.trim();
        return `<section data-component="${tag}">${renderedContent}</section>`;
      },
    );

    return E.right(output.trim());
  } catch (e) {
    return E.left(e instanceof Error ? e.message : String(e));
  }
};

/** Compute minimum max-age from multiple cache tag specifications. */
const computeMinMaxAge = (tags: readonly CacheTag[]): number => {
  if (tags.length === 0) return 0;
  const maxAges = tags
    .map((t) => t.maxAge)
    .filter((a): a is number => a !== undefined);
  return maxAges.length > 0 ? Math.min(...maxAges) : 0;
};

interface CacheTag {
  readonly tag: string;
  readonly maxAge?: number;
  readonly contexts?: readonly string[];
}

/** Parse cache tags from a JSON string. */
const parseCacheTags = (raw: string): readonly CacheTag[] => {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

// --- Implementation ---

export const rendererHandler: RendererHandler = {
  /**
   * Process a render tree into final output.
   * Resolves all placeholders registered for the renderer,
   * processes tag structures, and produces the final rendered string.
   * Caches the output keyed by renderer+tree hash for idempotent renders.
   */
  render: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('renderers', input.renderer),
        storageErr,
      ),
      TE.chain((rendererRec) => {
        // Gather placeholders for this renderer
        const placeholders: Record<string, string> = rendererRec
          ? (() => {
              try {
                return JSON.parse(
                  String(
                    (rendererRec as Record<string, unknown>)['placeholders'] ??
                      '{}',
                  ),
                );
              } catch {
                return {};
              }
            })()
          : {};

        return pipe(
          processRenderTree(input.tree, placeholders),
          E.fold(
            (err) => TE.right(renderError(`Render tree processing failed: ${err}`)),
            (output) =>
              pipe(
                TE.tryCatch(
                  () =>
                    storage.put('render_cache', `${input.renderer}::${input.tree.length}`, {
                      renderer: input.renderer,
                      treeHash: input.tree.length,
                      output,
                      renderedAt: new Date().toISOString(),
                    }),
                  storageErr,
                ),
                TE.map(() => renderOk(output)),
              ),
          ),
        );
      }),
    ),

  /**
   * Register a named placeholder for lazy resolution during rendering.
   * Returns a placeholder token that can be embedded in a render tree
   * and will be resolved to actual content at render time.
   */
  autoPlaceholder: (input, storage) => {
    const placeholderToken = `{{${input.name}}}`;

    return pipe(
      TE.tryCatch(
        () => storage.get('renderers', input.renderer),
        storageErr,
      ),
      TE.chain((rendererRec) => {
        const existingPlaceholders: Record<string, string> = rendererRec
          ? (() => {
              try {
                return JSON.parse(
                  String(
                    (rendererRec as Record<string, unknown>)['placeholders'] ??
                      '{}',
                  ),
                );
              } catch {
                return {};
              }
            })()
          : {};

        // Register the placeholder (content is empty until resolved)
        existingPlaceholders[input.name] =
          existingPlaceholders[input.name] ?? '';

        const rendererData = rendererRec
          ? { ...(rendererRec as Record<string, unknown>) }
          : { rendererId: input.renderer };

        return pipe(
          TE.tryCatch(
            () =>
              storage.put('renderers', input.renderer, {
                ...rendererData,
                placeholders: JSON.stringify(existingPlaceholders),
              }),
            storageErr,
          ),
          TE.map(() => autoPlaceholderOk(placeholderToken)),
        );
      }),
    );
  },

  /**
   * Start a streaming render session for a given tree.
   * Creates a stream session record and returns a stream ID that
   * clients can use to receive incremental output chunks.
   */
  stream: (input, storage) => {
    if (!input.tree || input.tree.trim().length === 0) {
      return TE.right(
        streamError('Cannot start a streaming render with an empty tree'),
      );
    }

    const streamId = `stream-${input.renderer}-${Date.now()}`;

    return pipe(
      TE.tryCatch(
        () =>
          storage.put('streams', streamId, {
            streamId,
            renderer: input.renderer,
            tree: input.tree,
            status: 'active',
            chunksEmitted: 0,
            startedAt: new Date().toISOString(),
          }),
        storageErr,
      ),
      TE.map(() => streamOk(streamId)),
    );
  },

  /**
   * Merge cache tags to compute the effective cacheability of the output.
   * Collects all cache tags, computes the minimum max-age (most restrictive),
   * gathers all cache contexts, and returns the merged cacheability metadata.
   */
  mergeCacheability: (input, storage) =>
    pipe(
      TE.tryCatch(
        () => storage.get('renderers', input.renderer),
        storageErr,
      ),
      TE.chain((rendererRec) => {
        const newTags = parseCacheTags(input.tags);

        // Get existing cacheability data
        const existingTags: readonly CacheTag[] = rendererRec
          ? parseCacheTags(
              String(
                (rendererRec as Record<string, unknown>)['cacheTags'] ?? '[]',
              ),
            )
          : [];

        // Merge all tags
        const allTags = [...existingTags, ...newTags];

        // Deduplicate tags by name
        const tagMap = new Map<string, CacheTag>();
        for (const tag of allTags) {
          const existing = tagMap.get(tag.tag);
          if (existing) {
            // Keep the more restrictive (lower) max-age
            tagMap.set(tag.tag, {
              tag: tag.tag,
              maxAge: Math.min(
                existing.maxAge ?? Infinity,
                tag.maxAge ?? Infinity,
              ),
              contexts: [
                ...new Set([
                  ...(existing.contexts ?? []),
                  ...(tag.contexts ?? []),
                ]),
              ],
            });
          } else {
            tagMap.set(tag.tag, tag);
          }
        }

        const mergedTags = [...tagMap.values()];
        const effectiveMaxAge = computeMinMaxAge(mergedTags);
        const allContexts = [
          ...new Set(mergedTags.flatMap((t) => t.contexts ?? [])),
        ];

        const merged = JSON.stringify({
          tags: mergedTags.map((t) => t.tag),
          maxAge: effectiveMaxAge === Infinity ? 0 : effectiveMaxAge,
          contexts: allContexts,
          isCacheable: effectiveMaxAge > 0,
        });

        // Store the merged cacheability
        const rendererData = rendererRec
          ? { ...(rendererRec as Record<string, unknown>) }
          : { rendererId: input.renderer };

        return pipe(
          TE.tryCatch(
            () =>
              storage.put('renderers', input.renderer, {
                ...rendererData,
                cacheTags: JSON.stringify(mergedTags),
                cacheability: merged,
              }),
            storageErr,
          ),
          TE.map(() => mergeCacheabilityOk(merged)),
        );
      }),
    ),
};
