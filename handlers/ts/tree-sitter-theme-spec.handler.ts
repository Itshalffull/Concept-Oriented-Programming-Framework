// @migrated dsl-constructs 2026-03-18
// ============================================================
// TreeSitterThemeSpec Handler
//
// Tree-sitter grammar provider for Clef Surface theme spec files.
// Sections: purpose, palette, typography, spacing, motion,
// elevation, radius. Supports extends clause for theme
// inheritance.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, complete, completeFrom,
  branch, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string { return `tree-sitter-theme-spec-${++idCounter}`; }

const RELATION = 'tree-sitter-theme-spec';

interface ParseNode { type: string; text: string; startLine: number; startCol: number; endLine: number; endCol: number; children: ParseNode[]; }

const THEME_SECTIONS = ['purpose', 'palette', 'typography', 'spacing', 'motion', 'elevation', 'radius'];

function parseThemeSpec(source: string): ParseNode {
  const root: ParseNode = { type: 'source_file', text: source, startLine: 0, startCol: 0, endLine: 0, endCol: 0, children: [] };
  const lines = source.split('\n');
  root.endLine = lines.length - 1; root.endCol = (lines[lines.length - 1] ?? '').length;
  let currentTheme: ParseNode | null = null; let currentSection: ParseNode | null = null; let braceDepth = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const annoMatch = line.match(/^\s*(@\w+(?:\(.*?\))?)/);
    if (annoMatch) { root.children.push({ type: 'annotation', text: annoMatch[1], startLine: i, startCol: line.indexOf('@'), endLine: i, endCol: line.indexOf('@') + annoMatch[1].length, children: [] }); continue; }
    const themeMatch = line.match(/^\s*theme\s+(\w+)\s*(?:extends\s+(\w+)\s*)?\{/);
    if (themeMatch) {
      currentTheme = { type: 'theme_declaration', text: themeMatch[0].trim(), startLine: i, startCol: line.search(/\S/), endLine: i, endCol: line.length, children: [{ type: 'theme_name', text: themeMatch[1], startLine: i, startCol: line.indexOf(themeMatch[1]), endLine: i, endCol: line.indexOf(themeMatch[1]) + themeMatch[1].length, children: [] }] };
      if (themeMatch[2]) currentTheme.children.push({ type: 'extends_clause', text: themeMatch[2], startLine: i, startCol: line.indexOf(themeMatch[2], line.indexOf('extends')), endLine: i, endCol: line.indexOf(themeMatch[2], line.indexOf('extends')) + themeMatch[2].length, children: [] });
      root.children.push(currentTheme); braceDepth = 1; currentSection = null; continue;
    }
    for (const ch of line) { if (ch === '{') braceDepth++; else if (ch === '}') braceDepth--; }
    const sectionRegex = new RegExp(`^\\s+(${THEME_SECTIONS.join('|')})\\s*\\{`);
    const sectionMatch = line.match(sectionRegex);
    if (sectionMatch && currentTheme) { currentSection = { type: `${sectionMatch[1]}_section`, text: sectionMatch[1], startLine: i, startCol: line.search(/\S/), endLine: i, endCol: line.length, children: [] }; currentTheme.children.push(currentSection); continue; }
    const tokenMatch = line.match(/^\s+([\w-]+)\s*:\s*(.+)\s*$/);
    if (tokenMatch && currentSection) {
      const tokenName = tokenMatch[1]; const tokenValue = tokenMatch[2].trim();
      currentSection.children.push({ type: 'token_definition', text: `${tokenName}: ${tokenValue}`, startLine: i, startCol: line.search(/\S/), endLine: i, endCol: line.length, children: [
        { type: 'token_name', text: tokenName, startLine: i, startCol: line.indexOf(tokenName), endLine: i, endCol: line.indexOf(tokenName) + tokenName.length, children: [] },
        { type: 'token_value', text: tokenValue, startLine: i, startCol: line.indexOf(tokenValue), endLine: i, endCol: line.indexOf(tokenValue) + tokenValue.length, children: [] },
      ]}); continue;
    }
    if (line.match(/^\s*\}/) && currentSection && braceDepth <= 1) currentSection = null;
  }
  return root;
}

