// @clef-handler style=functional
// TextAnchor Concept Implementation
// Resilient position addressing within block-structured content.
// Implements the relocation algorithm: exact match → fuzzy search → orphaned.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, del, branch, complete, completeFrom, pureFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

/** Strip HTML tags from content string, returning plain text only. */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/** Compute longest common substring length between two strings. */
function longestCommonSubstring(a: string, b: string): number {
  if (!a || !b) return 0;
  const m = a.length;
  const n = b.length;
  let max = 0;
  // O(m*n) DP — acceptable for ~60-char context strings
  const dp: number[] = new Array((m + 1) * (n + 1)).fill(0);
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i * (n + 1) + j] = dp[(i - 1) * (n + 1) + (j - 1)] + 1;
        if (dp[i * (n + 1) + j] > max) max = dp[i * (n + 1) + j];
      }
    }
  }
  return max;
}

/** Score a candidate text against a target context string (0-1). */
function contextMatchScore(candidate: string, context: string): number {
  if (!context) return 1; // empty context always matches
  const lcs = longestCommonSubstring(candidate.toLowerCase(), context.toLowerCase());
  return lcs / context.length;
}

/**
 * Parse blocks array from a JSON content string.
 * Expected format: { blocks: [{ id: string, content: string }] }
 */
function parseBlocks(contentJson: string): Array<{ id: string; content: string }> | null {
  try {
    const parsed = JSON.parse(contentJson);
    if (Array.isArray(parsed)) return parsed as Array<{ id: string; content: string }>;
    if (!parsed || typeof parsed !== 'object') return null;
    const blocks = (parsed as { blocks?: unknown }).blocks;
    if (!Array.isArray(blocks)) return null;
    return blocks as Array<{ id: string; content: string }>;
  } catch {
    return null;
  }
}

/** Pre-stripped block index: blocks with their HTML-stripped plain text computed once. */
type StrippedBlock = { id: string; text: string };

/**
 * Build a stripped-text index from raw blocks.
 * Strips HTML tags for every block exactly once, avoiding repeated work across anchors.
 */
function buildStrippedIndex(blocks: Array<{ id: string; content: string }>): StrippedBlock[] {
  return blocks.map(block => ({ id: block.id, text: stripTags(block.content || '') }));
}

/**
 * Find the best matching position for prefix+suffix context across pre-stripped blocks.
 * Accepts a StrippedBlock[] so HTML stripping is done once outside the call, not per-invocation.
 * Returns { blockId, offset, score } or null if threshold not met.
 */
function findBestContextMatchInIndex(
  strippedBlocks: StrippedBlock[],
  prefix: string,
  suffix: string,
  threshold = 0.8,
): { blockId: string; offset: number; score: number } | null {
  const context = prefix + suffix;
  if (!context) return null;

  let best: { blockId: string; offset: number; score: number } | null = null;

  for (const block of strippedBlocks) {
    const text = block.text;
    // Slide a window of context.length over the block text
    const windowLen = Math.min(context.length, text.length);
    for (let i = 0; i <= text.length - windowLen; i++) {
      const window = text.slice(i, i + windowLen);
      const score = contextMatchScore(window, context);
      if (score >= threshold && (!best || score > best.score)) {
        // offset is where suffix begins within the block text
        const offsetInWindow = Math.min(prefix.length, windowLen);
        best = { blockId: block.id, offset: i + offsetInWindow, score };
      }
    }
    // Also try sliding a shorter window for partial matches
    if (context.length > text.length && text.length > 0) {
      const score = contextMatchScore(text, context);
      if (score >= threshold && (!best || score > best.score)) {
        best = { blockId: block.id, offset: 0, score };
      }
    }
  }

  return best;
}

/**
 * Find the best matching position for prefix+suffix context across all blocks.
 * Returns { blockId, offset, score } or null if threshold not met.
 * (Used by the single-anchor resolve action — strips HTML inline.)
 */
function findBestContextMatch(
  blocks: Array<{ id: string; content: string }>,
  prefix: string,
  suffix: string,
  threshold = 0.8,
): { blockId: string; offset: number; score: number } | null {
  return findBestContextMatchInIndex(buildStrippedIndex(blocks), prefix, suffix, threshold);
}

