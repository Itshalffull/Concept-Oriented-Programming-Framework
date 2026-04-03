// @clef-handler style=functional concept=FilterRepresentation
// FilterRepresentation Concept Implementation — Functional (StorageProgram) style
//
// Coordination concept: registry and dispatcher for bidirectional conversion
// between authoring representations and canonical FilterNode IR.
// Delegates parse/print/canPrint to registered provider modules by kind.
// See architecture doc Section 10.1 (ConceptManifest IR) for filter patterns.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

// Provider modules — each exports parse(), print(), canPrint(), and kind
import * as toggleGroupProvider from './providers/toggle-group-provider.ts';
import * as urlParamsProvider from './providers/url-params-provider.ts';
import * as contextualProvider from './providers/contextual-provider.ts';

type Result = { variant: string; [key: string]: unknown };

// ─── Provider dispatch helpers ─────────────────────────────────────────────

type Provider = {
  parse: (repr: string) => unknown;
  print: (node: unknown) => string | null;
  canPrint: (node: unknown) => boolean;
  kind: string;
};

// Built-in provider map — kind string → provider module
const PROVIDERS: Record<string, Provider> = {
  [toggleGroupProvider.kind]: toggleGroupProvider as Provider,
  [urlParamsProvider.kind]: urlParamsProvider as Provider,
  [contextualProvider.kind]: contextualProvider as Provider,
};