function highlightThemeSpec(source: string): Array<{ startLine: number; startCol: number; endLine: number; endCol: number; tokenType: string }> {
  const highlights: Array<{ startLine: number; startCol: number; endLine: number; endCol: number; tokenType: string }> = [];
  const lines = source.split('\n');
  const keywords = ['theme', 'extends', ...THEME_SECTIONS];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const annoMatch = line.match(/@\w+(?:\([^)]*\))?/g);
    if (annoMatch) { for (const m of annoMatch) { const col = line.indexOf(m); highlights.push({ startLine: i, startCol: col, endLine: i, endCol: col + m.length, tokenType: 'annotation' }); }}
    for (const kw of keywords) { const kwRegex = new RegExp(`\\b${kw}\\b`, 'g'); let m: RegExpExecArray | null; while ((m = kwRegex.exec(line)) !== null) highlights.push({ startLine: i, startCol: m.index, endLine: i, endCol: m.index + kw.length, tokenType: 'keyword' }); }
    const colorRegex = /#[0-9a-fA-F]{3,8}\b/g; let cm: RegExpExecArray | null; while ((cm = colorRegex.exec(line)) !== null) highlights.push({ startLine: i, startCol: cm.index, endLine: i, endCol: cm.index + cm[0].length, tokenType: 'color' });
    const numRegex = /\b\d+(?:\.\d+)?(?:px|rem|em|ms|s|%|dp|sp)\b/g; let nm: RegExpExecArray | null; while ((nm = numRegex.exec(line)) !== null) highlights.push({ startLine: i, startCol: nm.index, endLine: i, endCol: nm.index + nm[0].length, tokenType: 'number' });
    const strRegex = /"[^"]*"|'[^']*'/g; let sm: RegExpExecArray | null; while ((sm = strRegex.exec(line)) !== null) highlights.push({ startLine: i, startCol: sm.index, endLine: i, endCol: sm.index + sm[0].length, tokenType: 'string' });
  }
  return highlights;
}

function queryTree(node: ParseNode, pattern: string): ParseNode[] {
  const results: ParseNode[] = []; const typeMatch = pattern.match(/\(\s*(\w+)/); if (!typeMatch) return results; const targetType = typeMatch[1];
  function walk(n: ParseNode): void { if (n.type === targetType) results.push(n); for (const child of n.children) walk(child); } walk(node); return results;
}

const _handler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId(); let p = createProgram(); p = find(p, RELATION, { language: 'theme-spec' }, 'existing');
    return branch(p, (b) => (b.existing as unknown[]).length > 0,
      (() => { const t = createProgram(); return completeFrom(t, 'ok', (b) => ({ instance: (b.existing as Record<string, unknown>[])[0].id as string })); })(),
      (() => { let e = createProgram(); e = put(e, RELATION, id, { id, grammarRef: 'tree-sitter-theme-spec', wasmPath: 'tree-sitter-theme-spec.wasm', language: 'theme-spec', extensions: JSON.stringify(['.theme']), grammarVersion: '1.0.0' }); return complete(e, 'ok', { instance: id }) as StorageProgram<Result>; })(),
    ) as StorageProgram<Result>;
  },
  parse(input: Record<string, unknown>) { const source = input.source as string; try { const tree = parseThemeSpec(source); const p = createProgram(); return complete(p, 'ok', { tree: JSON.stringify(tree) }) as StorageProgram<Result>; } catch (e) { const p = createProgram(); return complete(p, 'parseError', { message: String(e) }) as StorageProgram<Result>; } },
  highlight(input: Record<string, unknown>) { const source = input.source as string; try { const ranges = highlightThemeSpec(source); const p = createProgram(); return complete(p, 'ok', { highlights: JSON.stringify(ranges) }) as StorageProgram<Result>; } catch (e) { const p = createProgram(); return complete(p, 'highlightError', { message: String(e) }) as StorageProgram<Result>; } },
  query(input: Record<string, unknown>) { const pattern = input.pattern as string; const source = input.source as string; try { const tree = parseThemeSpec(source); const matches = queryTree(tree, pattern); const p = createProgram(); return complete(p, 'ok', { matches: JSON.stringify(matches) }) as StorageProgram<Result>; } catch (e) { const p = createProgram(); return complete(p, 'queryError', { message: String(e) }) as StorageProgram<Result>; } },
  register(input: Record<string, unknown>) {
    const instanceId = input.instance as string | undefined;
    if (instanceId) { let p = createProgram(); p = get(p, RELATION, instanceId, 'record'); return completeFrom(p, 'ok', (b) => ({ language: 'theme-spec', extensions: JSON.stringify(['.theme']), grammarVersion: '1.0.0', registered: b.record !== null })); }
    const p = createProgram(); return complete(p, 'ok', { language: 'theme-spec', extensions: JSON.stringify(['.theme']), grammarVersion: '1.0.0', registered: false }) as StorageProgram<Result>;
  },
};

export const treeSitterThemeSpecHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetTreeSitterThemeSpecCounter(): void { idCounter = 0; }
