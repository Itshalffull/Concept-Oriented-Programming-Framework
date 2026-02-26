// ============================================================
// SyntaxTree Handler
//
// Wraps web-tree-sitter to provide lossless concrete syntax
// trees for any parsed file. Stores tree metadata in
// ConceptStorage and holds live Tree objects in memory for
// query operations.
//
// See design doc Section 4.1 (SyntaxTree).
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../../../runtime/types.js';
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

/** Get or create a parser for a grammar. */
async function getParser(grammarId: string, storage: ConceptStorage): Promise<Parser | null> {
  if (parserCache.has(grammarId)) return parserCache.get(grammarId)!;

  const grammarData = await storage.get('grammar', grammarId);
  if (!grammarData) return null;

  const wasmPath = grammarData.parserWasmPath as string;
  try {
    const language = await loadLanguage(wasmPath);
    const parser = await createParser();
    parser.setLanguage(language);
    parserCache.set(grammarId, parser);
    return parser;
  } catch {
    return null;
  }
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

export const syntaxTreeHandler: ConceptHandler = {
  async parse(input: Record<string, unknown>, storage: ConceptStorage) {
    const file = input.file as string;
    const grammarId = input.grammar as string;

    const parser = await getParser(grammarId, storage);
    if (!parser) {
      return { variant: 'noGrammar', message: `Cannot load parser for grammar ${grammarId}` };
    }

    // Read file content — try storage first, then filesystem
    let content: string;
    const stored = await storage.get('file_content', file);
    if (stored?.content) {
      content = stored.content as string;
    } else {
      try {
        content = readFileSync(file, 'utf-8');
      } catch {
        return { variant: 'noGrammar', message: `Cannot read file: ${file}` };
      }
    }

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

    // Store metadata in ConceptStorage
    await storage.put('tree', id, {
      id,
      source: file,
      grammar: grammarId,
      rootSexp,
      byteLength,
      editVersion: 1,
      errorRanges: JSON.stringify(errorRanges),
    });

    // Cache the live Tree for queries
    liveTreeCache.set(id, tree);

    if (errorCount > 0) {
      return { variant: 'parseError', tree: id, errorCount };
    }
    return { variant: 'ok', tree: id };
  },

  async reparse(input: Record<string, unknown>, storage: ConceptStorage) {
    const treeId = input.tree as string;
    const startByte = input.startByte as number;
    const oldEndByte = input.oldEndByte as number;
    const newEndByte = input.newEndByte as number;
    const newText = input.newText as string;

    const existing = await storage.get('tree', treeId);
    if (!existing) {
      return { variant: 'notfound', message: `Tree ${treeId} not found` };
    }

    let liveTree = liveTreeCache.get(treeId);
    if (!liveTree) {
      // Re-parse from source to rebuild the live tree
      const parser = await getParser(existing.grammar as string, storage);
      if (!parser) {
        return { variant: 'notfound', message: `Cannot reload parser for tree ${treeId}` };
      }
      const content = readFileSync(existing.source as string, 'utf-8');
      liveTree = parser.parse(content);
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

    // Re-parse with the edit applied
    const parser = await getParser(existing.grammar as string, storage);
    if (!parser) {
      return { variant: 'notfound', message: `Cannot reload parser for tree ${treeId}` };
    }

    // Reconstruct the new source
    const oldContent = readFileSync(existing.source as string, 'utf-8');
    const newContent =
      oldContent.substring(0, startByte) + newText + oldContent.substring(oldEndByte);

    const newTree = parser.parse(newContent, liveTree);
    const rootSexp = newTree.rootNode.toString();
    const editVersion = ((existing.editVersion as number) ?? 1) + 1;
    const errorRanges = collectErrorRanges(newTree.rootNode);

    await storage.put('tree', treeId, {
      ...existing,
      rootSexp,
      byteLength: newTree.rootNode.endIndex,
      editVersion,
      errorRanges: JSON.stringify(errorRanges),
    });

    liveTreeCache.set(treeId, newTree);
    return { variant: 'ok', tree: treeId };
  },

  async query(input: Record<string, unknown>, storage: ConceptStorage) {
    const treeId = input.tree as string;
    const pattern = input.pattern as string;

    const existing = await storage.get('tree', treeId);
    if (!existing) {
      return { variant: 'notfound', message: `Tree ${treeId} not found` };
    }

    let liveTree = liveTreeCache.get(treeId);
    if (!liveTree) {
      // Re-parse from source to rebuild
      const parser = await getParser(existing.grammar as string, storage);
      if (!parser) {
        return { variant: 'notfound', message: `Cannot reload parser for tree ${treeId}` };
      }
      let content: string;
      const stored = await storage.get('file_content', existing.source as string);
      if (stored?.content) {
        content = stored.content as string;
      } else {
        content = readFileSync(existing.source as string, 'utf-8');
      }
      liveTree = parser.parse(content);
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
  },

  async nodeAt(input: Record<string, unknown>, storage: ConceptStorage) {
    const treeId = input.tree as string;
    const byteOffset = input.byteOffset as number;

    const existing = await storage.get('tree', treeId);
    if (!existing) {
      return { variant: 'notfound', message: `Tree ${treeId} not found` };
    }

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
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const treeId = input.tree as string;
    const data = await storage.get('tree', treeId);
    if (!data) {
      return { variant: 'notfound', message: `Tree ${treeId} not found` };
    }
    return {
      variant: 'ok',
      tree: treeId,
      source: data.source as string,
      grammar: data.grammar as string,
      byteLength: data.byteLength as number,
      editVersion: data.editVersion as number,
      errorRanges: data.errorRanges as string,
    };
  },
};

/** Clear the in-memory tree and parser caches. Useful for testing. */
export function clearTreeCaches(): void {
  liveTreeCache.clear();
  parserCache.clear();
  treeCounter = 0;
}
