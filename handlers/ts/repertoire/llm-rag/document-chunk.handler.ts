// @clef-handler style=functional
// ============================================================
// DocumentChunk Concept Implementation
//
// Segment documents into chunks with metadata, embeddings, and
// relationship links. Supports recursive, semantic, sentence,
// fixed-size, structural, and agentic chunking strategies.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, find, branch, complete, completeFrom,
  mapBindings, traverse, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_STRATEGIES = ['recursive', 'semantic', 'sentence', 'fixed_size', 'structural', 'agentic'];

let _chunkCounter = 0;
function generateChunkId(): string {
  return `chunk-${Date.now()}-${++_chunkCounter}`;
}

/**
 * Split text into chunks using a simple recursive strategy.
 * Production would delegate to an LLM or NLP pipeline via perform().
 */
function splitText(
  content: string,
  chunkSize: number,
  chunkOverlap: number,
): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < content.length) {
    const end = Math.min(start + chunkSize, content.length);
    chunks.push(content.slice(start, end));
    start += chunkSize - chunkOverlap;
    if (start >= content.length) break;
  }
  return chunks.length > 0 ? chunks : [content];
}

const _documentChunkHandler: FunctionalConceptHandler = {
  split(input: Record<string, unknown>) {
    const documentId = input.document_id as string;
    const content = input.content as string;
    const strategy = input.strategy as string;
    const config = input.config as { chunk_size: number; chunk_overlap: number };

    if (!documentId || documentId.trim() === '') {
      return complete(createProgram(), 'error', { message: 'document_id is required' }) as StorageProgram<Result>;
    }

    if (!VALID_STRATEGIES.includes(strategy)) {
      return complete(createProgram(), 'error', { message: `Unknown strategy: ${strategy}` }) as StorageProgram<Result>;
    }

    const chunkSize = config.chunk_size || 512;
    const chunkOverlap = config.chunk_overlap || 50;
    const textParts = splitText(content, chunkSize, chunkOverlap);

    const chunkIds: string[] = [];
    let p = createProgram();

    for (let i = 0; i < textParts.length; i++) {
      const chunkId = generateChunkId();
      chunkIds.push(chunkId);
      const prevId = i > 0 ? chunkIds[i - 1] : null;
      const nextId: string | null = null; // will be patched below

      p = put(p, 'chunks', chunkId, {
        id: chunkId,
        text: textParts[i],
        metadata: {
          source_document_id: documentId,
          position: i,
          page_number: null,
          section_title: null,
        },
        embedding: null,
        relationships: {
          parent_document_id: documentId,
          prev_chunk_id: prevId,
          next_chunk_id: nextId,
          child_chunk_ids: [],
        },
        chunk_strategy: strategy,
        token_count: Math.ceil(textParts[i].length / 4),
      });
    }

    // Patch next_chunk_id references
    for (let i = 0; i < chunkIds.length - 1; i++) {
      p = putFrom(p, 'chunks', chunkIds[i], (bindings) => {
        return {
          id: chunkIds[i],
          text: textParts[i],
          metadata: {
            source_document_id: documentId,
            position: i,
            page_number: null,
            section_title: null,
          },
          embedding: null,
          relationships: {
            parent_document_id: documentId,
            prev_chunk_id: i > 0 ? chunkIds[i - 1] : null,
            next_chunk_id: chunkIds[i + 1],
            child_chunk_ids: [],
          },
          chunk_strategy: strategy,
          token_count: Math.ceil(textParts[i].length / 4),
        };
      });
    }

    return complete(p, 'ok', { chunks: chunkIds, count: chunkIds.length }) as StorageProgram<Result>;
  },

  enrich(input: Record<string, unknown>) {
    const chunkId = input.chunk as string;
    const extractors = input.extractors as string[];

    let p = createProgram();
    p = get(p, 'chunks', chunkId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Chunk not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'chunks', chunkId, 'existing');
        b = putFrom(b, 'chunks', chunkId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const metadata = { ...(existing.metadata as Record<string, unknown>) } as Record<string, unknown>;
          for (const extractor of extractors) {
            metadata[extractor] = `[extracted-${extractor}]`;
          }
          return { ...existing, metadata };
        });
        return complete(b, 'ok', { chunk: chunkId });
      })(),
    ) as StorageProgram<Result>;
  },

  getContext(input: Record<string, unknown>) {
    const chunkId = input.chunk as string;
    const windowSize = input.window_size as number;

    let p = createProgram();
    p = get(p, 'chunks', chunkId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Chunk not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'chunks', chunkId, 'existing');
        b = find(b, 'chunks', {}, 'allChunks');
        b = mapBindings(b, (bindings) => {
          const current = bindings.existing as Record<string, unknown>;
          const all = bindings.allChunks as Record<string, unknown>[];
          const relationships = current.relationships as Record<string, unknown>;
          const parentDoc = relationships.parent_document_id as string;

          // Gather sibling chunks from same document
          const siblings = all
            .filter((c: Record<string, unknown>) => {
              const rel = c.relationships as Record<string, unknown>;
              return rel.parent_document_id === parentDoc;
            })
            .sort((a: Record<string, unknown>, b: Record<string, unknown>) => {
              const am = a.metadata as Record<string, unknown>;
              const bm = b.metadata as Record<string, unknown>;
              return (am.position as number) - (bm.position as number);
            });

          const currentPos = (current.metadata as Record<string, unknown>).position as number;
          const startPos = Math.max(0, currentPos - windowSize);
          const endPos = currentPos + windowSize;

          const contextChunks = siblings
            .filter((c: Record<string, unknown>) => {
              const pos = (c.metadata as Record<string, unknown>).position as number;
              return pos >= startPos && pos <= endPos;
            })
            .map((c: Record<string, unknown>) => ({
              chunk: c.id as string,
              text: c.text as string,
              position: (c.metadata as Record<string, unknown>).position === currentPos ? 'current' : 'context',
            }));

          return contextChunks;
        }, 'contextChunks');

        return completeFrom(b, 'ok', (bindings) => ({
          chunks: bindings.contextChunks as unknown[],
        }));
      })(),
    ) as StorageProgram<Result>;
  },

  getParent(input: Record<string, unknown>) {
    const chunkId = input.chunk as string;

    let p = createProgram();
    p = get(p, 'chunks', chunkId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Parent not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'chunks', chunkId, 'existing');
        b = mapBindings(b, (bindings) => {
          const chunk = bindings.existing as Record<string, unknown>;
          const rel = chunk.relationships as Record<string, unknown>;
          return rel.parent_document_id as string;
        }, 'parentId');

        // In a real implementation, the parent document would be in a separate
        // Document concept. Here we return the parent_document_id reference.
        return completeFrom(b, 'ok', (bindings) => ({
          parent_text: `[parent document content for ${bindings.parentId}]`,
          parent_id: bindings.parentId as string,
        }));
      })(),
    ) as StorageProgram<Result>;
  },
};

export const documentChunkHandler = autoInterpret(_documentChunkHandler);
