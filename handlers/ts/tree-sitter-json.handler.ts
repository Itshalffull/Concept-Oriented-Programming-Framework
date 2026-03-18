// @migrated dsl-constructs 2026-03-18
// ============================================================
// TreeSitterJson Handler
//
// Tree-sitter grammar provider for JSON files. Registers the
// JSON WASM parser with LanguageGrammar for .json extensions.
// Uses JSON.parse to build a node tree representation.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, complete, completeFrom,
  branch, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

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
    return { type: 'null', text: 'null', startLine: lineAt(source, idx), startCol: colAt(source, idx), endLine: lineAt(source, idx + 4), endCol: colAt(source, idx + 4), children: [] };
  }
  if (typeof value === 'boolean') {
    const text = String(value);
    const idx = source.indexOf(text, offset);
    return { type: 'boolean', text, startLine: lineAt(source, idx), startCol: colAt(source, idx), endLine: lineAt(source, idx + text.length), endCol: colAt(source, idx + text.length), children: [] };
  }
  if (typeof value === 'number') {
    const text = String(value);
    const numRegex = new RegExp(`-?\\d+(?:\\.\\d+)?(?:[eE][+-]?\\d+)?`, 'g');
    numRegex.lastIndex = offset;
    let m: RegExpExecArray | null;
    let idx = offset;
    while ((m = numRegex.exec(source)) !== null) {
      if (Number(m[0]) === value || m.index >= offset) { idx = m.index; break; }
    }
    return { type: 'number', text, startLine: lineAt(source, idx), startCol: colAt(source, idx), endLine: lineAt(source, idx + text.length), endCol: colAt(source, idx + text.length), children: [] };
  }
  if (typeof value === 'string') {
    const escaped = JSON.stringify(value);
    const idx = source.indexOf(escaped, offset);
    const pos = idx >= 0 ? idx : offset;
    return { type: 'string', text: escaped, startLine: lineAt(source, pos), startCol: colAt(source, pos), endLine: lineAt(source, pos + escaped.length), endCol: colAt(source, pos + escaped.length), children: [] };
  }
  if (Array.isArray(value)) {
    const idx = source.indexOf('[', offset);
    const node: ParseNode = { type: 'array', text: '[]', startLine: lineAt(source, idx), startCol: colAt(source, idx), endLine: 0, endCol: 0, children: [] };
    let childOffset = idx + 1;
    for (const item of value) {
      const child = jsonValueToNode(item, source, childOffset);
      node.children.push(child);
      childOffset = positionToOffset(source, child.endLine, child.endCol) + 1;
    }
    const closeIdx = source.indexOf(']', childOffset);
    node.endLine = lineAt(source, closeIdx >= 0 ? closeIdx + 1 : childOffset);
    node.endCol = colAt(source, closeIdx >= 0 ? closeIdx + 1 : childOffset);
    return node;
  }
  if (typeof value === 'object') {
    const idx = source.indexOf('{', offset);
    const node: ParseNode = { type: 'object', text: '{}', startLine: lineAt(source, idx), startCol: colAt(source, idx), endLine: 0, endCol: 0, children: [] };
    let childOffset = idx + 1;
    const entries = Object.entries(value as Record<string, unknown>);
    for (const [key, val] of entries) {
      const keyStr = JSON.stringify(key);
      const keyIdx = source.indexOf(keyStr, childOffset);
      const keyNode: ParseNode = { type: 'pair_key', text: keyStr, startLine: lineAt(source, keyIdx), startCol: colAt(source, keyIdx), endLine: lineAt(source, keyIdx + keyStr.length), endCol: colAt(source, keyIdx + keyStr.length), children: [] };
      const valOffset = source.indexOf(':', keyIdx + keyStr.length) + 1;
      const valNode = jsonValueToNode(val, source, valOffset);
      const pair: ParseNode = { type: 'pair', text: `${keyStr}: ...`, startLine: keyNode.startLine, startCol: keyNode.startCol, endLine: valNode.endLine, endCol: valNode.endCol, children: [keyNode, valNode] };
      node.children.push(pair);
      childOffset = positionToOffset(source, valNode.endLine, valNode.endCol) + 1;
    }
    const closeIdx = source.indexOf('}', childOffset);
    node.endLine = lineAt(source, closeIdx >= 0 ? closeIdx + 1 : childOffset);
    node.endCol = colAt(source, closeIdx >= 0 ? closeIdx + 1 : childOffset);
    return node;
  }
  return { type: 'unknown', text: String(value), startLine: 0, startCol: 0, endLine: 0, endCol: 0, children: [] };
}

function lineAt(source: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, source.length));
  let line = 0;
  for (let i = 0; i < clamped; i++) { if (source[i] === '\n') line++; }
  return line;
}

function colAt(source: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, source.length));
  let col = 0;
  for (let i = clamped - 1; i >= 0; i--) { if (source[i] === '\n') break; col++; }
  return col;
}

