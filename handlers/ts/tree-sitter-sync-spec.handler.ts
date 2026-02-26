// ============================================================
// TreeSitterSyncSpec Handler
//
// Tree-sitter grammar provider for Clef sync spec files. Uses
// line-based parsing as an approximation for .sync files until
// a custom Tree-sitter grammar is available.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `tree-sitter-sync-spec-${++idCounter}`;
}

/** Storage relation name for this concept. */
const RELATION = 'tree-sitter-sync-spec';

// --- AST node types for sync-spec grammar ---

interface ParseNode {
  type: string;
  text: string;
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  children: ParseNode[];
}

/**
 * Parse sync-spec source into a simplified AST.
 * Detects: sync declarations, when/where/then blocks, annotations,
 * concept references, action patterns, variable bindings.
 */
function parseSyncSpec(source: string): ParseNode {
  const root: ParseNode = {
    type: 'source_file',
    text: source,
    startLine: 0,
    startCol: 0,
    endLine: 0,
    endCol: 0,
    children: [],
  };

  const lines = source.split('\n');
  root.endLine = lines.length - 1;
  root.endCol = (lines[lines.length - 1] ?? '').length;

  let currentSync: ParseNode | null = null;
  let currentBlock: ParseNode | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Annotations: @priority, @idempotent, etc.
    const annoMatch = line.match(/^\s*(@\w+(?:\(.*?\))?)/);
    if (annoMatch) {
      root.children.push({
        type: 'annotation',
        text: annoMatch[1],
        startLine: i,
        startCol: line.indexOf('@'),
        endLine: i,
        endCol: line.indexOf('@') + annoMatch[1].length,
        children: [],
      });
      continue;
    }

    // Sync declaration: sync SyncName {
    const syncMatch = line.match(/^\s*sync\s+(\w+)\s*\{/);
    if (syncMatch) {
      currentSync = {
        type: 'sync_declaration',
        text: syncMatch[0].trim(),
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [
          {
            type: 'sync_name',
            text: syncMatch[1],
            startLine: i,
            startCol: line.indexOf(syncMatch[1]),
            endLine: i,
            endCol: line.indexOf(syncMatch[1]) + syncMatch[1].length,
            children: [],
          },
        ],
      };
      root.children.push(currentSync);
      currentBlock = null;
      continue;
    }

    // Block headers: when, where, then
    const blockMatch = line.match(/^\s+(when|where|then)\s*\{/);
    if (blockMatch && currentSync) {
      currentBlock = {
        type: `${blockMatch[1]}_block`,
        text: blockMatch[1],
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [],
      };
      currentSync.children.push(currentBlock);
      continue;
    }

    // When clause: ConceptName.actionName(field: $var) -> variant(field: $var)
    const whenClauseMatch = line.match(/^\s+(\w+)\.(\w+)\s*\(([^)]*)\)\s*(?:->\s*(\w+)\s*\(([^)]*)\))?/);
    if (whenClauseMatch && currentBlock?.type === 'when_block') {
      const clause: ParseNode = {
        type: 'when_clause',
        text: whenClauseMatch[0].trim(),
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [
          {
            type: 'concept_ref',
            text: whenClauseMatch[1],
            startLine: i,
            startCol: line.indexOf(whenClauseMatch[1]),
            endLine: i,
            endCol: line.indexOf(whenClauseMatch[1]) + whenClauseMatch[1].length,
            children: [],
          },
          {
            type: 'action_ref',
            text: whenClauseMatch[2],
            startLine: i,
            startCol: line.indexOf(whenClauseMatch[2], line.indexOf('.')),
            endLine: i,
            endCol: line.indexOf(whenClauseMatch[2], line.indexOf('.')) + whenClauseMatch[2].length,
            children: [],
          },
        ],
      };

      // Parse input field bindings
      if (whenClauseMatch[3]?.trim()) {
        for (const binding of whenClauseMatch[3].split(',')) {
          const trimmed = binding.trim();
          if (trimmed) {
            clause.children.push({
              type: 'field_binding',
              text: trimmed,
              startLine: i,
              startCol: line.indexOf(trimmed),
              endLine: i,
              endCol: line.indexOf(trimmed) + trimmed.length,
              children: [],
            });
          }
        }
      }

      // Parse variant and output fields
      if (whenClauseMatch[4]) {
        clause.children.push({
          type: 'variant_ref',
          text: whenClauseMatch[4],
          startLine: i,
          startCol: line.indexOf(whenClauseMatch[4], line.indexOf('->')),
          endLine: i,
          endCol: line.indexOf(whenClauseMatch[4], line.indexOf('->')) + whenClauseMatch[4].length,
          children: [],
        });
      }

      currentBlock.children.push(clause);
      continue;
    }

    // Where clause: let $var = expr  or  filter expr  or  query Concept { ... }
    if (currentBlock?.type === 'where_block') {
      const letMatch = line.match(/^\s+let\s+(\$\w+)\s*=\s*(.+)/);
      if (letMatch) {
        currentBlock.children.push({
          type: 'where_bind',
          text: letMatch[0].trim(),
          startLine: i,
          startCol: line.search(/\S/),
          endLine: i,
          endCol: line.length,
          children: [
            {
              type: 'variable',
              text: letMatch[1],
              startLine: i,
              startCol: line.indexOf(letMatch[1]),
              endLine: i,
              endCol: line.indexOf(letMatch[1]) + letMatch[1].length,
              children: [],
            },
            {
              type: 'expression',
              text: letMatch[2].trim(),
              startLine: i,
              startCol: line.indexOf(letMatch[2]),
              endLine: i,
              endCol: line.indexOf(letMatch[2]) + letMatch[2].length,
              children: [],
            },
          ],
        });
        continue;
      }

      const filterMatch = line.match(/^\s+filter\s+(.+)/);
      if (filterMatch) {
        currentBlock.children.push({
          type: 'where_filter',
          text: filterMatch[0].trim(),
          startLine: i,
          startCol: line.search(/\S/),
          endLine: i,
          endCol: line.length,
          children: [
            {
              type: 'expression',
              text: filterMatch[1].trim(),
              startLine: i,
              startCol: line.indexOf(filterMatch[1]),
              endLine: i,
              endCol: line.indexOf(filterMatch[1]) + filterMatch[1].length,
              children: [],
            },
          ],
        });
        continue;
      }

      const queryMatch = line.match(/^\s+query\s+(\w+)\s*\{/);
      if (queryMatch) {
        currentBlock.children.push({
          type: 'where_query',
          text: queryMatch[0].trim(),
          startLine: i,
          startCol: line.search(/\S/),
          endLine: i,
          endCol: line.length,
          children: [
            {
              type: 'concept_ref',
              text: queryMatch[1],
              startLine: i,
              startCol: line.indexOf(queryMatch[1]),
              endLine: i,
              endCol: line.indexOf(queryMatch[1]) + queryMatch[1].length,
              children: [],
            },
          ],
        });
        continue;
      }
    }

    // Then clause: ConceptName.actionName(field: $var)
    const thenClauseMatch = line.match(/^\s+(\w+)\.(\w+)\s*\(([^)]*)\)/);
    if (thenClauseMatch && currentBlock?.type === 'then_block') {
      const thenNode: ParseNode = {
        type: 'then_clause',
        text: thenClauseMatch[0].trim(),
        startLine: i,
        startCol: line.search(/\S/),
        endLine: i,
        endCol: line.length,
        children: [
          {
            type: 'concept_ref',
            text: thenClauseMatch[1],
            startLine: i,
            startCol: line.indexOf(thenClauseMatch[1]),
            endLine: i,
            endCol: line.indexOf(thenClauseMatch[1]) + thenClauseMatch[1].length,
            children: [],
          },
          {
            type: 'action_ref',
            text: thenClauseMatch[2],
            startLine: i,
            startCol: line.indexOf(thenClauseMatch[2], line.indexOf('.')),
            endLine: i,
            endCol: line.indexOf(thenClauseMatch[2], line.indexOf('.')) + thenClauseMatch[2].length,
            children: [],
          },
        ],
      };

      if (thenClauseMatch[3]?.trim()) {
        for (const binding of thenClauseMatch[3].split(',')) {
          const trimmed = binding.trim();
          if (trimmed) {
            thenNode.children.push({
              type: 'field_binding',
              text: trimmed,
              startLine: i,
              startCol: line.indexOf(trimmed),
              endLine: i,
              endCol: line.indexOf(trimmed) + trimmed.length,
              children: [],
            });
          }
        }
      }

      currentBlock.children.push(thenNode);
      continue;
    }
  }

  return root;
}

