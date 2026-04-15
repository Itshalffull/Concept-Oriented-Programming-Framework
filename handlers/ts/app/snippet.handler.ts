// @clef-handler style=functional
// Snippet Concept Implementation
// Referenceable text excerpt with staleness tracking.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, mergeFrom, del, branch, complete, completeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

function toStr(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

function toOpt(v: unknown): string | null {
  if (v === null || v === undefined || v === 'none') return null;
  return typeof v === 'string' ? v : null;
}

/**
 * Minimal TextSpan resolver.
 * Searches `currentContent` (JSON blocks array) for the textSpan anchor and
 * returns the matching text. Real implementations would use a proper TextSpan
 * concept; this keeps Snippet independent.
 */
function resolveTextSpan(
  textSpanId: string,
  currentContent: string,
): { ok: true; text: string; fragments: string; stale: boolean } | { ok: false } {
  try {
    const doc = JSON.parse(currentContent) as { blocks?: Array<{ id?: string; content?: string }> };
    const blocks = doc.blocks ?? [];
    // Find block whose id matches the textSpan (simplified lookup)
    const block = blocks.find((b) => b.id === textSpanId || b.content?.includes(textSpanId));
    if (!block) return { ok: false };
    const text = block.content ?? '';
    const fragments = JSON.stringify([{ text, offset: 0, length: text.length }]);
    return { ok: true, text, fragments, stale: false };
  } catch {
    return { ok: false };
  }
}

const _snippetHandler: FunctionalConceptHandler = {
  register() {
    return complete(createProgram(), 'ok', { name: 'Snippet' }) as StorageProgram<Result>;
  },

  create(input: Record<string, unknown>) {
    const snippet = toStr(input.snippet);
    const textSpan = toStr(input.textSpan);
    const sourceEntity = toStr(input.sourceEntity);
    const label = toOpt(input.label);
    const kind = toOpt(input.kind);
    const metadata = toOpt(input.metadata);

    if (!textSpan || textSpan.trim() === '') {
      return complete(createProgram(), 'error', { message: 'textSpan is required' }) as StorageProgram<Result>;
    }
    if (!sourceEntity || sourceEntity.trim() === '') {
      return complete(createProgram(), 'error', { message: 'sourceEntity is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'snippet', snippet, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'error', { message: 'A snippet with this ID already exists' }),
      (b) => {
        const now = new Date().toISOString();
        let b2 = put(b, 'snippet', snippet, {
          snippet,
          textSpan,
          sourceEntity,
          label: label ?? null,
          kind: kind ?? null,
          metadata: metadata ?? null,
          resolvedText: null,
          status: 'active',
          createdAt: now,
          updatedAt: now,
        });
        return complete(b2, 'ok', { snippet });
      },
    );
    return p as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const snippet = toStr(input.snippet);
    const currentContent = toStr(input.currentContent);

    let p = createProgram();
    p = spGet(p, 'snippet', snippet, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const rec = (b as unknown as { existing: Record<string, unknown> }).existing as Record<string, unknown>;
        const textSpanId = toStr(rec.textSpan);
        const resolution = resolveTextSpan(textSpanId, currentContent);
        const now = new Date().toISOString();

        if (!resolution.ok) {
          let b2 = mergeFrom(b, 'snippet', snippet, () => ({
            status: 'broken',
            resolvedText: null,
            updatedAt: now,
          }));
          return complete(b2, 'broken', { snippet });
        }

        if (resolution.stale) {
          let b2 = mergeFrom(b, 'snippet', snippet, () => ({
            status: 'stale',
            resolvedText: resolution.text,
            updatedAt: now,
          }));
          return complete(b2, 'stale', { snippet, text: resolution.text });
        }

        let b2 = mergeFrom(b, 'snippet', snippet, () => ({
          status: 'active',
          resolvedText: resolution.text,
          updatedAt: now,
        }));
        return complete(b2, 'ok', { snippet, text: resolution.text, fragments: resolution.fragments });
      },
      (b) => complete(b, 'notfound', { message: 'No snippet exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const snippet = toStr(input.snippet);

    let p = createProgram();
    p = spGet(p, 'snippet', snippet, 'existing');
    p = branch(p, 'existing',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          snippet,
          textSpan: toStr(rec.textSpan),
          sourceEntity: toStr(rec.sourceEntity),
          label: toStr(rec.label ?? ''),
          resolvedText: toStr(rec.resolvedText ?? ''),
          status: toStr(rec.status),
          kind: toStr(rec.kind ?? ''),
        };
      }) as StorageProgram<Result>,
      (b) => complete(b, 'notfound', { message: 'No snippet exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },

  list(input: Record<string, unknown>) {
    const sourceEntity = toOpt(input.sourceEntity);

    let p = createProgram();
    p = find(p, 'snippet', {}, 'allSnippets');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allSnippets as Array<Record<string, unknown>>) ?? [];
      const filtered = sourceEntity
        ? all.filter((s) => s.sourceEntity === sourceEntity)
        : all;
      return { snippets: JSON.stringify(filtered) };
    }) as StorageProgram<Result>;
  },

  setLabel(input: Record<string, unknown>) {
    const snippet = toStr(input.snippet);
    const label = toStr(input.label);

    let p = createProgram();
    p = spGet(p, 'snippet', snippet, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const now = new Date().toISOString();
        let b2 = mergeFrom(b, 'snippet', snippet, () => ({ label, updatedAt: now }));
        return complete(b2, 'ok', { snippet });
      },
      (b) => complete(b, 'notfound', { message: 'No snippet exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },

  setKind(input: Record<string, unknown>) {
    const snippet = toStr(input.snippet);
    const kind = toStr(input.kind);

    let p = createProgram();
    p = spGet(p, 'snippet', snippet, 'existing');
    p = branch(p, 'existing',
      (b) => {
        const now = new Date().toISOString();
        let b2 = mergeFrom(b, 'snippet', snippet, () => ({ kind, updatedAt: now }));
        return complete(b2, 'ok', { snippet });
      },
      (b) => complete(b, 'notfound', { message: 'No snippet exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },

  delete(input: Record<string, unknown>) {
    const snippet = toStr(input.snippet);

    let p = createProgram();
    p = spGet(p, 'snippet', snippet, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'snippet', snippet);
        return complete(b2, 'ok', { snippet });
      },
      (b) => complete(b, 'notfound', { message: 'No snippet exists with this identifier' }),
    );
    return p as StorageProgram<Result>;
  },
};

export const snippetHandler = autoInterpret(_snippetHandler);