const _textAnchorHandler: FunctionalConceptHandler = {
  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { name: 'TextAnchor' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const anchor = input.anchor as string;
    const entityRef = input.entityRef as string;
    const blockId = input.blockId as string;
    const offset = input.offset as number ?? 0;
    const prefix = (input.prefix as string) ?? '';
    const suffix = (input.suffix as string) ?? '';
    const contentHash = (input.contentHash as string) ?? '';

    if (!prefix && !suffix) {
      return complete(createProgram(), 'error', { message: 'At least one of prefix or suffix must be non-empty' }) as StorageProgram<Result>;
    }
    if (!anchor || (typeof anchor === 'string' && anchor.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'anchor id is required' }) as StorageProgram<Result>;
    }
    if (!entityRef || entityRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'entityRef is required' }) as StorageProgram<Result>;
    }
    if (!blockId || blockId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'blockId is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = put(p, 'anchor', anchor, {
      anchor,
      entityRef,
      blockId,
      offset,
      prefix,
      suffix,
      contentHash,
      status: 'current',
    });
    return complete(p, 'ok', { anchor }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const anchor = input.anchor as string;
    const currentContent = (input.currentContent as string) ?? '';

    let p = createProgram();
    p = spGet(p, 'anchor', anchor, 'record');
    p = branch(p, 'record',
      (b) => {
        // Found the anchor — run the relocation algorithm and return a dynamic variant
        return pureFrom(b, (bindings) => {
          const rec = bindings.record as Record<string, unknown>;
          const storedBlockId = rec.blockId as string;
          const storedOffset = rec.offset as number;
          const prefix = (rec.prefix as string) ?? '';
          const suffix = (rec.suffix as string) ?? '';
          const status = (rec.status as string) ?? 'current';

          const blocks = parseBlocks(currentContent);
          if (!blocks) {
            return { variant: 'orphaned', message: 'Could not parse content blocks' };
          }

          // Step 1: find the block by stored blockId
          const block = blocks.find(blk => blk.id === storedBlockId);

          if (block) {
            const text = stripTags(block.content || '');
            // Step 2: extract text around the stored offset
            const prefixStart = Math.max(0, storedOffset - prefix.length);
            const suffixEnd = Math.min(text.length, storedOffset + suffix.length);
            const extractedPrefix = text.slice(prefixStart, storedOffset);
            const extractedSuffix = text.slice(storedOffset, suffixEnd);

            const prefixMatch = !prefix || contextMatchScore(extractedPrefix, prefix) >= 0.8;
            const suffixMatch = !suffix || contextMatchScore(extractedSuffix, suffix) >= 0.8;

            if (prefixMatch && suffixMatch) {
              // Exact match — still current
              return { variant: 'ok', blockId: storedBlockId, offset: storedOffset, status: 'current' };
            }
          }

          // Step 3: fuzzy search all blocks
          const best = findBestContextMatch(blocks, prefix, suffix, 0.8);
          if (best) {
            return { variant: 'relocated', blockId: best.blockId, offset: best.offset };
          }

          // Step 4: orphaned
          return { variant: 'orphaned', message: `Anchor context not found in current content (status was: ${status})` };
        });
      },
      (b) => complete(b, 'notfound', { message: 'Anchor not found' }),
    );
    return p as StorageProgram<Result>;
  },

  relocate(input: Record<string, unknown>) {
    const anchor = input.anchor as string;
    const newBlockId = input.newBlockId as string;
    const newOffset = input.newOffset as number ?? 0;
    const newContentHash = (input.newContentHash as string) ?? '';

    let p = createProgram();
    p = spGet(p, 'anchor', anchor, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const b2 = putFrom(b, 'anchor', anchor, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          return {
            ...existing,
            blockId: newBlockId,
            offset: newOffset,
            contentHash: newContentHash,
            status: 'relocated',
          };
        });
        return complete(b2, 'ok', { anchor });
      },
      (b) => complete(b, 'notfound', { message: 'Anchor not found' }),
    );
    return p as StorageProgram<Result>;
  },

  batchResolve(input: Record<string, unknown>) {
    const entityRef = input.entityRef as string;
    const currentContent = (input.currentContent as string) ?? '';

    let p = createProgram();
    p = find(p, 'anchor', { entityRef }, 'allAnchors');
    return completeFrom(p, 'ok', (bindings) => {
      const allAnchors = (bindings.allAnchors as Array<Record<string, unknown>>) ?? [];
      const blocks = parseBlocks(currentContent) ?? [];

      // PRD §1.3, §1.4 optimization: build the stripped-text index once for all anchors,
      // and build a by-id lookup map for O(1) exact-block access.
      const strippedIndex = buildStrippedIndex(blocks);
      const strippedById = new Map<string, string>(strippedIndex.map(b => [b.id, b.text]));

      // Fuzzy-search cache: keyed by "prefix\x00suffix" so anchors sharing the same
      // context string reuse the search result without scanning all blocks again.
      const fuzzyCache = new Map<string, { blockId: string; offset: number; score: number } | null>();

      const results = allAnchors.map((rec) => {
        const anchorId = rec.anchor as string;
        const storedBlockId = rec.blockId as string;
        const storedOffset = rec.offset as number;
        const prefix = (rec.prefix as string) ?? '';
        const suffix = (rec.suffix as string) ?? '';

        // Step 1: check original block at original offset using pre-stripped text
        const blockText = strippedById.get(storedBlockId);
        if (blockText !== undefined) {
          const prefixStart = Math.max(0, storedOffset - prefix.length);
          const suffixEnd = Math.min(blockText.length, storedOffset + suffix.length);
          const extractedPrefix = blockText.slice(prefixStart, storedOffset);
          const extractedSuffix = blockText.slice(storedOffset, suffixEnd);
          const prefixMatch = !prefix || contextMatchScore(extractedPrefix, prefix) >= 0.8;
          const suffixMatch = !suffix || contextMatchScore(extractedSuffix, suffix) >= 0.8;
          if (prefixMatch && suffixMatch) {
            return { anchor: anchorId, status: 'current', blockId: storedBlockId, offset: storedOffset };
          }
        }

        // Step 2: fuzzy search — use cache to avoid re-scanning all blocks for identical context
        const cacheKey = `${prefix}\x00${suffix}`;
        let best: { blockId: string; offset: number; score: number } | null | undefined = fuzzyCache.get(cacheKey);
        if (best === undefined) {
          best = findBestContextMatchInIndex(strippedIndex, prefix, suffix, 0.8);
          fuzzyCache.set(cacheKey, best);
        }

        if (best) {
          return { anchor: anchorId, status: 'relocated', blockId: best.blockId, offset: best.offset };
        }

        return { anchor: anchorId, status: 'orphaned', blockId: storedBlockId, offset: storedOffset };
      });

      return { results: JSON.stringify(results) };
    }) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const anchor = input.anchor as string;

    let p = createProgram();
    p = spGet(p, 'anchor', anchor, 'record');
    p = branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.record as Record<string, unknown>;
        return {
          anchor: rec.anchor as string,
          entityRef: rec.entityRef as string,
          blockId: rec.blockId as string,
          offset: rec.offset as number,
          prefix: rec.prefix as string,
          suffix: rec.suffix as string,
          contentHash: (rec.contentHash as string) ?? '',
          status: (rec.status as string) ?? 'current',
        };
      }),
      (b) => complete(b, 'notfound', { message: 'Anchor not found' }),
    );
    return p as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    const anchor = input.anchor as string;

    let p = createProgram();
    p = spGet(p, 'anchor', anchor, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'anchor', anchor);
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Anchor not found' }),
    );
    return p as StorageProgram<Result>;
  },

  listForEntity(input: Record<string, unknown>) {
    const entityRef = input.entityRef as string;

    let p = createProgram();
    p = find(p, 'anchor', { entityRef }, 'allAnchors');
    return completeFrom(p, 'ok', (bindings) => {
      const allAnchors = (bindings.allAnchors as Array<Record<string, unknown>>) ?? [];
      const sorted = [...allAnchors].sort((a, b) => {
        const blockCmp = String(a.blockId).localeCompare(String(b.blockId));
        if (blockCmp !== 0) return blockCmp;
        return (a.offset as number) - (b.offset as number);
      });
      return { anchors: JSON.stringify(sorted) };
    }) as StorageProgram<Result>;
  },
};

export const textAnchorHandler = autoInterpret(_textAnchorHandler);
