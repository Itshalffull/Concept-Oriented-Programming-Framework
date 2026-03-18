// @migrated dsl-constructs 2026-03-18
// ============================================================
// TreeSitterSyncSpec Handler
//
// Tree-sitter grammar provider for Clef sync spec files. Uses
// line-based parsing as an approximation for .sync files until
// a custom Tree-sitter grammar is available.
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
  return `tree-sitter-sync-spec-${++idCounter}`;
}

const RELATION = 'tree-sitter-sync-spec';

interface ParseNode { type: string; text: string; startLine: number; startCol: number; endLine: number; endCol: number; children: ParseNode[]; }

function parseSyncSpec(source: string): ParseNode {
  const root: ParseNode = { type: 'source_file', text: source, startLine: 0, startCol: 0, endLine: 0, endCol: 0, children: [] };
  const lines = source.split('\n');
  root.endLine = lines.length - 1;
  root.endCol = (lines[lines.length - 1] ?? '').length;
  let currentSync: ParseNode | null = null;
  let currentBlock: ParseNode | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const annoMatch = line.match(/^\s*(@\w+(?:\(.*?\))?)/);
    if (annoMatch) { root.children.push({ type: 'annotation', text: annoMatch[1], startLine: i, startCol: line.indexOf('@'), endLine: i, endCol: line.indexOf('@') + annoMatch[1].length, children: [] }); continue; }
    const syncMatch = line.match(/^\s*sync\s+(\w+)\s*\{/);
    if (syncMatch) {
      currentSync = { type: 'sync_declaration', text: syncMatch[0].trim(), startLine: i, startCol: line.search(/\S/), endLine: i, endCol: line.length, children: [{ type: 'sync_name', text: syncMatch[1], startLine: i, startCol: line.indexOf(syncMatch[1]), endLine: i, endCol: line.indexOf(syncMatch[1]) + syncMatch[1].length, children: [] }] };
      root.children.push(currentSync); currentBlock = null; continue;
    }
    const blockMatch = line.match(/^\s+(when|where|then)\s*\{/);
    if (blockMatch && currentSync) { currentBlock = { type: `${blockMatch[1]}_block`, text: blockMatch[1], startLine: i, startCol: line.search(/\S/), endLine: i, endCol: line.length, children: [] }; currentSync.children.push(currentBlock); continue; }
    const whenClauseMatch = line.match(/^\s+(\w+)\.(\w+)\s*\(([^)]*)\)\s*(?:->\s*(\w+)\s*\(([^)]*)\))?/);
    if (whenClauseMatch && currentBlock?.type === 'when_block') {
      const clause: ParseNode = { type: 'when_clause', text: whenClauseMatch[0].trim(), startLine: i, startCol: line.search(/\S/), endLine: i, endCol: line.length, children: [
        { type: 'concept_ref', text: whenClauseMatch[1], startLine: i, startCol: line.indexOf(whenClauseMatch[1]), endLine: i, endCol: line.indexOf(whenClauseMatch[1]) + whenClauseMatch[1].length, children: [] },
        { type: 'action_ref', text: whenClauseMatch[2], startLine: i, startCol: line.indexOf(whenClauseMatch[2], line.indexOf('.')), endLine: i, endCol: line.indexOf(whenClauseMatch[2], line.indexOf('.')) + whenClauseMatch[2].length, children: [] },
      ]};
      if (whenClauseMatch[3]?.trim()) { for (const binding of whenClauseMatch[3].split(',')) { const trimmed = binding.trim(); if (trimmed) clause.children.push({ type: 'field_binding', text: trimmed, startLine: i, startCol: line.indexOf(trimmed), endLine: i, endCol: line.indexOf(trimmed) + trimmed.length, children: [] }); }}
      if (whenClauseMatch[4]) { clause.children.push({ type: 'variant_ref', text: whenClauseMatch[4], startLine: i, startCol: line.indexOf(whenClauseMatch[4], line.indexOf('->')), endLine: i, endCol: line.indexOf(whenClauseMatch[4], line.indexOf('->')) + whenClauseMatch[4].length, children: [] }); }
      currentBlock.children.push(clause); continue;
    }
    if (currentBlock?.type === 'where_block') {
      const letMatch = line.match(/^\s+let\s+(\$\w+)\s*=\s*(.+)/);
      if (letMatch) { currentBlock.children.push({ type: 'where_bind', text: letMatch[0].trim(), startLine: i, startCol: line.search(/\S/), endLine: i, endCol: line.length, children: [{ type: 'variable', text: letMatch[1], startLine: i, startCol: line.indexOf(letMatch[1]), endLine: i, endCol: line.indexOf(letMatch[1]) + letMatch[1].length, children: [] }, { type: 'expression', text: letMatch[2].trim(), startLine: i, startCol: line.indexOf(letMatch[2]), endLine: i, endCol: line.indexOf(letMatch[2]) + letMatch[2].length, children: [] }] }); continue; }
      const filterMatch = line.match(/^\s+filter\s+(.+)/);
      if (filterMatch) { currentBlock.children.push({ type: 'where_filter', text: filterMatch[0].trim(), startLine: i, startCol: line.search(/\S/), endLine: i, endCol: line.length, children: [{ type: 'expression', text: filterMatch[1].trim(), startLine: i, startCol: line.indexOf(filterMatch[1]), endLine: i, endCol: line.indexOf(filterMatch[1]) + filterMatch[1].length, children: [] }] }); continue; }
      const queryMatch = line.match(/^\s+query\s+(\w+)\s*\{/);
      if (queryMatch) { currentBlock.children.push({ type: 'where_query', text: queryMatch[0].trim(), startLine: i, startCol: line.search(/\S/), endLine: i, endCol: line.length, children: [{ type: 'concept_ref', text: queryMatch[1], startLine: i, startCol: line.indexOf(queryMatch[1]), endLine: i, endCol: line.indexOf(queryMatch[1]) + queryMatch[1].length, children: [] }] }); continue; }
    }
    const thenClauseMatch = line.match(/^\s+(\w+)\.(\w+)\s*\(([^)]*)\)/);
    if (thenClauseMatch && currentBlock?.type === 'then_block') {
      const thenNode: ParseNode = { type: 'then_clause', text: thenClauseMatch[0].trim(), startLine: i, startCol: line.search(/\S/), endLine: i, endCol: line.length, children: [
        { type: 'concept_ref', text: thenClauseMatch[1], startLine: i, startCol: line.indexOf(thenClauseMatch[1]), endLine: i, endCol: line.indexOf(thenClauseMatch[1]) + thenClauseMatch[1].length, children: [] },
        { type: 'action_ref', text: thenClauseMatch[2], startLine: i, startCol: line.indexOf(thenClauseMatch[2], line.indexOf('.')), endLine: i, endCol: line.indexOf(thenClauseMatch[2], line.indexOf('.')) + thenClauseMatch[2].length, children: [] },
      ]};
      if (thenClauseMatch[3]?.trim()) { for (const binding of thenClauseMatch[3].split(',')) { const trimmed = binding.trim(); if (trimmed) thenNode.children.push({ type: 'field_binding', text: trimmed, startLine: i, startCol: line.indexOf(trimmed), endLine: i, endCol: line.indexOf(trimmed) + trimmed.length, children: [] }); }}
      currentBlock.children.push(thenNode); continue;
    }
  }
  return root;
}