/**
 * Identify highlight ranges for sync-spec syntax.
 */
function highlightSyncSpec(source: string): Array<{
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
  tokenType: string;
}> {
  const highlights: Array<{
    startLine: number;
    startCol: number;
    endLine: number;
    endCol: number;
    tokenType: string;
  }> = [];
  const lines = source.split('\n');

  const keywords = ['sync', 'when', 'where', 'then', 'let', 'filter', 'query'];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Annotations
    const annoMatch = line.match(/@\w+(?:\([^)]*\))?/g);
    if (annoMatch) {
      for (const m of annoMatch) {
        const col = line.indexOf(m);
        highlights.push({ startLine: i, startCol: col, endLine: i, endCol: col + m.length, tokenType: 'annotation' });
      }
    }

    // Variant arrow
    if (line.includes('->')) {
      const col = line.indexOf('->');
      highlights.push({ startLine: i, startCol: col, endLine: i, endCol: col + 2, tokenType: 'operator' });
    }

    // Keywords
    for (const kw of keywords) {
      const kwRegex = new RegExp(`\\b${kw}\\b`, 'g');
      let m: RegExpExecArray | null;
      while ((m = kwRegex.exec(line)) !== null) {
        highlights.push({ startLine: i, startCol: m.index, endLine: i, endCol: m.index + kw.length, tokenType: 'keyword' });
      }
    }

    // Variables ($varName)
    const varRegex = /\$\w+/g;
    let vm: RegExpExecArray | null;
    while ((vm = varRegex.exec(line)) !== null) {
      highlights.push({ startLine: i, startCol: vm.index, endLine: i, endCol: vm.index + vm[0].length, tokenType: 'variable' });
    }

    // Concept.action references (capitalized word before dot)
    const refRegex = /\b([A-Z]\w*)\.(\w+)/g;
    let rm: RegExpExecArray | null;
    while ((rm = refRegex.exec(line)) !== null) {
      highlights.push({ startLine: i, startCol: rm.index, endLine: i, endCol: rm.index + rm[1].length, tokenType: 'type' });
      const dotPos = rm.index + rm[1].length + 1;
      highlights.push({ startLine: i, startCol: dotPos, endLine: i, endCol: dotPos + rm[2].length, tokenType: 'function' });
    }
  }

  return highlights;
}

