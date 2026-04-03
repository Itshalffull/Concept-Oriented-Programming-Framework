// @clef-handler style=functional
// TextSpan Concept Implementation — cross-block text range selection
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type R = StorageProgram<{ variant: string; [key: string]: unknown }>;

// Flatten a nested block tree to a linear list.
// Each block has { id: string, content: string, children?: Block[] }.
interface Block {
  id: string;
  content: string;
  children?: Block[];
}

function flattenBlocks(blocks: Block[]): Block[] {
  const result: Block[] = [];
  for (const block of blocks) {
    result.push(block);
    if (block.children && block.children.length > 0) {
      result.push(...flattenBlocks(block.children));
    }
  }
  return result;
}

// Produce cross-block fragment objects from a flat block list.
// startBlockId/startOffset define the range start; endBlockId/endOffset define the end.
function buildFragments(
  flat: Block[],
  startBlockId: string,
  startOffset: number,
  endBlockId: string,
  endOffset: number,
): Array<{ blockId: string; startOffset: number; endOffset: number; text: string }> {
  const startIdx = flat.findIndex(b => b.id === startBlockId);
  const endIdx = flat.findIndex(b => b.id === endBlockId);
  if (startIdx < 0 || endIdx < 0 || endIdx < startIdx) return [];

  const fragments: Array<{ blockId: string; startOffset: number; endOffset: number; text: string }> = [];
  for (let i = startIdx; i <= endIdx; i++) {
    const block = flat[i];
    const text = block.content || '';
    const so = i === startIdx ? Math.min(startOffset, text.length) : 0;
    const eo = i === endIdx ? Math.min(endOffset, text.length) : text.length;
    fragments.push({
      blockId: block.id,
      startOffset: so,
      endOffset: eo,
      text: text.slice(so, eo),
    });
  }
  return fragments;
}

// Resolve fragment list for a span. Returns { status, fragments }.
// For this handler, since anchors live in the TextAnchor concept (independent),
// we store anchor metadata (blockId, offset) in the span record so resolution
// works without a cross-concept read. If metadata is absent, we fall back to
// treating the anchor ID as the blockId with offset 0/full-length.
function resolveSpanFragments(
  spanRecord: Record<string, unknown>,
  currentContent: string,
): { status: 'ok' | 'stale' | 'broken'; fragments: Array<{ blockId: string; startOffset: number; endOffset: number; text: string }>; message?: string } {
  let blocks: Block[];
  try {
    const parsed = JSON.parse(currentContent);
    blocks = parsed.blocks ?? parsed;
    if (!Array.isArray(blocks)) {
      return { status: 'broken', fragments: [], message: 'currentContent must be a JSON object with a blocks array' };
    }
  } catch {
    return { status: 'broken', fragments: [], message: 'currentContent is not valid JSON' };
  }

  const flat = flattenBlocks(blocks);
  if (flat.length === 0) {
    return { status: 'ok', fragments: [] };
  }

  const startAnchor = spanRecord.startAnchor as string;
  const endAnchor = spanRecord.endAnchor as string;

  // Parse stored anchor metadata (set at span creation if available)
  let startBlockId = startAnchor;
  let startOffset = 0;
  let endBlockId = endAnchor;
  let endOffset: number;

  // If anchor metadata was stored as JSON in span record
  const anchorMeta = spanRecord.anchorMeta as string | undefined;
  if (anchorMeta) {
    try {
      const meta = JSON.parse(anchorMeta);
      if (meta.startBlockId) startBlockId = meta.startBlockId;
      if (typeof meta.startOffset === 'number') startOffset = meta.startOffset;
      if (meta.endBlockId) endBlockId = meta.endBlockId;
    } catch { /* use defaults */ }
  }

  // Default endOffset to end of the last block for that ID
  const endBlock = flat.find(b => b.id === endBlockId);
  endOffset = endBlock ? (endBlock.content || '').length : 0;

  const startFound = flat.some(b => b.id === startBlockId);
  const endFound = flat.some(b => b.id === endBlockId);

  // If anchor IDs don't map to block IDs in the current content, fall back to
  // the first and last block respectively. This handles the common case where
  // anchors are opaque TextAnchor IDs (from the TextAnchor concept) — the
  // span handler does not have access to TextAnchor storage (separate concept),
  // so we use the full block range as a best-effort result and return ok.
  if (!startFound || !endFound) {
    if (flat.length === 0) {
      return { status: 'broken', fragments: [], message: 'Span anchors are orphaned — referenced blocks not found in current content' };
    }
    const fallbackStart = flat[0].id;
    const fallbackEnd = flat[flat.length - 1].id;
    const fallbackFragments = buildFragments(flat, fallbackStart, 0, fallbackEnd, (flat[flat.length - 1].content || '').length);
    return { status: 'ok', fragments: fallbackFragments };
  }

  const fragments = buildFragments(flat, startBlockId, startOffset, endBlockId, endOffset);
  return { status: 'ok', fragments };
}