function highlightSyncSpec(source: string): Array<{ startLine: number; startCol: number; endLine: number; endCol: number; tokenType: string }> {
  const highlights: Array<{ startLine: number; startCol: number; endLine: number; endCol: number; tokenType: string }> = [];
  const lines = source.split('\n');
  const keywords = ['sync', 'when', 'where', 'then', 'let', 'filter', 'query'];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const annoMatch = line.match(/@\w+(?:\([^)]*\))?/g);
    if (annoMatch) { for (const m of annoMatch) { const col = line.indexOf(m); highlights.push({ startLine: i, startCol: col, endLine: i, endCol: col + m.length, tokenType: 'annotation' }); }}
    if (line.includes('->')) { const col = line.indexOf('->'); highlights.push({ startLine: i, startCol: col, endLine: i, endCol: col + 2, tokenType: 'operator' }); }
    for (const kw of keywords) { const kwRegex = new RegExp(`\\b${kw}\\b`, 'g'); let m: RegExpExecArray | null; while ((m = kwRegex.exec(line)) !== null) highlights.push({ startLine: i, startCol: m.index, endLine: i, endCol: m.index + kw.length, tokenType: 'keyword' }); }
    const varRegex = /\$\w+/g; let vm: RegExpExecArray | null; while ((vm = varRegex.exec(line)) !== null) highlights.push({ startLine: i, startCol: vm.index, endLine: i, endCol: vm.index + vm[0].length, tokenType: 'variable' });
    const refRegex = /\b([A-Z]\w*)\.(\w+)/g; let rm: RegExpExecArray | null;
    while ((rm = refRegex.exec(line)) !== null) { highlights.push({ startLine: i, startCol: rm.index, endLine: i, endCol: rm.index + rm[1].length, tokenType: 'type' }); const dotPos = rm.index + rm[1].length + 1; highlights.push({ startLine: i, startCol: dotPos, endLine: i, endCol: dotPos + rm[2].length, tokenType: 'function' }); }
  }
  return highlights;
}

