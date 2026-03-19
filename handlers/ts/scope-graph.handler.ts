// ============================================================
// ScopeGraph Handler
//
// Lexical scoping, visibility, and name resolution model for a
// file or module. Models nested scopes, declarations, references,
// and import edges to support cross-file resolution and rename
// refactoring.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `scope-graph-${++idCounter}`;
}

let scopeCounter = 0;
function nextScopeId(): string {
  return `scope-${++scopeCounter}`;
}

/** Internal scope node structure serialized into the graph. */
interface ScopeNode {
  id: string;
  kind: string;       // "global" | "module" | "function" | "block" | "class"
  name: string;
  parentId: string | null;
}

/** Declaration within a scope. */
interface Declaration {
  name: string;
  symbolString: string;
  scopeId: string;
  kind: string;
}

/** Reference to a name within a scope. */
interface Reference {
  name: string;
  scopeId: string;
  resolved: string | null; // resolved symbol string, or null if unresolved
}

/** Import edge connecting an external symbol to a scope. */
interface ImportEdge {
  importedName: string;
  fromModule: string;
  scopeId: string;
  resolvedSymbol: string | null;
}

/**
 * Build a basic scope graph from a JSON-encoded syntax tree.
 * The tree is expected to be a JSON object with a "language" field
 * and optional "nodes" array describing the structure.
 */
function buildScopeGraphFromTree(
  file: string,
  treeJson: string,
): {
  scopes: ScopeNode[];
  declarations: Declaration[];
  references: Reference[];
  importEdges: ImportEdge[];
  language: string;
} {
  let tree: Record<string, unknown>;
  try {
    tree = JSON.parse(treeJson);
  } catch {
    // If tree is not valid JSON, build a minimal global scope
    return {
      scopes: [{ id: nextScopeId(), kind: 'global', name: file, parentId: null }],
      declarations: [],
      references: [],
      importEdges: [],
      language: 'unknown',
    };
  }

  const language = (tree.language as string) || 'unknown';
  const nodes = (tree.nodes as Array<Record<string, unknown>>) || [];

  const scopes: ScopeNode[] = [];
  const declarations: Declaration[] = [];
  const references: Reference[] = [];
  const importEdges: ImportEdge[] = [];

  // Create global/module scope
  const globalScope: ScopeNode = {
    id: nextScopeId(),
    kind: 'module',
    name: file,
    parentId: null,
  };
  scopes.push(globalScope);

  // Process nodes from the tree
  for (const node of nodes) {
    const nodeType = node.type as string;
    const nodeName = node.name as string;

    if (nodeType === 'scope') {
      const scopeNode: ScopeNode = {
        id: nextScopeId(),
        kind: (node.scopeKind as string) || 'block',
        name: nodeName || '',
        parentId: (node.parentScope as string) || globalScope.id,
      };
      scopes.push(scopeNode);
    } else if (nodeType === 'declaration') {
      declarations.push({
        name: nodeName,
        symbolString: (node.symbolString as string) || '',
        scopeId: (node.scopeId as string) || globalScope.id,
        kind: (node.declKind as string) || 'variable',
      });
    } else if (nodeType === 'reference') {
      references.push({
        name: nodeName,
        scopeId: (node.scopeId as string) || globalScope.id,
        resolved: (node.resolved as string) || null,
      });
    } else if (nodeType === 'import') {
      importEdges.push({
        importedName: nodeName,
        fromModule: (node.fromModule as string) || '',
        scopeId: (node.scopeId as string) || globalScope.id,
        resolvedSymbol: (node.resolvedSymbol as string) || null,
      });
    }
  }

  return { scopes, declarations, references, importEdges, language };
}

/**
 * Resolve a name by walking up the scope chain from a given scope.
 */
function resolveInScopeChain(
  name: string,
  scopeId: string,
  scopes: ScopeNode[],
  declarations: Declaration[],
  importEdges: ImportEdge[],
): { resolved: string | null; candidates: string[] } {
  const scopeMap = new Map<string, ScopeNode>();
  for (const s of scopes) scopeMap.set(s.id, s);

  const candidates: string[] = [];
  let currentScopeId: string | null = scopeId;

  while (currentScopeId) {
    // Check declarations in this scope
    const scopeDecls = declarations.filter(
      (d) => d.scopeId === currentScopeId && d.name === name,
    );
    if (scopeDecls.length === 1) {
      return { resolved: scopeDecls[0].symbolString, candidates: [] };
    }
    if (scopeDecls.length > 1) {
      return {
        resolved: null,
        candidates: scopeDecls.map((d) => d.symbolString),
      };
    }

    // Check import edges in this scope
    const scopeImports = importEdges.filter(
      (e) => e.scopeId === currentScopeId && e.importedName === name,
    );
    if (scopeImports.length === 1 && scopeImports[0].resolvedSymbol) {
      return { resolved: scopeImports[0].resolvedSymbol, candidates: [] };
    }
    if (scopeImports.length > 0) {
      for (const imp of scopeImports) {
        if (imp.resolvedSymbol) candidates.push(imp.resolvedSymbol);
      }
    }

    // Walk up to parent scope
    const currentScope = scopeMap.get(currentScopeId);
    currentScopeId = currentScope?.parentId || null;
  }

  return { resolved: null, candidates };
}

