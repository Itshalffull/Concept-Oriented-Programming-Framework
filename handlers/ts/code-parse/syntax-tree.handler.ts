// @migrated dsl-constructs 2026-03-18
// ============================================================
// SyntaxTree Handler — Functional (StorageProgram) style
//
// Wraps web-tree-sitter to provide lossless concrete syntax
// trees for any parsed file. Stores tree metadata in
// ConceptStorage and holds live Tree objects in memory for
// query operations.
//
// See design doc Section 4.1 (SyntaxTree).
//
// Note: Live tree caching and file I/O are inherently side-effectful
// operations that occur outside the StorageProgram. The handler uses
// mapBindings for pure transformations and the DSL for all storage
// operations, but tree-sitter parsing is done eagerly before building
// the program since it requires FFI calls.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';
import { readFileSync } from 'fs';
import { createParser, loadLanguage } from './tree-sitter-loader.js';
import type Parser from 'web-tree-sitter';

let treeCounter = 0;
function nextTreeId(): string {
  return `tree-${++treeCounter}`;
}

// In-memory cache of live Tree objects (not JSON-serializable).
// Keyed by tree ID. Used for query and nodeAt operations.
const liveTreeCache = new Map<string, Parser.Tree>();
const parserCache = new Map<string, Parser>();

/**
 * Get a cached parser for a grammar (synchronous lookup only).
 * Parser initialization must happen before handler invocation via
 * the tree-sitter-loader bootstrap. The handler only uses cached parsers.
 */
function getCachedParser(grammarId: string): Parser | null {
  return parserCache.get(grammarId) ?? null;
}

/**
 * Register a pre-initialized parser into the cache.
 * Called by the runtime bootstrap before any handler actions.
 */
export function registerParser(grammarId: string, parser: Parser): void {
  parserCache.set(grammarId, parser);
}

/** Count ERROR nodes in a tree. */
function countErrors(node: Parser.SyntaxNode): number {
  let count = 0;
  if (node.type === 'ERROR' || node.isMissing) count++;
  for (let i = 0; i < node.childCount; i++) {
    count += countErrors(node.child(i)!);
  }
  return count;
}

/** Collect error ranges from a tree. */
function collectErrorRanges(node: Parser.SyntaxNode): Array<{ startByte: number; endByte: number }> {
  const ranges: Array<{ startByte: number; endByte: number }> = [];
  function walk(n: Parser.SyntaxNode) {
    if (n.type === 'ERROR' || n.isMissing) {
      ranges.push({ startByte: n.startIndex, endByte: n.endIndex });
    }
    for (let i = 0; i < n.childCount; i++) {
      walk(n.child(i)!);
    }
  }
  walk(node);
  return ranges;
}

type Result = { variant: string; [key: string]: unknown };

/**
 * Imperative parse action — requires async FFI (tree-sitter WASM loading
 * and parsing), so it cannot be expressed as a pure StorageProgram.
 * When the grammar exists in storage but the parser isn't cached, it
 * attempts to initialize the parser from the WASM path. Tree metadata
 * is stored in the 'tree' relation for later retrieval via get().
 */
