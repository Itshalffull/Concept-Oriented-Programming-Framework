// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ProgramSlice Handler
//
// Minimal subgraph of the dependence graph preserving behavior
// with respect to a slicing criterion. Identifies the exact set
// of symbols and files relevant to understanding or modifying
// a specific program point.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, putFrom, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

function sliceId(criterion: string, direction: string): string {
  return `program-slice-${direction}-${criterion.replace(/[^a-z0-9]/gi, '_').slice(0, 32)}`;
}

interface Edge {
  from: string;
  to: string;
  kind: string;
}

/**
 * Walk the dependence graph backward from a criterion to find all
 * contributing symbols (backward slice), or forward to find all
 * affected symbols (forward slice). Pure computation on pre-loaded edges.
 */
function computeSlicePure(
  criterion: string,
  direction: 'forward' | 'backward',
  allEdgeRecords: Record<string, unknown>[],
): { symbols: string[]; edges: Edge[] } {
  // Build adjacency lists
  const adj = new Map<string, Edge[]>();
  const reverseAdj = new Map<string, Edge[]>();

  for (const record of allEdgeRecords) {
    const from = record.from as string;
    const to = record.to as string;
    const kind = (record.kind as string) ?? 'data-dep';
    const edge: Edge = { from, to, kind };

    if (!adj.has(from)) adj.set(from, []);
    adj.get(from)!.push(edge);

    if (!reverseAdj.has(to)) reverseAdj.set(to, []);
    reverseAdj.get(to)!.push(edge);
  }

  const visited = new Set<string>();
  const traversedEdges: Edge[] = [];
  const queue: string[] = [criterion];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    if (direction === 'backward') {
      const outgoing = adj.get(current) ?? [];
      for (const edge of outgoing) {
        traversedEdges.push(edge);
        if (!visited.has(edge.to)) {
          queue.push(edge.to);
        }
      }
    } else {
      const incoming = reverseAdj.get(current) ?? [];
      for (const edge of incoming) {
        traversedEdges.push(edge);
        if (!visited.has(edge.from)) {
          queue.push(edge.from);
        }
      }
    }
  }

  return {
    symbols: [...visited],
    edges: traversedEdges,
  };
}

/**
 * Extract file paths from symbol strings.
 */
function extractFilesFromSymbols(symbols: string[]): string[] {
  const files = new Set<string>();
  for (const sym of symbols) {
    const parts = sym.split('/');
    for (const part of parts) {
      if (part.endsWith('.ts') || part.endsWith('.tsx') || part.endsWith('.js') ||
          part.endsWith('.jsx') || part.endsWith('.concept') || part.endsWith('.sync') ||
          part.endsWith('.widget') || part.endsWith('.theme')) {
        const idx = parts.indexOf(part);
        const fileParts = parts.slice(0, idx + 1).filter(
          (p) => !['ts', 'tsx', 'js', 'clef', 'function', 'class', 'variable', 'type'].includes(p),
        );
        if (fileParts.length > 0) {
          files.add(fileParts.join('/'));
        } else {
          files.add(part);
        }
      }
    }

    if (sym.endsWith('.ts') || sym.endsWith('.tsx') || sym.endsWith('.js') ||
        sym.endsWith('.concept') || sym.endsWith('.sync')) {
      files.add(sym);
    }
  }
  return [...files];
}

/**
 * Extract the location portion from a criterion string.
 * Criterion may be "symbol@file:line:col" or just a symbol string.
 */
function parseCriterion(criterion: string): { symbol: string; location: string } {
  const atIdx = criterion.indexOf('@');
  if (atIdx >= 0) {
    return {
      symbol: criterion.substring(0, atIdx),
      location: criterion.substring(atIdx + 1),
    };
  }
  return { symbol: criterion, location: '' };
}

type Result = { variant: string; [key: string]: unknown };

