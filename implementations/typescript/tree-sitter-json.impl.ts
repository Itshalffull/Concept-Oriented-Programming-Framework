// ============================================================
// TreeSitterJson Handler
//
// Tree-sitter grammar provider for JSON files. Registers the
// JSON WASM parser with LanguageGrammar for .json extensions.
// Uses JSON.parse to build a node tree representation.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `tree-sitter-json-${++idCounter}`;
}

/** Storage relation name for this concept. */
const RELATION = 'tree-sitter-json';

// --- AST node types for JSON grammar ---

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
 * Build a parse tree from a JSON value, tracking approximate source positions.
 */
function jsonValueToNode(value: unknown, source: string, offset: number): ParseNode {
  if (value === null) {
    const idx = source.indexOf('null', offset);
    return {
      type: 'null',
      text: 'null',
      startLine: lineAt(source, idx),
      startCol: colAt(source, idx),
      endLine: lineAt(source, idx + 4),
      endCol: colAt(source, idx + 4),
      children: [],
    };
  }

  if (typeof value === 'boolean') {
    const text = String(value);
    const idx = source.indexOf(text, offset);
    return {
      type: 'boolean',
      text,
      startLine: lineAt(source, idx),
      startCol: colAt(source, idx),
      endLine: lineAt(source, idx + text.length),
      endCol: colAt(source, idx + text.length),
      children: [],
    };
  }

  if (typeof value === 'number') {
    const text = String(value);
    // Find the number in source (may have different formatting)
    const numRegex = new RegExp(`-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?`, 'g');
    numRegex.lastIndex = offset;
    let m: RegExpExecArray | null;
    let idx = offset;
    while ((m = numRegex.exec(source)) !== null) {
      if (Number(m[0]) === value || m.index >= offset) {
        idx = m.index;
        break;
      }
    }
    return {
      type: 'number',
      text,
      startLine: lineAt(source, idx),
      startCol: colAt(source, idx),
      endLine: lineAt(source, idx + text.length),
      endCol: colAt(source, idx + text.length),
      children: [],
    };
  }

  if (typeof value === 'string') {
    // Find the quoted string in source
    const escaped = JSON.stringify(value);
    const idx = source.indexOf(escaped, offset);
    const pos = idx >= 0 ? idx : offset;
    return {
      type: 'string',
      text: escaped,
      startLine: lineAt(source, pos),
      startCol: colAt(source, pos),
      endLine: lineAt(source, pos + escaped.length),
      endCol: colAt(source, pos + escaped.length),
      children: [],
    };
  }

  if (Array.isArray(value)) {
    const idx = source.indexOf('[', offset);
    const node: ParseNode = {
      type: 'array',
      text: '[]',
      startLine: lineAt(source, idx),
      startCol: colAt(source, idx),
      endLine: 0,
      endCol: 0,
      children: [],
    };
    let childOffset = idx + 1;
    for (const item of value) {
      const child = jsonValueToNode(item, source, childOffset);
      node.children.push(child);
      childOffset = positionToOffset(source, child.endLine, child.endCol) + 1;
    }
    // Find closing bracket
    const closeIdx = source.indexOf(']', childOffset);
    node.endLine = lineAt(source, closeIdx >= 0 ? closeIdx + 1 : childOffset);
    node.endCol = colAt(source, closeIdx >= 0 ? closeIdx + 1 : childOffset);
    return node;
  }

  if (typeof value === 'object') {
    const idx = source.indexOf('{', offset);
    const node: ParseNode = {
      type: 'object',
      text: '{}',
      startLine: lineAt(source, idx),
      startCol: colAt(source, idx),
      endLine: 0,
      endCol: 0,
      children: [],
    };
    let childOffset = idx + 1;
    const entries = Object.entries(value as Record<string, unknown>);
    for (const [key, val] of entries) {
      const keyStr = JSON.stringify(key);
      const keyIdx = source.indexOf(keyStr, childOffset);
      const keyNode: ParseNode = {
        type: 'pair_key',
        text: keyStr,
        startLine: lineAt(source, keyIdx),
        startCol: colAt(source, keyIdx),
        endLine: lineAt(source, keyIdx + keyStr.length),
        endCol: colAt(source, keyIdx + keyStr.length),
        children: [],
      };
      const valOffset = source.indexOf(':', keyIdx + keyStr.length) + 1;
      const valNode = jsonValueToNode(val, source, valOffset);

      const pair: ParseNode = {
        type: 'pair',
        text: `${keyStr}: ...`,
        startLine: keyNode.startLine,
        startCol: keyNode.startCol,
        endLine: valNode.endLine,
        endCol: valNode.endCol,
        children: [keyNode, valNode],
      };
      node.children.push(pair);
      childOffset = positionToOffset(source, valNode.endLine, valNode.endCol) + 1;
    }
    const closeIdx = source.indexOf('}', childOffset);
    node.endLine = lineAt(source, closeIdx >= 0 ? closeIdx + 1 : childOffset);
    node.endCol = colAt(source, closeIdx >= 0 ? closeIdx + 1 : childOffset);
    return node;
  }

  return {
    type: 'unknown',
    text: String(value),
    startLine: 0,
    startCol: 0,
    endLine: 0,
    endCol: 0,
    children: [],
  };
}