/** Coerce a raw value that may already be a parsed object to a JSON string. */
function toJsonString(value: unknown): string {
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

/** Parse a JSON string (or already-parsed object) to an unknown node value. */
function parseJsonNode(raw: unknown): { ok: true; node: unknown } | { ok: false; message: string } {
  if (typeof raw === 'string') {
    try {
      return { ok: true, node: JSON.parse(raw) };
    } catch {
      return { ok: false, message: 'tree is not valid JSON' };
    }
  }
  // Already a parsed object (from fixture runner)
  return { ok: true, node: raw };
}

function dispatchParse(
  kind: string,
  repr: unknown,
): { ok: true; tree: string } | { ok: false; message: string } {
  const provider = PROVIDERS[kind];
  if (!provider) {
    return { ok: false, message: `Kind "${kind}" is not registered` };
  }
  // If repr is already a parsed object, serialize it back to a JSON string so the
  // provider's parse() (which calls JSON.parse internally) can handle it correctly.
  const reprStr = toJsonString(repr ?? '');
  try {
    const node = provider.parse(reprStr);
    return { ok: true, tree: JSON.stringify(node) };
  } catch (err) {
    return { ok: false, message: `Parse failed: ${String(err)}` };
  }
}

function dispatchPrint(
  kind: string,
  treeRaw: unknown,
): { ok: true; repr: string } | { ok: false; message: string } {
  const provider = PROVIDERS[kind];
  if (!provider) {
    return { ok: false, message: `Kind "${kind}" is not registered` };
  }
  const parsed = parseJsonNode(treeRaw ?? '');
  if (!parsed.ok) return parsed;
  const repr = provider.print(parsed.node);
  if (repr === null) {
    return { ok: false, message: `Kind "${kind}" cannot represent this FilterNode tree` };
  }
  return { ok: true, repr };
}

function dispatchCanPrint(
  kind: string,
  treeRaw: unknown,
): { ok: true; supported: boolean } | { ok: false; message: string } {
  const provider = PROVIDERS[kind];
  if (!provider) {
    return { ok: false, message: `Kind "${kind}" is not registered` };
  }
  const parsed = parseJsonNode(treeRaw ?? '');
  if (!parsed.ok) return parsed;
  return { ok: true, supported: provider.canPrint(parsed.node) };
}

// ─── Handler ───────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  registerKind(input: Record<string, unknown>) {
    const kind = input.kind as string;

    if (!kind || (typeof kind === 'string' && kind.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'kind is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'registeredKind', kind, 'existing');
    return branch(p,
      (b) => b.existing != null,
      (b) => complete(b, 'duplicate', { kind }),
      (b) => {
        const b2 = put(b, 'registeredKind', kind, { kind });
        return complete(b2, 'ok', { kind });
      },
    ) as StorageProgram<Result>;
  },

  register(input: Record<string, unknown>) {
    const name = input.name as string;
    const kind = input.kind as string;

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'registeredKind', kind, 'kindRecord');
    p = get(p, 'representation', name, 'existing');

    return branch(p,
      (b) => b.kindRecord == null,
      (b) => complete(b, 'error', { message: `Kind "${kind}" has not been registered` }),
      (b) => branch(b,
        (bb) => bb.existing != null,
        (bb) => completeFrom(bb, 'duplicate', (bindings) => ({
          representation: (bindings.existing as Record<string, unknown>).name as string,
        })),
        (bb) => {
          const b2 = put(bb, 'representation', name, { name, kind });
          return complete(b2, 'ok', { representation: name });
        },
      ),
    ) as StorageProgram<Result>;
  },

  parse(input: Record<string, unknown>) {
    const repr = input.repr;
    const kind = input.kind as string;

    if (!kind || (typeof kind === 'string' && kind.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'kind is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'registeredKind', kind, 'kindRecord');

    return branch(p,
      (b) => b.kindRecord == null,
      (b) => complete(b, 'error', { message: `Kind "${kind}" is not registered` }),
      (b) => {
        const p2 = mapBindings(b, (_bindings) => dispatchParse(kind, repr ?? ''), '_parseResult');
        return branch(p2,
          (bb) => !(bb._parseResult as { ok: boolean }).ok,
          (bb) => completeFrom(bb, 'error', (bindings) => ({
            message: (bindings._parseResult as { ok: false; message: string }).message,
          })),
          (bb) => completeFrom(bb, 'ok', (bindings) => ({
            tree: (bindings._parseResult as { ok: true; tree: string }).tree,
          })),
        );
      },
    ) as StorageProgram<Result>;
  },

  print(input: Record<string, unknown>) {
    const tree = input.tree;
    const kind = input.kind as string;

    if (!kind || (typeof kind === 'string' && kind.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'kind is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'registeredKind', kind, 'kindRecord');

    return branch(p,
      (b) => b.kindRecord == null,
      (b) => complete(b, 'error', { message: `Kind "${kind}" is not registered` }),
      (b) => {
        const p2 = mapBindings(b, (_bindings) => dispatchPrint(kind, tree ?? ''), '_printResult');
        return branch(p2,
          (bb) => !(bb._printResult as { ok: boolean }).ok,
          (bb) => completeFrom(bb, 'error', (bindings) => ({
            message: (bindings._printResult as { ok: false; message: string }).message,
          })),
          (bb) => completeFrom(bb, 'ok', (bindings) => ({
            repr: (bindings._printResult as { ok: true; repr: string }).repr,
          })),
        );
      },
    ) as StorageProgram<Result>;
  },

  canPrint(input: Record<string, unknown>) {
    const tree = input.tree;
    const kind = input.kind as string;

    if (!kind || (typeof kind === 'string' && kind.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'kind is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'registeredKind', kind, 'kindRecord');

    return branch(p,
      (b) => b.kindRecord == null,
      (b) => complete(b, 'error', { message: `Kind "${kind}" is not registered` }),
      (b) => {
        const p2 = mapBindings(b, (_bindings) => dispatchCanPrint(kind, tree ?? ''), '_canPrintResult');
        return branch(p2,
          (bb) => !(bb._canPrintResult as { ok: boolean }).ok,
          (bb) => completeFrom(bb, 'error', (bindings) => ({
            message: (bindings._canPrintResult as { ok: false; message: string }).message,
          })),
          (bb) => completeFrom(bb, 'ok', (bindings) => ({
            supported: (bindings._canPrintResult as { ok: true; supported: boolean }).supported,
          })),
        );
      },
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'representation', {}, 'allRepresentations');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allRepresentations ?? []) as Array<Record<string, unknown>>;
      const representations = all.map(r => ({
        name: r.name,
        kind: r.kind,
      }));
      return { representations: JSON.stringify(representations) };
    }) as StorageProgram<Result>;
  },
};

export const filterRepresentationHandler = autoInterpret(_handler);