/**
 * Execute a simplified tree-sitter-style query against a parse tree.
 */
function queryTree(node: ParseNode, pattern: string): ParseNode[] {
  const results: ParseNode[] = [];
  const typeMatch = pattern.match(/\(\s*(\w+)/);
  if (!typeMatch) return results;
  const targetType = typeMatch[1];

  function walk(n: ParseNode): void {
    if (n.type === targetType) {
      results.push(n);
    }
    for (const child of n.children) {
      walk(child);
    }
  }

  walk(node);
  return results;
}

export const treeSitterSyncSpecHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();

    try {
      const existing = await storage.find(RELATION, { language: 'sync-spec' });
      if (existing.length > 0) {
        return { variant: 'ok', instance: existing[0].id as string };
      }

      await storage.put(RELATION, id, {
        id,
        grammarRef: 'tree-sitter-sync-spec',
        wasmPath: 'tree-sitter-yaml.wasm',
        language: 'sync-spec',
        extensions: JSON.stringify(['.sync']),
        grammarVersion: '1.0.0',
      });

      return { variant: 'ok', instance: id };
    } catch (e) {
      return { variant: 'loadError', message: String(e) };
    }
  },

  async parse(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;

    try {
      const tree = parseSyncSpec(source);
      return { variant: 'ok', tree: JSON.stringify(tree) };
    } catch (e) {
      return { variant: 'parseError', message: String(e) };
    }
  },

  async highlight(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;

    try {
      const ranges = highlightSyncSpec(source);
      return { variant: 'ok', highlights: JSON.stringify(ranges) };
    } catch (e) {
      return { variant: 'highlightError', message: String(e) };
    }
  },

  async query(input: Record<string, unknown>, storage: ConceptStorage) {
    const pattern = input.pattern as string;
    const source = input.source as string;

    try {
      const tree = parseSyncSpec(source);
      const matches = queryTree(tree, pattern);
      return { variant: 'ok', matches: JSON.stringify(matches) };
    } catch (e) {
      return { variant: 'queryError', message: String(e) };
    }
  },

  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const instanceId = input.instance as string | undefined;
    const record = instanceId ? await storage.get(RELATION, instanceId) : null;

    return {
      variant: 'ok',
      language: 'sync-spec',
      extensions: JSON.stringify(['.sync']),
      grammarVersion: '1.0.0',
      registered: record !== null,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetTreeSitterSyncSpecCounter(): void {
  idCounter = 0;
}