function positionToOffset(source: string, line: number, col: number): number {
  let currentLine = 0;
  let i = 0;
  while (i < source.length && currentLine < line) { if (source[i] === '\n') currentLine++; i++; }
  return Math.min(i + col, source.length);
}

function parseJson(source: string): ParseNode {
  const parsed = JSON.parse(source);
  const valueNode = jsonValueToNode(parsed, source, 0);
  return { type: 'source_file', text: source, startLine: 0, startCol: 0, endLine: lineAt(source, source.length), endCol: colAt(source, source.length), children: [valueNode] };
}

function highlightJson(source: string): Array<{ startLine: number; startCol: number; endLine: number; endCol: number; tokenType: string }> {
  const highlights: Array<{ startLine: number; startCol: number; endLine: number; endCol: number; tokenType: string }> = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const strRegex = /"(?:[^"\\]|\\.)*"/g;
    let m: RegExpExecArray | null;
    while ((m = strRegex.exec(line)) !== null) {
      const afterStr = line.slice(m.index + m[0].length).trim();
      const isKey = afterStr.startsWith(':');
      highlights.push({ startLine: i, startCol: m.index, endLine: i, endCol: m.index + m[0].length, tokenType: isKey ? 'property' : 'string' });
    }
    const numRegex = /\b-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g;
    while ((m = numRegex.exec(line)) !== null) {
      highlights.push({ startLine: i, startCol: m.index, endLine: i, endCol: m.index + m[0].length, tokenType: 'number' });
    }
    const litRegex = /\b(true|false|null)\b/g;
    while ((m = litRegex.exec(line)) !== null) {
      highlights.push({ startLine: i, startCol: m.index, endLine: i, endCol: m.index + m[0].length, tokenType: m[1] === 'null' ? 'keyword' : 'boolean' });
    }
  }
  return highlights;
}

function queryTree(node: ParseNode, pattern: string): ParseNode[] {
  const results: ParseNode[] = [];
  const typeMatch = pattern.match(/\(\s*(\w+)/);
  if (!typeMatch) return results;
  const targetType = typeMatch[1];
  function walk(n: ParseNode): void {
    if (n.type === targetType) results.push(n);
    for (const child of n.children) walk(child);
  }
  walk(node);
  return results;
}

const _handler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();
    let p = createProgram();
    p = find(p, RELATION, { language: 'json' }, 'existing');

    return branch(p,
      (b) => (b.existing as unknown[]).length > 0,
      (() => {
        const t = createProgram();
        return completeFrom(t, 'ok', (b) => ({
          instance: (b.existing as Record<string, unknown>[])[0].id as string,
        }));
      })(),
      (() => {
        let e = createProgram();
        e = put(e, RELATION, id, {
          id, grammarRef: 'tree-sitter-json', wasmPath: 'tree-sitter-json.wasm',
          language: 'json', extensions: JSON.stringify(['.json']), grammarVersion: '1.0.0',
        });
        return complete(e, 'ok', { instance: id }) as StorageProgram<Result>;
      })(),
    ) as StorageProgram<Result>;
  },

  parse(input: Record<string, unknown>) {
    const source = input.source as string;
    try {
      const tree = parseJson(source);
      const p = createProgram();
      return complete(p, 'ok', { tree: JSON.stringify(tree) }) as StorageProgram<Result>;
    } catch (e) {
      const p = createProgram();
      return complete(p, 'parseError', { message: String(e) }) as StorageProgram<Result>;
    }
  },

  highlight(input: Record<string, unknown>) {
    const source = input.source as string;
    try {
      const ranges = highlightJson(source);
      const p = createProgram();
      return complete(p, 'ok', { highlights: JSON.stringify(ranges) }) as StorageProgram<Result>;
    } catch (e) {
      const p = createProgram();
      return complete(p, 'highlightError', { message: String(e) }) as StorageProgram<Result>;
    }
  },

  query(input: Record<string, unknown>) {
    const pattern = input.pattern as string;
    const source = input.source as string;
    try {
      const tree = parseJson(source);
      const matches = queryTree(tree, pattern);
      const p = createProgram();
      return complete(p, 'ok', { matches: JSON.stringify(matches) }) as StorageProgram<Result>;
    } catch (e) {
      const p = createProgram();
      return complete(p, 'queryError', { message: String(e) }) as StorageProgram<Result>;
    }
  },

  register(input: Record<string, unknown>) {
    const instanceId = input.instance as string | undefined;
    if (instanceId) {
      let p = createProgram();
      p = get(p, RELATION, instanceId, 'record');
      return completeFrom(p, 'ok', (b) => ({
        language: 'json', extensions: JSON.stringify(['.json']), grammarVersion: '1.0.0', registered: b.record !== null,
      }));
    }
    const p = createProgram();
    return complete(p, 'ok', { language: 'json', extensions: JSON.stringify(['.json']), grammarVersion: '1.0.0', registered: false }) as StorageProgram<Result>;
  },
};

export const treeSitterJsonHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetTreeSitterJsonCounter(): void {
  idCounter = 0;
}
