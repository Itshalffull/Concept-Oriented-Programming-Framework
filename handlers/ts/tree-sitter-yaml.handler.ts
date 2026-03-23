// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// TreeSitterYaml Handler
//
// Tree-sitter grammar provider for YAML files. Registers the
// YAML WASM parser with LanguageGrammar for .yaml and .yml
// extensions. Uses simple line-based parsing (key: value,
// indentation for nesting).
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, complete, completeFrom,
  branch, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string { return `tree-sitter-yaml-${++idCounter}`; }

const RELATION = 'tree-sitter-yaml';

interface ParseNode { type: string; text: string; startLine: number; startCol: number; endLine: number; endCol: number; children: ParseNode[]; }

function createScalarNode(text: string, line: number, col: number): ParseNode {
  let scalarType = 'string_scalar';
  const valueText = text.replace(/\s+#.*$/, '').trim();
  if (valueText === 'true' || valueText === 'false') scalarType = 'boolean_scalar';
  else if (valueText === 'null' || valueText === '~') scalarType = 'null_scalar';
  else if (/^-?\d+$/.test(valueText)) scalarType = 'integer_scalar';
  else if (/^-?\d+\.\d+$/.test(valueText) || /^-?\d+[eE][+-]?\d+$/.test(valueText)) scalarType = 'float_scalar';
  else if ((valueText.startsWith('"') && valueText.endsWith('"')) || (valueText.startsWith("'") && valueText.endsWith("'"))) scalarType = 'quoted_scalar';
  return { type: scalarType, text: valueText, startLine: line, startCol: col, endLine: line, endCol: col + text.length, children: [] };
}

function parseFlowSequenceItems(text: string, line: number, baseCol: number): ParseNode[] {
  const items: ParseNode[] = [];
  const inner = text.slice(1, text.length - 1);
  if (!inner.trim()) return items;
  const parts = inner.split(',');
  let currentCol = baseCol + 1;
  for (const part of parts) { const trimmed = part.trim(); if (trimmed) items.push(createScalarNode(trimmed, line, currentCol + part.indexOf(trimmed))); currentCol += part.length + 1; }
  return items;
}

function parseYaml(source: string): ParseNode {
  const root: ParseNode = { type: 'source_file', text: source, startLine: 0, startCol: 0, endLine: 0, endCol: 0, children: [] };
  const lines = source.split('\n');
  root.endLine = lines.length - 1; root.endCol = (lines[lines.length - 1] ?? '').length;
  const stack: Array<{ node: ParseNode; indent: number }> = [{ node: root, indent: -1 }];
  let currentDocument: ParseNode | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]; const trimmed = line.trimStart();
    if (trimmed.length === 0) continue;
    const indent = line.length - trimmed.length;
    if (trimmed.startsWith('%')) { root.children.push({ type: 'directive', text: trimmed, startLine: i, startCol: indent, endLine: i, endCol: line.length, children: [] }); continue; }
    if (trimmed === '---' || trimmed.startsWith('--- ')) { currentDocument = { type: 'document', text: '---', startLine: i, startCol: 0, endLine: i, endCol: line.length, children: [] }; root.children.push(currentDocument); stack.length = 1; stack.push({ node: currentDocument, indent: -1 }); continue; }
    if (trimmed === '...') { if (currentDocument) { currentDocument.endLine = i; currentDocument.endCol = line.length; } currentDocument = null; stack.length = 1; continue; }
    if (trimmed.startsWith('#')) { const target = currentDocument ?? root; target.children.push({ type: 'comment', text: trimmed, startLine: i, startCol: indent, endLine: i, endCol: line.length, children: [] }); continue; }
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop();
    const parent = stack[stack.length - 1].node;
    if (trimmed.startsWith('- ') || trimmed === '-') {
      const itemContent = trimmed.slice(2).trim();
      const itemNode: ParseNode = { type: 'block_sequence_item', text: trimmed, startLine: i, startCol: indent, endLine: i, endCol: line.length, children: [] };
      const kvMatch = itemContent.match(/^([\w][\w.-]*)\s*:\s*(.*)/);
      if (kvMatch) { const keyNode: ParseNode = { type: 'block_mapping_pair', text: itemContent, startLine: i, startCol: indent + 2, endLine: i, endCol: line.length, children: [{ type: 'flow_node', text: kvMatch[1], startLine: i, startCol: indent + 2, endLine: i, endCol: indent + 2 + kvMatch[1].length, children: [] }] }; if (kvMatch[2].trim()) keyNode.children.push(createScalarNode(kvMatch[2].trim(), i, line.indexOf(kvMatch[2].trim()))); itemNode.children.push(keyNode); }
      else if (itemContent) itemNode.children.push(createScalarNode(itemContent, i, indent + 2));
      parent.children.push(itemNode); stack.push({ node: itemNode, indent: indent + 2 }); continue;
    }
    const kvMatch = trimmed.match(/^([\w][\w.\s-]*?)\s*:\s*(.*)/);
    if (kvMatch) {
      const key = kvMatch[1]; const value = kvMatch[2].trim();
      const pairNode: ParseNode = { type: 'block_mapping_pair', text: trimmed, startLine: i, startCol: indent, endLine: i, endCol: line.length, children: [{ type: 'flow_node', text: key, startLine: i, startCol: indent, endLine: i, endCol: indent + key.length, children: [] }] };
      const anchorMatch = value.match(/^&(\w+)\s*(.*)/);
      if (anchorMatch) { pairNode.children.push({ type: 'anchor', text: `&${anchorMatch[1]}`, startLine: i, startCol: line.indexOf('&'), endLine: i, endCol: line.indexOf('&') + anchorMatch[1].length + 1, children: [] }); if (anchorMatch[2].trim()) pairNode.children.push(createScalarNode(anchorMatch[2].trim(), i, line.indexOf(anchorMatch[2].trim()))); }
      else if (value.startsWith('*')) { pairNode.children.push({ type: 'alias', text: value, startLine: i, startCol: line.indexOf('*'), endLine: i, endCol: line.indexOf('*') + value.length, children: [] }); }
      else if (value.startsWith('[')) { pairNode.children.push({ type: 'flow_sequence', text: value, startLine: i, startCol: line.indexOf('['), endLine: i, endCol: line.indexOf('[') + value.length, children: parseFlowSequenceItems(value, i, line.indexOf('[')) }); }
      else if (value.startsWith('{')) { pairNode.children.push({ type: 'flow_mapping', text: value, startLine: i, startCol: line.indexOf('{'), endLine: i, endCol: line.indexOf('{') + value.length, children: [] }); }
      else if (value === '|' || value === '>' || value === '|+' || value === '|-' || value === '>+' || value === '>-') { pairNode.children.push({ type: 'block_scalar_indicator', text: value, startLine: i, startCol: line.indexOf(value, indent + key.length), endLine: i, endCol: line.indexOf(value, indent + key.length) + value.length, children: [] }); }
      else if (value) { pairNode.children.push(createScalarNode(value, i, line.indexOf(value, indent + key.length + 1))); }
      parent.children.push(pairNode); stack.push({ node: pairNode, indent }); continue;
    }
    if (trimmed && !trimmed.startsWith('#')) parent.children.push(createScalarNode(trimmed, i, indent));
  }
  return root;
}