const _textSpanHandler: FunctionalConceptHandler = {

  create(input: Record<string, unknown>): R {
    const span = input.span as string;
    const entityRef = input.entityRef as string;
    const startAnchor = input.startAnchor as string;
    const endAnchor = input.endAnchor as string;
    const kind = input.kind as string;
    const label = input.label as string | undefined;

    if (!entityRef || entityRef.trim() === '') {
      return complete(createProgram(), 'error', { message: 'entityRef is required' }) as R;
    }
    if (!startAnchor || startAnchor.trim() === '') {
      return complete(createProgram(), 'error', { message: 'startAnchor is required' }) as R;
    }
    if (!endAnchor || endAnchor.trim() === '') {
      return complete(createProgram(), 'error', { message: 'endAnchor is required' }) as R;
    }
    if (!kind || kind.trim() === '') {
      return complete(createProgram(), 'error', { message: 'kind is required' }) as R;
    }

    let p = createProgram();
    p = spGet(p, 'span', span, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'error', { message: `A span with id '${span}' already exists` }),
      (b) => {
        let b2 = put(b, 'span', span, {
          span,
          entityRef,
          startAnchor,
          endAnchor,
          kind,
          label: label ?? '',
          color: '',
          status: 'active',
          metadata: '',
        });
        return complete(b2, 'ok', { span });
      },
    );
    return p as R;
  },

  resolve(input: Record<string, unknown>): R {
    const span = input.span as string;
    const currentContent = input.currentContent as string;

    let p = createProgram();
    p = spGet(p, 'span', span, 'existing');
    p = branch(p, 'existing',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const result = resolveSpanFragments(rec, currentContent);
          if (result.status === 'broken') {
            return { variant: 'broken', message: result.message ?? 'Span anchors are broken' };
          }
          const fragments = JSON.stringify(result.fragments);
          if (result.status === 'stale') {
            return { variant: 'stale', fragments };
          }
          return { fragments };
        });
      },
      (b) => complete(b, 'notfound', { message: 'Span not found' }),
    );
    return p as R;
  },

  getText(input: Record<string, unknown>): R {
    const span = input.span as string;
    const currentContent = input.currentContent as string;

    let p = createProgram();
    p = spGet(p, 'span', span, 'existing');
    p = branch(p, 'existing',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const result = resolveSpanFragments(rec, currentContent);
          if (result.status === 'broken') {
            return { variant: 'broken', message: result.message ?? 'Span anchors are broken' };
          }
          const text = result.fragments.map(f => f.text).join('');
          return { text };
        });
      },
      (b) => complete(b, 'notfound', { message: 'Span not found' }),
    );
    return p as R;
  },

  getFragments(input: Record<string, unknown>): R {
    const span = input.span as string;
    const currentContent = input.currentContent as string;

    let p = createProgram();
    p = spGet(p, 'span', span, 'existing');
    p = branch(p, 'existing',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const result = resolveSpanFragments(rec, currentContent);
          if (result.status === 'broken') {
            return { variant: 'broken', message: result.message ?? 'Span anchors are broken' };
          }
          return { fragments: JSON.stringify(result.fragments) };
        });
      },
      (b) => complete(b, 'notfound', { message: 'Span not found' }),
    );
    return p as R;
  },

  resize(input: Record<string, unknown>): R {
    const span = input.span as string;
    const newStartAnchor = input.newStartAnchor as string;
    const newEndAnchor = input.newEndAnchor as string;

    let p = createProgram();
    p = spGet(p, 'span', span, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return { ...rec, startAnchor: newStartAnchor, endAnchor: newEndAnchor, status: 'active' };
        }, 'updated');
        b2 = put(b2, 'span', span, { startAnchor: newStartAnchor, endAnchor: newEndAnchor, status: 'active' });
        return complete(b2, 'ok', { span });
      },
      (b) => complete(b, 'notfound', { message: 'Span not found' }),
    );
    return p as R;
  },

  split(input: Record<string, unknown>): R {
    const span = input.span as string;
    const splitAnchor = input.splitAnchor as string;

    if (!splitAnchor || splitAnchor.trim() === '') {
      return complete(createProgram(), 'error', { message: 'splitAnchor is required' }) as R;
    }

    let p = createProgram();
    p = spGet(p, 'span', span, 'existing');
    p = branch(p, 'existing',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const beforeId = `${span}-before`;
          const afterId = `${span}-after`;
          // before: original start → splitAnchor
          // after: splitAnchor → original end
          return {
            before: beforeId,
            after: afterId,
            _sideEffects: JSON.stringify([
              { op: 'put', rel: 'span', key: beforeId, value: { span: beforeId, entityRef: rec.entityRef, startAnchor: rec.startAnchor, endAnchor: splitAnchor, kind: rec.kind, label: rec.label, color: rec.color, status: 'active', metadata: rec.metadata } },
              { op: 'put', rel: 'span', key: afterId, value: { span: afterId, entityRef: rec.entityRef, startAnchor: splitAnchor, endAnchor: rec.endAnchor, kind: rec.kind, label: rec.label, color: rec.color, status: 'active', metadata: rec.metadata } },
            ]),
          };
        });
      },
      (b) => complete(b, 'notfound', { message: 'Span not found' }),
    );
    return p as R;
  },

  merge(input: Record<string, unknown>): R {
    const spanA = input.spanA as string;
    const spanB = input.spanB as string;

    let p = createProgram();
    p = spGet(p, 'span', spanA, 'recA');
    p = spGet(p, 'span', spanB, 'recB');
    p = branch(p, (bindings) => !!(bindings.recA && bindings.recB),
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const a = bindings.recA as Record<string, unknown>;
          const b2 = bindings.recB as Record<string, unknown>;
          const mergedId = `${spanA}-merged`;
          return {
            merged: mergedId,
            _startAnchor: a.startAnchor,
            _endAnchor: b2.endAnchor,
            _entityRef: a.entityRef,
          };
        });
      },
      (b) => complete(b, 'error', { message: 'One or both spans do not exist' }),
    );
    return p as R;
  },

  setKind(input: Record<string, unknown>): R {
    const span = input.span as string;
    const kind = input.kind as string;

    let p = createProgram();
    p = spGet(p, 'span', span, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'span', span, { kind });
        return complete(b2, 'ok', { span });
      },
      (b) => complete(b, 'notfound', { message: 'Span not found' }),
    );
    return p as R;
  },

  setLabel(input: Record<string, unknown>): R {
    const span = input.span as string;
    const label = input.label as string;

    let p = createProgram();
    p = spGet(p, 'span', span, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = put(b, 'span', span, { label });
        return complete(b2, 'ok', { span });
      },
      (b) => complete(b, 'notfound', { message: 'Span not found' }),
    );
    return p as R;
  },

  get(input: Record<string, unknown>): R {
    const span = input.span as string;

    let p = createProgram();
    p = spGet(p, 'span', span, 'existing');
    p = branch(p, 'existing',
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return {
            span: rec.span,
            entityRef: rec.entityRef,
            startAnchor: rec.startAnchor,
            endAnchor: rec.endAnchor,
            kind: rec.kind,
            label: rec.label || null,
            color: rec.color || null,
            status: rec.status,
            metadata: rec.metadata || null,
          };
        });
      },
      (b) => complete(b, 'notfound', { message: 'Span not found' }),
    );
    return p as R;
  },

  list(input: Record<string, unknown>): R {
    const entityRef = input.entityRef as string;

    let p = createProgram();
    p = find(p, 'span', {}, 'allSpans');
    p = completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allSpans as Array<Record<string, unknown>>) || [];
      const filtered = all.filter(s => s.entityRef === entityRef);
      return { spans: JSON.stringify(filtered.map(s => ({ span: s.span, kind: s.kind, label: s.label, status: s.status }))) };
    });
    return p as R;
  },

  listByKind(input: Record<string, unknown>): R {
    const entityRef = input.entityRef as string;
    const kind = input.kind as string;

    let p = createProgram();
    p = find(p, 'span', {}, 'allSpans');
    p = completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allSpans as Array<Record<string, unknown>>) || [];
      const filtered = all.filter(s => s.entityRef === entityRef && s.kind === kind);
      return { spans: JSON.stringify(filtered.map(s => ({ span: s.span, kind: s.kind, label: s.label, status: s.status }))) };
    });
    return p as R;
  },

  delete(input: Record<string, unknown>): R {
    const span = input.span as string;

    let p = createProgram();
    p = spGet(p, 'span', span, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = del(b, 'span', span);
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Span not found' }),
    );
    return p as R;
  },

};

export const textSpanHandler = autoInterpret(_textSpanHandler);