function lineAt(source: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, source.length));
  let line = 0;
  for (let i = 0; i < clamped; i++) {
    if (source[i] === '\n') line++;
  }
  return line;
}

function colAt(source: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, source.length));
  let col = 0;
  for (let i = clamped - 1; i >= 0; i--) {
    if (source[i] === '\n') break;
    col++;
  }
  return col;
}

function positionToOffset(source: string, line: number, col: number): number {
  let currentLine = 0;
  let i = 0;
  while (i < source.length && currentLine < line) {
    if (source[i] === '\n') currentLine++;
    i++;
  }
  return Math.min(i + col, source.length);
}

/**
 * Parse JSON source into a simplified AST using JSON.parse.
 */
function parseJson(source: string): ParseNode {
  const parsed = JSON.parse(source);
  const valueNode = jsonValueToNode(parsed, source, 0);

  return {
    type: 'source_file',
    text: source,
    startLine: 0,
    startCol: 0,
    endLine: lineAt(source, source.length),
    endCol: colAt(source, source.length),
    children: [valueNode],
  };
}

/**
 * Identify highlight ranges for JSON syntax.
 */
function highlightJson(source: string): Array<{
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
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Strings (keys and values)
    const strRegex = /"(?:[^"\\]|\\.)*"/g;
    let m: RegExpExecArray | null;
    while ((m = strRegex.exec(line)) !== null) {
      // Check if this is a key (followed by :)
      const afterStr = line.slice(m.index + m[0].length).trim();
      const isKey = afterStr.startsWith(':');
      highlights.push({
        startLine: i,
        startCol: m.index,
        endLine: i,
        endCol: m.index + m[0].length,
        tokenType: isKey ? 'property' : 'string',
      });
    }

    // Numbers
    const numRegex = /\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g;
    while ((m = numRegex.exec(line)) !== null) {
      highlights.push({
        startLine: i,
        startCol: m.index,
        endLine: i,
        endCol: m.index + m[0].length,
        tokenType: 'number',
      });
    }

    // Booleans and null
    const litRegex = /\b(true|false|null)\b/g;
    while ((m = litRegex.exec(line)) !== null) {
      highlights.push({
        startLine: i,
        startCol: m.index,
        endLine: i,
        endCol: m.index + m[0].length,
        tokenType: m[1] === 'null' ? 'keyword' : 'boolean',
      });
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

export const treeSitterJsonHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();

    try {
      const existing = await storage.find(RELATION, { language: 'json' });
      if (existing.length > 0) {
        return { variant: 'ok', instance: existing[0].id as string };
      }

      await storage.put(RELATION, id, {
        id,
        grammarRef: 'tree-sitter-json',
        wasmPath: 'tree-sitter-json.wasm',
        language: 'json',
        extensions: JSON.stringify(['.json']),
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
      const tree = parseJson(source);
      return { variant: 'ok', tree: JSON.stringify(tree) };
    } catch (e) {
      return { variant: 'parseError', message: String(e) };
    }
  },

  async highlight(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;

    try {
      const ranges = highlightJson(source);
      return { variant: 'ok', highlights: JSON.stringify(ranges) };
    } catch (e) {
      return { variant: 'highlightError', message: String(e) };
    }
  },

  async query(input: Record<string, unknown>, storage: ConceptStorage) {
    const pattern = input.pattern as string;
    const source = input.source as string;

    try {
      const tree = parseJson(source);
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
      language: 'json',
      extensions: JSON.stringify(['.json']),
      grammarVersion: '1.0.0',
      registered: record !== null,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetTreeSitterJsonCounter(): void {
  idCounter = 0;
}