export const scopeGraphHandler: ConceptHandler = {
  async build(input: Record<string, unknown>, storage: ConceptStorage) {
    const file = input.file as string;
    const tree = input.tree as string;

    const result = buildScopeGraphFromTree(file, tree);

    // Check for unsupported language
    if (result.language === 'unknown' && result.scopes.length <= 1 && result.declarations.length === 0) {
      // Still store a minimal graph but note it might be unsupported
    }

    const id = nextId();
    const unresolvedCount = result.references.filter((r) => !r.resolved).length;

    await storage.put('scope-graph', id, {
      id,
      file,
      scopes: JSON.stringify(result.scopes),
      declarations: JSON.stringify(result.declarations),
      references: JSON.stringify(result.references),
      importEdges: JSON.stringify(result.importEdges),
      scopeCount: result.scopes.length,
      declarationCount: result.declarations.length,
      unresolvedCount,
      language: result.language,
    });

    return { variant: 'ok', graph: id };
  },

  async resolveReference(input: Record<string, unknown>, storage: ConceptStorage) {
    const graph = input.graph as string;
    const scope = input.scope as string;
    const name = input.name as string;

    const record = await storage.get('scope-graph', graph);
    if (!record) {
      return { variant: 'unresolved', candidates: '[]' };
    }

    const scopes: ScopeNode[] = JSON.parse(record.scopes as string);
    const declarations: Declaration[] = JSON.parse(record.declarations as string);
    const importEdges: ImportEdge[] = JSON.parse(record.importEdges as string);

    const result = resolveInScopeChain(name, scope, scopes, declarations, importEdges);

    if (result.resolved) {
      return { variant: 'ok', symbol: result.resolved };
    }

    if (result.candidates.length > 1) {
      return { variant: 'ambiguous', symbols: JSON.stringify(result.candidates) };
    }

    return { variant: 'unresolved', candidates: JSON.stringify(result.candidates) };
  },

  async visibleSymbols(input: Record<string, unknown>, storage: ConceptStorage) {
    const graph = input.graph as string;
    const scope = input.scope as string;

    const record = await storage.get('scope-graph', graph);
    if (!record) {
      return { variant: 'ok', symbols: '[]' };
    }

    const scopes: ScopeNode[] = JSON.parse(record.scopes as string);
    const declarations: Declaration[] = JSON.parse(record.declarations as string);
    const importEdges: ImportEdge[] = JSON.parse(record.importEdges as string);

    const scopeMap = new Map<string, ScopeNode>();
    for (const s of scopes) scopeMap.set(s.id, s);

    // Collect all visible symbols by walking up the scope chain
    const visible: Array<{ name: string; symbolString: string; kind: string; fromScope: string }> = [];
    const seen = new Set<string>();
    let currentScopeId: string | null = scope;

    while (currentScopeId) {
      // Declarations in this scope
      const scopeDecls = declarations.filter((d) => d.scopeId === currentScopeId);
      for (const d of scopeDecls) {
        if (!seen.has(d.name)) {
          seen.add(d.name);
          visible.push({
            name: d.name,
            symbolString: d.symbolString,
            kind: d.kind,
            fromScope: currentScopeId,
          });
        }
      }

      // Import edges in this scope
      const scopeImports = importEdges.filter((e) => e.scopeId === currentScopeId);
      for (const imp of scopeImports) {
        if (!seen.has(imp.importedName)) {
          seen.add(imp.importedName);
          visible.push({
            name: imp.importedName,
            symbolString: imp.resolvedSymbol || `imported:${imp.fromModule}/${imp.importedName}`,
            kind: 'import',
            fromScope: currentScopeId,
          });
        }
      }

      // Walk up to parent
      const currentScope = scopeMap.get(currentScopeId);
      currentScopeId = currentScope?.parentId || null;
    }

    return { variant: 'ok', symbols: JSON.stringify(visible) };
  },

  async resolveCrossFile(input: Record<string, unknown>, storage: ConceptStorage) {
    const graph = input.graph as string;

    const record = await storage.get('scope-graph', graph);
    if (!record) {
      return { variant: 'noUnresolved' };
    }

    const references: Reference[] = JSON.parse(record.references as string);
    const importEdges: ImportEdge[] = JSON.parse(record.importEdges as string);

    const unresolved = references.filter((r) => !r.resolved);
    if (unresolved.length === 0) {
      return { variant: 'noUnresolved' };
    }

    // Try to resolve unresolved references by looking at other scope graphs
    const allGraphs = await storage.find('scope-graph');
    let resolvedCount = 0;

    for (const ref of unresolved) {
      for (const otherGraph of allGraphs) {
        if (otherGraph.id === graph) continue;

        const otherDecls: Declaration[] = JSON.parse(otherGraph.declarations as string);
        // Look for exported declarations matching the reference name
        const match = otherDecls.find((d) => d.name === ref.name);
        if (match) {
          ref.resolved = match.symbolString;
          resolvedCount++;
          break;
        }
      }
    }

    // Update the stored references
    const newUnresolvedCount = references.filter((r) => !r.resolved).length;
    await storage.put('scope-graph', graph, {
      ...record,
      references: JSON.stringify(references),
      unresolvedCount: newUnresolvedCount,
    });

    return { variant: 'ok', resolvedCount };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const graph = input.graph as string;

    const record = await storage.get('scope-graph', graph);
    if (!record) {
      return { variant: 'notfound' };
    }

    return {
      variant: 'ok',
      graph: record.id as string,
      file: record.file as string,
      scopeCount: record.scopeCount as number,
      declarationCount: record.declarationCount as number,
      unresolvedCount: record.unresolvedCount as number,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetScopeGraphCounter(): void {
  idCounter = 0;
  scopeCounter = 0;
}