async function imperativeParse(
  input: Record<string, unknown>,
  storage: import('../../../runtime/types.ts').ConceptStorage,
): Promise<Result> {
  const file = input.file as string;
  const grammarId = input.grammar as string;

  // Look up grammar metadata in storage
  const grammarData = await storage.get('grammar', grammarId);
  if (!grammarData) {
    return { variant: 'noGrammar', message: `Cannot load parser for grammar ${grammarId}` };
  }

  // Determine file content — check storage first, then filesystem
  let content: string;
  const storedContent = await storage.get('file_content', file) as Record<string, unknown> | null;
  if (storedContent?.content) {
    content = storedContent.content as string;
  } else {
    try {
      content = readFileSync(file, 'utf-8');
    } catch {
      return { variant: 'parseError', errorCount: 0, message: `Cannot read file: ${file}` };
    }
  }

  // Get parser from cache, or try to initialize from WASM path
  let parser = parserCache.get(grammarId);
  if (!parser) {
    const wasmPath = grammarData.parserWasmPath as string;
    try {
      parser = await createParser();
      const language = await loadLanguage(wasmPath);
      parser.setLanguage(language);
      parserCache.set(grammarId, parser);
    } catch {
      return { variant: 'parseError', errorCount: 0, message: `Parser not loaded for grammar ${grammarId}` };
    }
  }

  // Parse the file content
  let tree: Parser.Tree;
  try {
    tree = parser.parse(content);
  } catch (err) {
    return { variant: 'parseError', errorCount: 1, message: `Parser failed: ${err}` };
  }

  const id = nextTreeId();
  const rootSexp = tree.rootNode.toString();
  const byteLength = tree.rootNode.endIndex;
  const errorRanges = collectErrorRanges(tree.rootNode);
  const errorCount = errorRanges.length;

  // Cache the live Tree for queries
  liveTreeCache.set(id, tree);

  // Store tree metadata in storage for later retrieval via get()
  const treeData = {
    id,
    source: file,
    grammar: grammarId,
    rootSexp,
    byteLength,
    editVersion: 1,
    errorRanges: JSON.stringify(errorRanges),
  };
  await storage.put('tree', id, treeData);

  if (errorCount > 0) {
    return { variant: 'parseError', tree: id, errorCount };
  }
  return { variant: 'ok', tree: id };
}