function highlightYaml(source: string): Array<{ startLine: number; startCol: number; endLine: number; endCol: number; tokenType: string }> {
  const highlights: Array<{ startLine: number; startCol: number; endLine: number; endCol: number; tokenType: string }> = [];
  const lines = source.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]; const trimmed = line.trimStart(); const indent = line.length - trimmed.length;
    const commentIdx = trimmed.indexOf('#'); if (commentIdx >= 0) { const beforeHash = trimmed.slice(0, commentIdx); const quotes = (beforeHash.match(/"/g) || []).length; if (quotes % 2 === 0) highlights.push({ startLine: i, startCol: indent + commentIdx, endLine: i, endCol: line.length, tokenType: 'comment' }); }
    if (trimmed.startsWith('%')) { highlights.push({ startLine: i, startCol: indent, endLine: i, endCol: line.length, tokenType: 'directive' }); continue; }
    if (trimmed === '---' || trimmed === '...') { highlights.push({ startLine: i, startCol: indent, endLine: i, endCol: indent + 3, tokenType: 'punctuation' }); continue; }
    const kvMatch = trimmed.match(/^([\w][\w.\s-]*?)\s*:/);
    if (kvMatch) {
      highlights.push({ startLine: i, startCol: indent, endLine: i, endCol: indent + kvMatch[1].length, tokenType: 'property' });
      const valueStart = indent + kvMatch[0].length; const valuePart = line.slice(valueStart).trim();
      if (valuePart && !valuePart.startsWith('#')) {
        if (valuePart === 'true' || valuePart === 'false') highlights.push({ startLine: i, startCol: line.indexOf(valuePart, valueStart), endLine: i, endCol: line.indexOf(valuePart, valueStart) + valuePart.length, tokenType: 'boolean' });
        else if (valuePart === 'null' || valuePart === '~') highlights.push({ startLine: i, startCol: line.indexOf(valuePart, valueStart), endLine: i, endCol: line.indexOf(valuePart, valueStart) + valuePart.length, tokenType: 'keyword' });
        else if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(valuePart)) highlights.push({ startLine: i, startCol: line.indexOf(valuePart, valueStart), endLine: i, endCol: line.indexOf(valuePart, valueStart) + valuePart.length, tokenType: 'number' });
        else if (valuePart.startsWith('"') || valuePart.startsWith("'")) highlights.push({ startLine: i, startCol: line.indexOf(valuePart, valueStart), endLine: i, endCol: line.indexOf(valuePart, valueStart) + valuePart.length, tokenType: 'string' });
      }
    }
    if (trimmed.startsWith('- ') || trimmed === '-') highlights.push({ startLine: i, startCol: indent, endLine: i, endCol: indent + 1, tokenType: 'punctuation' });
    const anchorRegex = /&\w+/g; let am: RegExpExecArray | null; while ((am = anchorRegex.exec(line)) !== null) highlights.push({ startLine: i, startCol: am.index, endLine: i, endCol: am.index + am[0].length, tokenType: 'anchor' });
    const aliasRegex = /\*\w+/g; let alm: RegExpExecArray | null; while ((alm = aliasRegex.exec(line)) !== null) highlights.push({ startLine: i, startCol: alm.index, endLine: i, endCol: alm.index + alm[0].length, tokenType: 'alias' });
    if (trimmed === '|' || trimmed === '>' || trimmed === '|+' || trimmed === '|-' || trimmed === '>+' || trimmed === '>-') highlights.push({ startLine: i, startCol: indent, endLine: i, endCol: indent + trimmed.length, tokenType: 'operator' });
  }
  return highlights;
}

