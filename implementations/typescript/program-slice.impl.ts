// ============================================================
// ProgramSlice Handler
//
// Minimal subgraph of the dependence graph preserving behavior
// with respect to a slicing criterion. Identifies the exact set
// of symbols and files relevant to understanding or modifying
// a specific program point.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `program-slice-${++idCounter}`;
}

interface Edge {
  from: string;
  to: string;
  kind: string;
}

/**
 * Walk the dependence graph backward from a criterion to find all
 * contributing symbols (backward slice), or forward to find all
 * affected symbols (forward slice).
 */
async function computeSlice(
  criterion: string,
  direction: 'forward' | 'backward',
  storage: ConceptStorage,
): Promise<{ symbols: string[]; files: string[]; edges: Edge[] }> {
  // Load all dependence graph edges across all graphs
  const allEdgeRecords = await storage.find('dependence-graph-edge', {});

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
      // Backward slice: walk dependencies (criterion depends on what?)
      // adj[criterion] = things criterion depends on (edge: criterion -> dep)
      const outgoing = adj.get(current) ?? [];
      for (const edge of outgoing) {
        traversedEdges.push(edge);
        if (!visited.has(edge.to)) {
          queue.push(edge.to);
        }
      }
    } else {
      // Forward slice: walk dependents (what depends on criterion?)
      // reverseAdj[criterion] = edges where something depends on criterion
      const incoming = reverseAdj.get(current) ?? [];
      for (const edge of incoming) {
        traversedEdges.push(edge);
        if (!visited.has(edge.from)) {
          queue.push(edge.from);
        }
      }
    }
  }

  const symbols = [...visited];

  // Extract file information from symbols
  // Symbol format: "ts/function/src/handlers/article.ts/createArticle"
  // or "copf/state-field/Article/title" or "src/handler.ts"
  const files = new Set<string>();
  for (const sym of symbols) {
    // Look for file-like segments in the symbol
    const parts = sym.split('/');
    for (const part of parts) {
      if (part.endsWith('.ts') || part.endsWith('.tsx') || part.endsWith('.js') ||
          part.endsWith('.jsx') || part.endsWith('.concept') || part.endsWith('.sync') ||
          part.endsWith('.widget') || part.endsWith('.theme')) {
        // Reconstruct file path from parts up to and including this segment
        const idx = parts.indexOf(part);
        // Try to build a reasonable file path
        const fileParts = parts.slice(0, idx + 1).filter(
          (p) => !['ts', 'tsx', 'js', 'copf', 'function', 'class', 'variable', 'type'].includes(p),
        );
        if (fileParts.length > 0) {
          files.add(fileParts.join('/'));
        } else {
          files.add(part);
        }
      }
    }

    // Also check if the symbol itself is a file reference
    if (sym.endsWith('.ts') || sym.endsWith('.tsx') || sym.endsWith('.js') ||
        sym.endsWith('.concept') || sym.endsWith('.sync')) {
      files.add(sym);
    }
  }

  // Also look up file info from the symbol storage
  for (const sym of symbols) {
    const symbolRecords = await storage.find('symbol', { symbolString: sym });
    for (const rec of symbolRecords) {
      if (rec.definingFile) {
        files.add(rec.definingFile as string);
      }
    }
  }

  return {
    symbols,
    files: [...files],
    edges: traversedEdges,
  };
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

export const programSliceHandler: ConceptHandler = {
  async compute(input: Record<string, unknown>, storage: ConceptStorage) {
    const criterion = input.criterion as string;
    const direction = input.direction as string;

    // Validate direction
    const dir = direction === 'forward' ? 'forward' : 'backward';

    const { symbol, location } = parseCriterion(criterion);

    // Check if any dependence data exists
    const edgeRecords = await storage.find('dependence-graph-edge', {});
    const graphRecords = await storage.find('dependence-graph', {});
    if (edgeRecords.length === 0 && graphRecords.length === 0) {
      return {
        variant: 'noDependenceData',
        message: `No dependence graph has been computed for files containing symbol "${symbol}"`,
      };
    }

    // Compute the slice
    const result = await computeSlice(symbol, dir, storage);

    const id = nextId();
    await storage.put('program-slice', id, {
      id,
      criterionSymbol: symbol,
      criterionLocation: location,
      direction: dir,
      includedSymbols: JSON.stringify(result.symbols),
      includedFiles: JSON.stringify(result.files),
      edgeCount: result.edges.length,
      symbolCount: result.symbols.length,
      fileCount: result.files.length,
    });

    return { variant: 'ok', slice: id };
  },

  async filesInSlice(input: Record<string, unknown>, storage: ConceptStorage) {
    const slice = input.slice as string;

    const record = await storage.get('program-slice', slice);
    if (!record) {
      return { variant: 'ok', files: '[]' };
    }

    return { variant: 'ok', files: record.includedFiles as string };
  },

  async symbolsInSlice(input: Record<string, unknown>, storage: ConceptStorage) {
    const slice = input.slice as string;

    const record = await storage.get('program-slice', slice);
    if (!record) {
      return { variant: 'ok', symbols: '[]' };
    }

    return { variant: 'ok', symbols: record.includedSymbols as string };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const slice = input.slice as string;

    const record = await storage.get('program-slice', slice);
    if (!record) {
      return { variant: 'notfound' };
    }

    return {
      variant: 'ok',
      slice: record.id as string,
      criterionSymbol: record.criterionSymbol as string,
      direction: record.direction as string,
      symbolCount: record.symbolCount as number,
      fileCount: record.fileCount as number,
      edgeCount: record.edgeCount as number,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetProgramSliceCounter(): void {
  idCounter = 0;
}