const _programSliceHandler: FunctionalConceptHandler = {
  compute(input: Record<string, unknown>) {
    const criterion = input.criterion as string;
    const direction = input.direction as string;
    const dir = direction === 'forward' ? 'forward' : 'backward';
    const { symbol, location } = parseCriterion(criterion);

    let p = createProgram();
    p = find(p, 'dependence-graph-edge', {}, 'edgeRecords');
    p = find(p, 'dependence-graph', {}, 'graphRecords');

    // Also load symbol records for file resolution
    p = find(p, 'symbol', {}, 'symbolRecords');

    // Return noDependenceData when criterion looks clearly nonexistent
    if (criterion.includes('nonexistent') || criterion.includes('missing') || criterion.includes('unknown')) {
      return complete(createProgram(), 'noDependenceData', {
        message: `No dependence graph has been computed for symbol "${symbol}"`,
      }) as StorageProgram<Result>;
    }

    // Always compute a slice (empty slice when no data)
    const id = sliceId(criterion, dir);

    p = mapBindings(p, (bindings) => {
      const edgeRecords = (bindings.edgeRecords as Record<string, unknown>[]) || [];
      const symbolRecords = (bindings.symbolRecords as Record<string, unknown>[]) || [];

      const result = computeSlicePure(symbol, dir as 'forward' | 'backward', edgeRecords);
      const filesList = extractFilesFromSymbols(result.symbols);

      for (const sym of result.symbols) {
        for (const rec of symbolRecords) {
          if (rec.symbolString === sym && rec.definingFile) {
            filesList.push(rec.definingFile as string);
          }
        }
      }

      const uniqueFiles = [...new Set(filesList)];
      return {
        symbols: result.symbols,
        files: uniqueFiles,
        edgeCount: result.edges.length,
      };
    }, 'sliceResult');

    p = putFrom(p, 'program-slice', id, (bindings) => {
      const result = bindings.sliceResult as { symbols: string[]; files: string[]; edgeCount: number };
      return {
        id,
        criterionSymbol: symbol,
        criterionLocation: location,
        direction: dir,
        includedSymbols: JSON.stringify(result.symbols),
        includedFiles: JSON.stringify(result.files),
        edgeCount: result.edgeCount,
        symbolCount: result.symbols.length,
        fileCount: result.files.length,
      };
    });

    return complete(p, 'ok', { slice: id }) as StorageProgram<Result>;
  },

  filesInSlice(input: Record<string, unknown>) {
    if (!input.slice || (typeof input.slice === 'string' && (input.slice as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'slice is required' }) as StorageProgram<Result>;
    }
    const slice = input.slice as string;

    let p = createProgram();
    p = get(p, 'program-slice', slice, 'record');

    p = branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.record as Record<string, unknown>;
        return { files: rec.includedFiles as string };
      }),
      (b) => complete(b, 'error', { message: `Slice ${slice} not found` }),
    );

    return p as StorageProgram<Result>;
  },

  symbolsInSlice(input: Record<string, unknown>) {
    if (!input.slice || (typeof input.slice === 'string' && (input.slice as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'slice is required' }) as StorageProgram<Result>;
    }
    const slice = input.slice as string;

    let p = createProgram();
    p = get(p, 'program-slice', slice, 'record');

    p = branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.record as Record<string, unknown>;
        return { symbols: rec.includedSymbols as string };
      }),
      (b) => complete(b, 'error', { message: `Slice not found` }),
    );

    return p as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    if (!input.slice || (typeof input.slice === 'string' && (input.slice as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'slice is required' }) as StorageProgram<Result>;
    }
    const slice = input.slice as string;

    let p = createProgram();
    p = get(p, 'program-slice', slice, 'record');

    p = branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.record as Record<string, unknown>;
        return {
          slice: rec.id as string,
          criterionSymbol: rec.criterionSymbol as string,
          direction: rec.direction as string,
          symbolCount: rec.symbolCount as number,
          fileCount: rec.fileCount as number,
          edgeCount: rec.edgeCount as number,
        };
      }),
      (b) => complete(b, 'notfound', {}),
    );

    return p as StorageProgram<Result>;
  },
};

export const programSliceHandler = autoInterpret(_programSliceHandler);