const _syntaxTreeHandler: FunctionalConceptHandler = {
  // parse is handled imperatively — see imperativeParse above.
  // This stub is never called directly; it exists so autoInterpret
  // creates a property for 'parse' that we override below.
  parse(_input: Record<string, unknown>) {
    return createProgram() as StorageProgram<Result>;
  },

  reparse(input: Record<string, unknown>) {
    const treeId = input.tree as string;
    const startByte = input.startByte as number;
    const oldEndByte = input.oldEndByte as number;
    const newEndByte = input.newEndByte as number;
    const newText = input.newText as string;

    let p = createProgram();
    p = get(p, 'tree', treeId, 'existing');
    p = branch(p, 'existing',
      (b) => {
        return completeFrom(b, '_deferred_reparse', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const grammarIdStr = existing.grammar as string;

          let liveTree = liveTreeCache.get(treeId);
          if (!liveTree) {
            const cachedParser = parserCache.get(grammarIdStr);
            if (!cachedParser) {
              return { variant: 'notfound', message: `Cannot reload parser for tree ${treeId}` };
            }
            const content = readFileSync(existing.source as string, 'utf-8');
            liveTree = cachedParser.parse(content);
          }

          // Apply the edit
          liveTree.edit({
            startIndex: startByte,
            oldEndIndex: oldEndByte,
            newEndIndex: newEndByte,
            startPosition: { row: 0, column: startByte },
            oldEndPosition: { row: 0, column: oldEndByte },
            newEndPosition: { row: 0, column: newEndByte },
          });

          const cachedParser = parserCache.get(grammarIdStr);
          if (!cachedParser) {
            return { variant: 'notfound', message: `Cannot reload parser for tree ${treeId}` };
          }

          const oldContent = readFileSync(existing.source as string, 'utf-8');
          const newContent =
            oldContent.substring(0, startByte) + newText + oldContent.substring(oldEndByte);

          const newTree = cachedParser.parse(newContent, liveTree);
          const rootSexp = newTree.rootNode.toString();
          const editVersion = ((existing.editVersion as number) ?? 1) + 1;
          const errorRanges = collectErrorRanges(newTree.rootNode);

          liveTreeCache.set(treeId, newTree);

          return {
            variant: 'ok',
            tree: treeId,
            _treeData: {
              ...existing,
              rootSexp,
              byteLength: newTree.rootNode.endIndex,
              editVersion,
              errorRanges: JSON.stringify(errorRanges),
            },
          };
        });
      },
      (b) => complete(b, 'notfound', { message: `Tree ${treeId} not found` }),
    );

    return p as StorageProgram<Result>;
  },

  query(input: Record<string, unknown>) {
    const treeId = input.tree as string;
    const pattern = input.pattern as string;

    let p = createProgram();
    p = get(p, 'tree', treeId, 'existing');
    p = branch(p, 'existing',
      (b) => {
        return completeFrom(b, '_deferred_query', (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;

          let liveTree = liveTreeCache.get(treeId);
          if (!liveTree) {
            const cachedParser = parserCache.get(existing.grammar as string);
            if (!cachedParser) {
              return { variant: 'notfound', message: `Cannot reload parser for tree ${treeId}` };
            }
            let content: string;
            try {
              content = readFileSync(existing.source as string, 'utf-8');
            } catch {
              return { variant: 'notfound', message: `Cannot read source for tree ${treeId}` };
            }
            liveTree = cachedParser.parse(content);
            liveTreeCache.set(treeId, liveTree);
          }

          try {
            const language = liveTree.getLanguage();
            const q = language.query(pattern);
            const matches = q.matches(liveTree.rootNode);

            const results = matches.map((m) => ({
              pattern: m.pattern,
              captures: m.captures.map((c) => ({
                name: c.name,
                text: c.node.text,
                node_type: c.node.type,
                start_row: c.node.startPosition.row,
                start_col: c.node.startPosition.column,
                end_row: c.node.endPosition.row,
                end_col: c.node.endPosition.column,
              })),
            }));

            return { variant: 'ok', matches: JSON.stringify(results) };
          } catch (err) {
            return { variant: 'invalidPattern', message: String(err) };
          }
        });
      },
      (b) => complete(b, 'notfound', { message: `Tree ${treeId} not found` }),
    );

    return p as StorageProgram<Result>;
  },

  nodeAt(input: Record<string, unknown>) {
    const treeId = input.tree as string;
    const byteOffset = input.byteOffset as number;

    let p = createProgram();
    p = get(p, 'tree', treeId, 'existing');
    p = branch(p, 'existing',
      (b) => {
        return completeFrom(b, '_deferred_nodeAt', (bindings) => {
          const liveTree = liveTreeCache.get(treeId);
          if (!liveTree) {
            return { variant: 'notfound', message: `Tree ${treeId} not in live cache` };
          }

          if (byteOffset < 0 || byteOffset > liveTree.rootNode.endIndex) {
            return { variant: 'outOfRange' };
          }

          // Find the deepest named node at this offset
          let node = liveTree.rootNode.descendantForIndex(byteOffset);
          while (node && !node.isNamed && node.parent) {
            node = node.parent;
          }

          return {
            variant: 'ok',
            nodeType: node.type,
            startByte: node.startIndex,
            endByte: node.endIndex,
            named: String(node.isNamed),
            field: node.parent?.fieldNameForChild?.(node.id) ?? '',
          };
        });
      },
      (b) => complete(b, 'notfound', { message: `Tree ${treeId} not found` }),
    );

    return p as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const treeId = input.tree as string;

    let p = createProgram();
    p = get(p, 'tree', treeId, 'data');
    p = branch(p, 'data',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const data = bindings.data as Record<string, unknown>;
        return {
          tree: treeId,
          source: data.source as string,
          grammar: data.grammar as string,
          byteLength: data.byteLength as number,
          editVersion: data.editVersion as number,
          errorRanges: data.errorRanges as string,
        };
      }),
      (b) => complete(b, 'notfound', { message: `Tree ${treeId} not found` }),
    );

    return p as StorageProgram<Result>;
  },
};

const _autoInterpreted = autoInterpret(_syntaxTreeHandler);

// Override parse with the imperative async implementation that supports
// async parser initialization from WASM and persists tree metadata.
export const syntaxTreeHandler: typeof _autoInterpreted = Object.create(_autoInterpreted, {
  parse: { value: imperativeParse, writable: true, configurable: true, enumerable: true },
});

/** Get a live tree from the cache by ID. Used by DefinitionUnit handler. */
export function getLiveTree(treeId: string): Parser.Tree | undefined {
  return liveTreeCache.get(treeId);
}

/** Clear the in-memory tree and parser caches. Useful for testing. */
export function clearTreeCaches(): void {
  liveTreeCache.clear();
  parserCache.clear();
  treeCounter = 0;
}