function queryTree(node: ParseNode, pattern: string): ParseNode[] {
  const results: ParseNode[] = []; const typeMatch = pattern.match(/\(\s*(\w+)/); if (!typeMatch) return results; const targetType = typeMatch[1];
  function walk(n: ParseNode): void { if (n.type === targetType) results.push(n); for (const child of n.children) walk(child); } walk(node); return results;
}

const _handler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId(); let p = createProgram(); p = find(p, RELATION, { language: 'yaml' }, 'existing');
    return branch(p, (b) => (b.existing as unknown[]).length > 0,
      (() => { const t = createProgram(); return completeFrom(t, 'ok', (b) => ({ instance: (b.existing as Record<string, unknown>[])[0].id as string })); })(),
      (() => { let e = createProgram(); e = put(e, RELATION, id, { id, grammarRef: 'tree-sitter-yaml', wasmPath: 'tree-sitter-yaml.wasm', language: 'yaml', extensions: JSON.stringify(['.yaml', '.yml']), grammarVersion: '1.0.0' }); return complete(e, 'ok', { instance: id }) as StorageProgram<Result>; })(),
    ) as StorageProgram<Result>;
  },
  parse(input: Record<string, unknown>) { const source = input.source as string; try { const tree = parseYaml(source); const p = createProgram(); return complete(p, 'ok', { tree: JSON.stringify(tree) }) as StorageProgram<Result>; } catch (e) { const p = createProgram(); return complete(p, 'parseError', { message: String(e) }) as StorageProgram<Result>; } },
  highlight(input: Record<string, unknown>) { const source = input.source as string; try { const ranges = highlightYaml(source); const p = createProgram(); return complete(p, 'ok', { highlights: JSON.stringify(ranges) }) as StorageProgram<Result>; } catch (e) { const p = createProgram(); return complete(p, 'highlightError', { message: String(e) }) as StorageProgram<Result>; } },
  query(input: Record<string, unknown>) { const pattern = input.pattern as string; const source = input.source as string; try { const tree = parseYaml(source); const matches = queryTree(tree, pattern); const p = createProgram(); return complete(p, 'ok', { matches: JSON.stringify(matches) }) as StorageProgram<Result>; } catch (e) { const p = createProgram(); return complete(p, 'queryError', { message: String(e) }) as StorageProgram<Result>; } },
  register(input: Record<string, unknown>) {
    const instanceId = input.instance as string | undefined;
    if (instanceId) { let p = createProgram(); p = get(p, RELATION, instanceId, 'record'); return completeFrom(p, 'ok', (b) => ({ name: 'TreeSitterYaml', language: 'yaml', extensions: JSON.stringify(['.yaml', '.yml']), grammarVersion: '1.0.0', registered: b.record !== null })); }
    const p = createProgram(); return complete(p, 'ok', { name: 'TreeSitterYaml', language: 'yaml', extensions: JSON.stringify(['.yaml', '.yml']), grammarVersion: '1.0.0', registered: false }) as StorageProgram<Result>;
  },
};

export const treeSitterYamlHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetTreeSitterYamlCounter(): void { idCounter = 0; }