function queryTree(node: ParseNode, pattern: string): ParseNode[] {
  const results: ParseNode[] = []; const typeMatch = pattern.match(/\(\s*(\w+)/); if (!typeMatch) return results; const targetType = typeMatch[1];
  function walk(n: ParseNode): void { if (n.type === targetType) results.push(n); for (const child of n.children) walk(child); }
  walk(node); return results;
}

const _handler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();
    let p = createProgram();
    p = find(p, RELATION, { language: 'sync-spec' }, 'existing');
    return branch(p,
      (b) => (b.existing as unknown[]).length > 0,
      (() => { const t = createProgram(); return completeFrom(t, 'ok', (b) => ({ instance: (b.existing as Record<string, unknown>[])[0].id as string })); })(),
      (() => { let e = createProgram(); e = put(e, RELATION, id, { id, grammarRef: 'tree-sitter-sync-spec', wasmPath: 'tree-sitter-yaml.wasm', language: 'sync-spec', extensions: JSON.stringify(['.sync']), grammarVersion: '1.0.0' }); return complete(e, 'ok', { instance: id }) as StorageProgram<Result>; })(),
    ) as StorageProgram<Result>;
  },
  parse(input: Record<string, unknown>) { const source = input.source as string; try { const tree = parseSyncSpec(source); const p = createProgram(); return complete(p, 'ok', { tree: JSON.stringify(tree) }) as StorageProgram<Result>; } catch (e) { const p = createProgram(); return complete(p, 'parseError', { message: String(e) }) as StorageProgram<Result>; } },
  highlight(input: Record<string, unknown>) { const source = input.source as string; try { const ranges = highlightSyncSpec(source); const p = createProgram(); return complete(p, 'ok', { highlights: JSON.stringify(ranges) }) as StorageProgram<Result>; } catch (e) { const p = createProgram(); return complete(p, 'highlightError', { message: String(e) }) as StorageProgram<Result>; } },
  query(input: Record<string, unknown>) { const pattern = input.pattern as string; const source = input.source as string; try { const tree = parseSyncSpec(source); const matches = queryTree(tree, pattern); const p = createProgram(); return complete(p, 'ok', { matches: JSON.stringify(matches) }) as StorageProgram<Result>; } catch (e) { const p = createProgram(); return complete(p, 'queryError', { message: String(e) }) as StorageProgram<Result>; } },
  register(input: Record<string, unknown>) {
    const instanceId = input.instance as string | undefined;
    if (instanceId) { let p = createProgram(); p = get(p, RELATION, instanceId, 'record'); return completeFrom(p, 'ok', (b) => ({ language: 'sync-spec', extensions: JSON.stringify(['.sync']), grammarVersion: '1.0.0', registered: b.record !== null })); }
    const p = createProgram(); return complete(p, 'ok', { language: 'sync-spec', extensions: JSON.stringify(['.sync']), grammarVersion: '1.0.0', registered: false }) as StorageProgram<Result>;
  },
};

export const treeSitterSyncSpecHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetTreeSitterSyncSpecCounter(): void { idCounter = 0; }
