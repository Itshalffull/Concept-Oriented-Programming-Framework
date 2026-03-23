// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ScoreApi Concept Implementation
//
// Unified facade over the five Score suites providing a single
// LLM-friendly surface for querying any Clef project's structure,
// symbols, semantics, data flows, and search indexes. Every Clef
// app gets ScoreApi registered automatically.
//
// This handler delegates to the ScoreIndex for materialized data
// and to the underlying Score suite concepts for complex queries
// (dependence graph traversal, data flow analysis, embeddings).
//
// External kernel dispatch is modeled via `perform` transport
// effects. The interpreter handles the actual async calls.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, del, merge, branch, complete, completeFrom,
  mapBindings, putFrom, mergeFrom, perform, type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

// ─── Helpers ─────────────────────────────────────────────

function inferLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    concept: 'concept-spec', sync: 'sync-spec', yaml: 'yaml', yml: 'yaml',
    json: 'json', md: 'markdown', rs: 'rust', swift: 'swift', sol: 'solidity',
    py: 'python', go: 'go', java: 'java', css: 'css', html: 'html',
  };
  return langMap[ext] || ext || 'unknown';
}

function inferRole(path: string): string {
  if (path.includes('/generated/')) return 'generated';
  if (path.includes('/test') || path.endsWith('.test.ts')) return 'test';
  if (path.endsWith('.concept') || path.endsWith('.sync')) return 'spec';
  if (path.endsWith('.yaml') || path.endsWith('.yml') || path.endsWith('.json')) return 'config';
  if (path.endsWith('.md')) return 'doc';
  return 'source';
}

function matchGlob(pattern: string, path: string): boolean {
  if (pattern === '*') return true;
  const regexStr = pattern
    .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
    .replace(/\*/g, '[^/]*')
    .replace(/<<<DOUBLESTAR>>>/g, '.*')
    .replace(/\?/g, '.');
  return new RegExp(`^${regexStr}$`).test(path);
}

function buildTreeFromPaths(paths: string[], rootPath: string, maxDepth: number): { tree: string; fileCount: number; dirCount: number } {
  const normalizedRoot = rootPath.replace(/\/$/, '');
  const filtered = paths
    .map(p => {
      if (p.startsWith(normalizedRoot + '/')) return p.slice(normalizedRoot.length + 1);
      if (p.startsWith(normalizedRoot)) return p.slice(normalizedRoot.length);
      return null;
    })
    .filter((p): p is string => p !== null && p.length > 0);

  const dirs = new Set<string>();
  let fileCount = 0;
  const lines: string[] = [normalizedRoot.split('/').pop() || '.'];

  // Build sorted entries with depth filtering
  const entries: Array<{ parts: string[]; isDir: boolean }> = [];
  for (const rel of filtered) {
    const parts = rel.split('/');
    if (maxDepth > 0 && parts.length > maxDepth) {
      // Still count the dir at max depth
      const dirParts = parts.slice(0, maxDepth);
      dirs.add(dirParts.join('/'));
      continue;
    }
    entries.push({ parts, isDir: false });
    fileCount++;
    // Register all parent dirs
    for (let i = 1; i < parts.length; i++) {
      dirs.add(parts.slice(0, i).join('/'));
    }
  }

  // Simple indented tree
  const sorted = [...new Set([...Array.from(dirs), ...filtered])].sort();
  for (const entry of sorted) {
    const parts = entry.split('/');
    if (maxDepth > 0 && parts.length > maxDepth) continue;
    const indent = '  '.repeat(parts.length);
    const name = parts[parts.length - 1];
    const isDir = dirs.has(entry);
    lines.push(`${indent}${isDir ? name + '/' : name}`);
  }

  return { tree: lines.join('\n'), fileCount, dirCount: dirs.size };
}

// ─── ScoreApi Handler ────────────────────────────────────

type Result = { variant: string; [key: string]: unknown };

const _handler: FunctionalConceptHandler = {

  // ─── Structural Queries (Parse Layer) ─────────────────

  listFiles(input: Record<string, unknown>) {
    if (!input.pattern || (typeof input.pattern === 'string' && (input.pattern as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'pattern is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const pattern = (input.pattern as string) || '*';
    p = find(p, 'files', {}, 'allFiles');

    return completeFrom(p, '_deferred_listFiles', (bindings) => {
      const allFiles = bindings.allFiles as Array<Record<string, unknown>>;
      const matched = allFiles.filter(f => matchGlob(pattern, f.filePath as string));

      const files = matched.map(f => ({
        path: f.filePath as string,
        language: (f.language as string) || inferLanguage(f.filePath as string),
        role: (f.role as string) || inferRole(f.filePath as string),
        size: 0,
      }));

      return { variant: 'ok', files };
    }) as StorageProgram<Result>;
  },

  getFileTree(input: Record<string, unknown>) {
    let p = createProgram();
    const path = (input.path as string) || '.';
    const depth = (input.depth as number) || 0;

    p = find(p, 'files', {}, 'allFiles');

    return completeFrom(p, '_deferred_getFileTree', (bindings) => {
      const allFiles = bindings.allFiles as Array<Record<string, unknown>>;
      const paths = allFiles.map(f => f.filePath as string);

      const { tree, fileCount, dirCount } = buildTreeFromPaths(paths, path, depth);

      return { variant: 'ok', tree, fileCount, dirCount };
    }) as StorageProgram<Result>;
  },

  getFileContent(input: Record<string, unknown>) {
    if (!input.path || (typeof input.path === 'string' && (input.path as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'path is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const path = input.path as string;
    if (!path) {
      return complete(p, 'notFound', { path: '' }) as StorageProgram<Result>;
    }

    p = get(p, 'files', `file:${path}`, 'fileEntry');

    return completeFrom(p, '_deferred_getFileContent', (bindings) => {
      const fileEntry = bindings.fileEntry as Record<string, unknown> | null;
      if (!fileEntry) {
        return { variant: 'ok', path };
      }

      const language = (fileEntry.language as string) || inferLanguage(path);
      const definitions = (fileEntry.definitions as string[]) || [];

      return {
        variant: 'ok',
        content: `[File: ${path}]`,
        language,
        definitions,
      };
    }) as StorageProgram<Result>;
  },

  getDefinitions(input: Record<string, unknown>) {
    if (!input.path || (typeof input.path === 'string' && (input.path as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'path is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const path = input.path as string;
    if (!path) {
      return complete(p, 'notFound', { path: '' }) as StorageProgram<Result>;
    }

    p = find(p, 'symbols', { file: path }, 'symbols');

    return completeFrom(p, '_deferred_getDefinitions', (bindings) => {
      const symbols = bindings.symbols as Array<Record<string, unknown>>;
      if (symbols.length === 0) {
        return { variant: 'ok', definitions: [] };
      }

      const definitions = symbols.map(s => ({
        name: s.symbolName as string,
        kind: s.symbolKind as string,
        line: s.line as number,
        span: `${path}:${s.line}`,
      }));

      return { variant: 'ok', definitions };
    }) as StorageProgram<Result>;
  },

  matchPattern(input: Record<string, unknown>) {
    let p = createProgram();
    const pattern = input.pattern as string;
    const language = input.language as string;

    if (!pattern) {
      return complete(p, 'invalidPattern', { pattern: '', error: 'Pattern is required' }) as StorageProgram<Result>;
    }

    // Dispatch to SyntaxTree/query via transport effect for each parsed tree.
    p = find(p, 'files', {}, 'allFiles');
    p = perform(p, 'kernel', 'matchPattern', { pattern, language }, 'matchResult');

    return completeFrom(p, '_deferred_matchPattern', (bindings) => {
      const matchResult = bindings.matchResult as Record<string, unknown> | null;
      const matches = matchResult?.matches as Array<Record<string, unknown>> ?? [];
      return { variant: 'ok', matches };
    }) as StorageProgram<Result>;
  },

  // ─── Symbol Queries (Symbol Layer) ────────────────────

  findSymbol(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const name = input.name as string;
    if (!name) {
      return complete(p, 'notFound', { name: '' }) as StorageProgram<Result>;
    }

    p = find(p, 'symbols', {}, 'allSymbols');

    return completeFrom(p, '_deferred_findSymbol', (bindings) => {
      const allSymbols = bindings.allSymbols as Array<Record<string, unknown>>;
      const matched = allSymbols.filter(s =>
        (s.symbolName as string).toLowerCase().includes(name.toLowerCase())
      );

      if (matched.length === 0) {
        return { variant: 'ok', symbols: [] };
      }

      const symbols = matched.map(s => ({
        name: s.symbolName as string,
        kind: s.symbolKind as string,
        file: s.file as string,
        line: s.line as number,
        scope: s.scope as string,
      }));

      return { variant: 'ok', symbols };
    }) as StorageProgram<Result>;
  },

  getReferences(input: Record<string, unknown>) {
    if (!input.symbol || (typeof input.symbol === 'string' && (input.symbol as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'symbol is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const symbol = input.symbol as string;
    if (!symbol) {
      return complete(p, 'notFound', { symbol: '' }) as StorageProgram<Result>;
    }

    p = find(p, 'symbols', { symbolName: symbol }, 'allSymbols');

    return completeFrom(p, '_deferred_getReferences', (bindings) => {
      const allSymbols = bindings.allSymbols as Array<Record<string, unknown>>;
      if (allSymbols.length === 0) {
        return { variant: 'ok', definition: { file: '', line: 0 }, references: [] };
      }

      const def = allSymbols[0];
      const definition = {
        file: def.file as string,
        line: def.line as number,
      };

      const references = allSymbols.slice(1).map(s => ({
        file: s.file as string,
        line: s.line as number,
        kind: 'reference',
      }));

      return { variant: 'ok', definition, references };
    }) as StorageProgram<Result>;
  },

  getScope(input: Record<string, unknown>) {
    if (!input.file || (typeof input.file === 'string' && (input.file as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'file is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const file = input.file as string;
    const line = input.line as number;

    if (!file) {
      return complete(p, 'notFound', { file: '' }) as StorageProgram<Result>;
    }

    p = find(p, 'symbols', { file }, 'symbols');

    return completeFrom(p, '_deferred_getScope', (bindings) => {
      const symbols = bindings.symbols as Array<Record<string, unknown>>;
      if (symbols.length === 0) {
        return { variant: 'ok', scope: 'global', symbols: [], parent: undefined };
      }

      const nearestSymbols = symbols
        .filter(s => (s.line as number) <= line)
        .sort((a, b) => (b.line as number) - (a.line as number));

      const scopeSymbol = nearestSymbols[0];
      const scopeName = scopeSymbol ? (scopeSymbol.scope as string) || 'global' : 'global';

      const visibleSymbols = symbols.map(s => ({
        name: s.symbolName as string,
        kind: s.symbolKind as string,
      }));

      return {
        variant: 'ok',
        scope: scopeName,
        symbols: visibleSymbols,
        parent: undefined,
      };
    }) as StorageProgram<Result>;
  },

  getRelationships(input: Record<string, unknown>) {
    if (!input.symbol || (typeof input.symbol === 'string' && (input.symbol as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'symbol is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const symbol = input.symbol as string;
    if (!symbol) {
      return complete(p, 'notFound', { symbol: '' }) as StorageProgram<Result>;
    }

    p = find(p, 'symbols', { symbolName: symbol }, 'allSymbols');

    // Dispatch to SymbolRelationship concept via transport effects
    p = perform(p, 'kernel', 'findRelationshipsFrom', { source: symbol, kind: '' }, 'outgoing');
    p = perform(p, 'kernel', 'findRelationshipsTo', { target: symbol, kind: '' }, 'incoming');

    return completeFrom(p, '_deferred_getRelationships', (bindings) => {
      const allSymbols = bindings.allSymbols as Array<Record<string, unknown>>;
      const relationships: Array<Record<string, unknown>> = [];

      if (allSymbols.length > 0) {
        const outgoing = bindings.outgoing as Record<string, unknown> | null;
        if (outgoing?.variant === 'ok') {
          const rels: unknown[] = (() => {
            try { return JSON.parse(outgoing.relationships as string || '[]'); } catch { return []; }
          })();
          relationships.push(...(rels as Array<Record<string, unknown>>));
        }

        const incoming = bindings.incoming as Record<string, unknown> | null;
        if (incoming?.variant === 'ok') {
          const rels: unknown[] = (() => {
            try { return JSON.parse(incoming.relationships as string || '[]'); } catch { return []; }
          })();
          relationships.push(...(rels as Array<Record<string, unknown>>));
        }
      }

      return { variant: 'ok', relationships };
    }) as StorageProgram<Result>;
  },

  // ─── Semantic Queries (Semantic Layer) ────────────────

  listConcepts(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'concepts', {}, 'allConcepts');

    return completeFrom(p, '_deferred_listConcepts', (bindings) => {
      const allConcepts = bindings.allConcepts as Array<Record<string, unknown>>;
      const concepts = allConcepts.map(c => ({
        name: c.conceptName as string,
        purpose: c.purpose as string,
        actions: (c.actions as string[]) || [],
        stateFields: (c.stateFields as string[]) || [],
        file: c.file as string,
      }));

      return { variant: 'ok', concepts };
    }) as StorageProgram<Result>;
  },

  getConcept(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const name = input.name as string;
    if (!name) {
      return complete(p, 'notFound', { name: '' }) as StorageProgram<Result>;
    }

    p = get(p, 'concepts', `concept:${name}`, 'entry');

    return completeFrom(p, '_deferred_getConcept', (bindings) => {
      const entry = bindings.entry as Record<string, unknown> | null;
      if (!entry) {
        return { variant: 'ok', name };
      }

      const concept = {
        name: entry.conceptName as string,
        purpose: entry.purpose as string,
        typeParams: [],
        actions: ((entry.actions as string[]) || []).map(a => ({
          name: a,
          params: [],
          variants: [],
        })),
        stateFields: ((entry.stateFields as string[]) || []).map(f => ({
          name: f,
          type: 'unknown',
          relation: 'default',
        })),
        invariants: [],
        file: entry.file as string,
      };

      return { variant: 'ok', concept };
    }) as StorageProgram<Result>;
  },

  getAction(input: Record<string, unknown>) {
    if (!input.concept || (typeof input.concept === 'string' && (input.concept as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'concept is required' }) as StorageProgram<Result>;
    }
    if (!input.action || (typeof input.action === 'string' && (input.action as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'action is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const conceptName = input.concept as string;
    const actionName = input.action as string;

    if (!conceptName || !actionName) {
      return complete(p, 'notFound', { concept: conceptName || '', action: actionName || '' }) as StorageProgram<Result>;
    }

    // Try ActionEntity via kernel dispatch for full semantic detail
    p = perform(p, 'kernel', 'getAction', { name: actionName, concept: conceptName }, 'actionResult');

    // Fallback: read from ScoreApi's own indexed data
    p = get(p, 'concepts', `concept:${conceptName}`, 'entry');

    return completeFrom(p, '_deferred_getAction', (bindings) => {
      const actionResult = bindings.actionResult as Record<string, unknown> | null;
      if (actionResult?.variant === 'ok') {
        return { variant: 'ok', action: actionResult.action || actionResult };
      }

      const entry = bindings.entry as Record<string, unknown> | null;
      if (!entry) {
        return { variant: 'ok', concept: conceptName, action: actionName };
      }

      const actions = (entry.actions as string[]) || [];
      if (!actions.includes(actionName)) {
        return { variant: 'ok', concept: conceptName, action: actionName };
      }

      const action = {
        name: actionName,
        params: [],
        variants: [],
        description: '',
      };

      return { variant: 'ok', action };
    }) as StorageProgram<Result>;
  },

  listSyncs(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'syncs', {}, 'allSyncs');

    return completeFrom(p, '_deferred_listSyncs', (bindings) => {
      const allSyncs = bindings.allSyncs as Array<Record<string, unknown>>;
      const syncs = allSyncs.map(s => ({
        name: s.syncName as string,
        annotation: s.annotation as string,
        triggers: (s.triggers as string[]) || [],
        effects: (s.effects as string[]) || [],
        file: s.file as string,
      }));

      return { variant: 'ok', syncs };
    }) as StorageProgram<Result>;
  },

  getSync(input: Record<string, unknown>) {
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const name = input.name as string;
    if (!name) {
      return complete(p, 'notFound', { name: '' }) as StorageProgram<Result>;
    }

    p = get(p, 'syncs', `sync:${name}`, 'entry');

    return completeFrom(p, '_deferred_getSync', (bindings) => {
      const entry = bindings.entry as Record<string, unknown> | null;
      if (!entry) {
        return { variant: 'ok', name };
      }

      const sync = {
        name: entry.syncName as string,
        annotation: entry.annotation as string,
        when: [],
        where: [],
        then: [],
        file: entry.file as string,
      };

      return { variant: 'ok', sync };
    }) as StorageProgram<Result>;
  },

  getFlow(input: Record<string, unknown>) {
    if (!input.startConcept || (typeof input.startConcept === 'string' && (input.startConcept as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'startConcept is required' }) as StorageProgram<Result>;
    }
    if (!input.startAction || (typeof input.startAction === 'string' && (input.startAction as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'startAction is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const startConcept = input.startConcept as string;
    const startAction = input.startAction as string;

    if (!startConcept || !startAction) {
      return complete(p, 'notFound', { concept: startConcept || '', action: startAction || '' }) as StorageProgram<Result>;
    }

    p = find(p, 'syncs', {}, 'allSyncs');

    return completeFrom(p, '_deferred_getFlow', (bindings) => {
      const allSyncs = bindings.allSyncs as Array<Record<string, unknown>>;
      const flow: Array<{ step: number; concept: string; action: string; sync: string; variant: string }> = [];

      let step = 0;
      const visited = new Set<string>();
      const queue = [`${startConcept}/${startAction}`];

      while (queue.length > 0 && step < 50) {
        const current = queue.shift()!;
        if (visited.has(current)) continue;
        visited.add(current);

        const [concept, action] = current.split('/');
        flow.push({ step: step++, concept, action, sync: '', variant: 'ok' });

        // Find syncs triggered by this action
        for (const syncEntry of allSyncs) {
          const triggers = (syncEntry.triggers as string[]) || [];
          if (triggers.some(t => t.includes(concept) && t.includes(action))) {
            const effects = (syncEntry.effects as string[]) || [];
            for (const effect of effects) {
              flow.push({
                step: step++,
                concept: effect.split('/')[0] || effect,
                action: effect.split('/')[1] || effect,
                sync: syncEntry.syncName as string,
                variant: 'ok',
              });
              queue.push(effect);
            }
          }
        }
      }

      return { variant: 'ok', flow };
    }) as StorageProgram<Result>;
  },

  // ─── Analysis Queries (Analysis Layer) ────────────────

  getDependencies(input: Record<string, unknown>) {
    if (!input.symbol || (typeof input.symbol === 'string' && (input.symbol as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'symbol is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const symbol = input.symbol as string;
    if (!symbol) {
      return complete(p, 'notFound', { symbol: '' }) as StorageProgram<Result>;
    }

    // Dispatch to DependenceGraph concept via kernel transport effect
    p = perform(p, 'kernel', 'queryDependencies', { source: symbol, edgeKinds: '' }, 'depResult');

    return completeFrom(p, '_deferred_getDependencies', (bindings) => {
      const result = bindings.depResult as Record<string, unknown> | null;
      if (result?.variant === 'ok') {
        const deps: unknown[] = (() => {
          try { return JSON.parse(result.dependencies as string || '[]'); } catch { return []; }
        })();
        return {
          variant: 'ok',
          directDeps: deps,
          transitiveDeps: [],
        };
      }

      return { variant: 'ok', directDeps: [], transitiveDeps: [] };
    }) as StorageProgram<Result>;
  },

  getDependents(input: Record<string, unknown>) {
    if (!input.symbol || (typeof input.symbol === 'string' && (input.symbol as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'symbol is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const symbol = input.symbol as string;
    if (!symbol) {
      return complete(p, 'notFound', { symbol: '' }) as StorageProgram<Result>;
    }

    // Dispatch to DependenceGraph concept via kernel transport effect
    p = perform(p, 'kernel', 'queryDependents', { target: symbol, edgeKinds: '' }, 'depResult');

    return completeFrom(p, '_deferred_getDependents', (bindings) => {
      const result = bindings.depResult as Record<string, unknown> | null;
      if (result?.variant === 'ok') {
        const deps: unknown[] = (() => {
          try { return JSON.parse(result.dependents as string || '[]'); } catch { return []; }
        })();
        return {
          variant: 'ok',
          directDeps: deps,
          transitiveDeps: [],
        };
      }

      return { variant: 'ok', directDeps: [], transitiveDeps: [] };
    }) as StorageProgram<Result>;
  },

  getImpact(input: Record<string, unknown>) {
    if (!input.file || (typeof input.file === 'string' && (input.file as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'file is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const file = input.file as string;
    if (!file) {
      return complete(p, 'notFound', { file: '' }) as StorageProgram<Result>;
    }

    // Dispatch to DependenceGraph/impactAnalysis via kernel transport effect
    p = perform(p, 'kernel', 'impactAnalysis', { changed: JSON.stringify([file]) }, 'impactResult');

    return completeFrom(p, '_deferred_getImpact', (bindings) => {
      const result = bindings.impactResult as Record<string, unknown> | null;
      if (result?.variant === 'ok') {
        const affected: unknown[] = (() => {
          try { return JSON.parse(result.affected as string || '[]'); } catch { return []; }
        })();
        return {
          variant: 'ok',
          directImpact: affected,
          transitiveImpact: [],
        };
      }

      return { variant: 'ok', directImpact: [], transitiveImpact: [] };
    }) as StorageProgram<Result>;
  },

  getDataFlow(input: Record<string, unknown>) {
    if (!input.from || (typeof input.from === 'string' && (input.from as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'from is required' }) as StorageProgram<Result>;
    }
    if (!input.to || (typeof input.to === 'string' && (input.to as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'to is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const from = input.from as string;
    const to = input.to as string;

    if (!from || !to) {
      return complete(p, 'noPath', { from: from || '', to: to || '' }) as StorageProgram<Result>;
    }

    // Dispatch to DataFlowPath/trace via kernel transport effect
    p = perform(p, 'kernel', 'traceDataFlow', { source: from, sink: to }, 'flowResult');

    return completeFrom(p, '_deferred_getDataFlow', (bindings) => {
      const result = bindings.flowResult as Record<string, unknown> | null;
      if (result?.variant === 'ok') {
        const paths: unknown[] = (() => {
          try { return JSON.parse(result.paths as string || '[]'); } catch { return []; }
        })();
        return { variant: 'ok', paths };
      }

      return { variant: 'ok', paths: [] };
    }) as StorageProgram<Result>;
  },

  // ─── Discovery Queries (Discovery Layer) ──────────────

  search(input: Record<string, unknown>) {
    if (!input.query || (typeof input.query === 'string' && (input.query as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'query is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const query = (input.query as string) || '';
    const limit = (input.limit as number) || 20;

    if (!query) {
      return complete(p, 'empty', { query: '' }) as StorageProgram<Result>;
    }

    p = find(p, 'concepts', {}, 'concepts');
    p = find(p, 'syncs', {}, 'syncs');
    p = find(p, 'symbols', {}, 'symbols');

    return completeFrom(p, '_deferred_search', (bindings) => {
      const queryLower = query.toLowerCase();
      const results: Array<{ name: string; kind: string; file: string; line: number; score: number; snippet: string }> = [];

      const concepts = bindings.concepts as Array<Record<string, unknown>>;
      for (const c of concepts) {
        const name = c.conceptName as string;
        const purpose = c.purpose as string;
        const combined = `${name} ${purpose}`.toLowerCase();
        if (combined.includes(queryLower)) {
          results.push({
            name,
            kind: 'concept',
            file: c.file as string,
            line: 0,
            score: name.toLowerCase().includes(queryLower) ? 1.0 : 0.7,
            snippet: purpose,
          });
        }
      }

      const syncs = bindings.syncs as Array<Record<string, unknown>>;
      for (const s of syncs) {
        const name = s.syncName as string;
        if (name.toLowerCase().includes(queryLower)) {
          results.push({
            name,
            kind: 'sync',
            file: s.file as string,
            line: 0,
            score: 0.8,
            snippet: `${(s.triggers as string[])?.join(', ')} → ${(s.effects as string[])?.join(', ')}`,
          });
        }
      }

      const symbols = bindings.symbols as Array<Record<string, unknown>>;
      for (const sym of symbols) {
        const name = sym.symbolName as string;
        if (name.toLowerCase().includes(queryLower)) {
          results.push({
            name,
            kind: sym.symbolKind as string,
            file: sym.file as string,
            line: sym.line as number,
            score: 0.6,
            snippet: `${sym.symbolKind} in ${sym.file}:${sym.line}`,
          });
        }
      }

      // Sort by score descending and limit
      results.sort((a, b) => b.score - a.score);
      const limited = results.slice(0, limit);

      return { variant: 'ok', results: limited };
    }) as StorageProgram<Result>;
  },

  explain(input: Record<string, unknown>) {
    if (!input.symbol || (typeof input.symbol === 'string' && (input.symbol as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'symbol is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const symbol = input.symbol as string;
    if (!symbol) {
      return complete(p, 'notFound', { symbol: '' }) as StorageProgram<Result>;
    }

    // Check concepts, syncs, and symbols
    p = get(p, 'concepts', `concept:${symbol}`, 'conceptEntry');
    p = get(p, 'syncs', `sync:${symbol}`, 'syncEntry');
    p = find(p, 'symbols', { symbolName: symbol }, 'allSymbols');

    return completeFrom(p, '_deferred_explain', (bindings) => {
      const conceptEntry = bindings.conceptEntry as Record<string, unknown> | null;
      if (conceptEntry) {
        const name = conceptEntry.conceptName as string;
        const purpose = conceptEntry.purpose as string;
        const actions = (conceptEntry.actions as string[]) || [];
        const file = conceptEntry.file as string;

        return {
          variant: 'ok',
          summary: `${name} is a concept defined in ${file}. ${purpose} It has ${actions.length} actions: ${actions.join(', ')}.`,
          kind: 'concept',
          definedIn: file,
          usedBy: [],
          relationships: [],
        };
      }

      const syncEntry = bindings.syncEntry as Record<string, unknown> | null;
      if (syncEntry) {
        const name = syncEntry.syncName as string;
        const annotation = syncEntry.annotation as string;
        const triggers = (syncEntry.triggers as string[]) || [];
        const effects = (syncEntry.effects as string[]) || [];
        const file = syncEntry.file as string;

        return {
          variant: 'ok',
          summary: `${name} is an [${annotation}] sync rule defined in ${file}. It triggers on ${triggers.join(', ')} and invokes ${effects.join(', ')}.`,
          kind: 'sync',
          definedIn: file,
          usedBy: [],
          relationships: triggers.concat(effects),
        };
      }

      const allSymbols = bindings.allSymbols as Array<Record<string, unknown>>;
      if (allSymbols.length > 0) {
        const first = allSymbols[0];
        const name = first.symbolName as string;
        const kind = first.symbolKind as string;
        const file = first.file as string;
        const line = first.line as number;

        return {
          variant: 'ok',
          summary: `${name} is a ${kind} defined at ${file}:${line}. It appears in ${allSymbols.length} location(s).`,
          kind,
          definedIn: `${file}:${line}`,
          usedBy: allSymbols.slice(1).map(s => `${s.file}:${s.line}`),
          relationships: [],
        };
      }

      return { variant: 'ok', summary: `Symbol ${symbol} not found.`, kind: 'unknown', definedIn: '', usedBy: [], relationships: [] };
    }) as StorageProgram<Result>;
  },

  // ─── Implementation Queries ─────────────────────────────

  implementationGaps(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'concepts', {}, 'allConcepts');
    p = find(p, 'handlers', {}, 'allHandlers');

    return completeFrom(p, '_deferred_implementationGaps', (bindings) => {
      const allConcepts = bindings.allConcepts as Array<Record<string, unknown>>;
      const allHandlers = bindings.allHandlers as Array<Record<string, unknown>>;
      const gaps: Array<{ concept: string; action: string; declaredIn: string }> = [];

      for (const concept of allConcepts) {
        const conceptName = concept.conceptName as string;
        const actions = (concept.actions as string[]) || [];
        const file = concept.file as string;

        // Find handler for this concept
        const handler = allHandlers.find(h =>
          typeof h.handlerConcept === 'string' &&
          h.handlerConcept.toLowerCase() === conceptName.toLowerCase(),
        );

        if (!handler) {
          for (const action of actions) {
            gaps.push({ concept: conceptName, action, declaredIn: file });
          }
          continue;
        }

        const implementedActions: string[] = (() => {
          try {
            const parsed = JSON.parse(handler.actionMethods as string || '[]');
            return parsed.map((m: { name: string }) => m.name);
          } catch {
            return (handler.handlerActions as string[]) || [];
          }
        })();

        for (const action of actions) {
          if (!implementedActions.some(impl =>
            impl.toLowerCase() === action.toLowerCase(),
          )) {
            gaps.push({ concept: conceptName, action, declaredIn: file });
          }
        }
      }

      return { variant: 'ok', gaps };
    }) as StorageProgram<Result>;
  },

  resolveStackTrace(input: Record<string, unknown>) {
    if (!input.stackTrace || (typeof input.stackTrace === 'string' && (input.stackTrace as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'stackTrace is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const stackTrace = input.stackTrace as string;
    if (!stackTrace) {
      return complete(p, 'ok', { frames: [] }) as StorageProgram<Result>;
    }

    p = find(p, 'handlers', {}, 'allHandlers');

    return completeFrom(p, '_deferred_resolveStackTrace', (bindings) => {
      const allHandlers = bindings.allHandlers as Array<Record<string, unknown>>;
      const frameRegex = /at\s+(?:.*?\s+)?\(?(.+?):(\d+):(\d+)\)?/g;
      const frames: Array<Record<string, unknown>> = [];
      let match: RegExpExecArray | null;

      while ((match = frameRegex.exec(stackTrace)) !== null) {
        const file = match[1];
        const line = parseInt(match[2], 10);
        const col = parseInt(match[3], 10);

        const handler = allHandlers.find(h => h.handlerFile === file || h.sourceFile === file);

        frames.push({
          file,
          line,
          col,
          handler: handler ? handler.id : null,
          concept: handler ? (handler.handlerConcept || handler.concept) : null,
          actionMethod: null,
          astNode: null,
          symbol: handler ? handler.symbol : file.split('/').pop(),
        });
      }

      return { variant: 'ok', frames };
    }) as StorageProgram<Result>;
  },

  traceEndpoint(input: Record<string, unknown>) {
    if (!input.target || (typeof input.target === 'string' && (input.target as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'target is required' }) as StorageProgram<Result>;
    }
    if (!input.path || (typeof input.path === 'string' && (input.path as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'path is required' }) as StorageProgram<Result>;
    }
    if (!input.method || (typeof input.method === 'string' && (input.method as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'method is required' }) as StorageProgram<Result>;
    }
    let p = createProgram();
    const target = input.target as string;
    const path = input.path as string;
    const method = input.method as string;

    // Dispatch to InterfaceEntity via kernel transport effect
    p = perform(p, 'kernel', 'traceEndpointToAction', { target, path, method }, 'traceResult');

    return completeFrom(p, '_deferred_traceEndpoint', (bindings) => {
      const result = bindings.traceResult as Record<string, unknown> | null;
      if (result?.variant === 'ok') {
        return result;
      }

      return { variant: 'ok' };
    }) as StorageProgram<Result>;
  },

  // ─── Index Management ─────────────────────────────────

  status(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'concepts', {}, 'concepts');
    p = find(p, 'syncs', {}, 'syncs');
    p = find(p, 'symbols', {}, 'symbols');
    p = find(p, 'files', {}, 'files');
    p = get(p, 'meta', 'concepts', 'meta');

    return completeFrom(p, '_deferred_status', (bindings) => {
      const concepts = bindings.concepts as Array<Record<string, unknown>>;
      const syncs = bindings.syncs as Array<Record<string, unknown>>;
      const symbols = bindings.symbols as Array<Record<string, unknown>>;
      const files = bindings.files as Array<Record<string, unknown>>;
      const meta = bindings.meta as Record<string, unknown> | null;

      return {
        variant: 'ok',
        indexed: concepts.length > 0 || files.length > 0,
        conceptCount: concepts.length,
        symbolCount: symbols.length,
        fileCount: files.length,
        syncCount: syncs.length,
        lastIndexed: meta?.lastUpdated || new Date(0).toISOString(),
      };
    }) as StorageProgram<Result>;
  },

  reindex(_input: Record<string, unknown>) {
    let p = createProgram();
    const start = Date.now();

    p = find(p, 'concepts', {}, 'concepts');
    p = find(p, 'syncs', {}, 'syncs');
    p = find(p, 'symbols', {}, 'symbols');
    p = find(p, 'files', {}, 'files');

    return completeFrom(p, '_deferred_reindex', (bindings) => {
      const concepts = bindings.concepts as Array<Record<string, unknown>>;
      const syncs = bindings.syncs as Array<Record<string, unknown>>;
      const symbols = bindings.symbols as Array<Record<string, unknown>>;
      const files = bindings.files as Array<Record<string, unknown>>;

      // Build deletion instructions for the interpreter
      const deletions: Array<{ rel: string; key: string }> = [];
      for (const c of concepts) deletions.push({ rel: 'concepts', key: `concept:${c.conceptName}` });
      for (const s of syncs) deletions.push({ rel: 'syncs', key: `sync:${s.syncName}` });
      for (const sym of symbols) deletions.push({ rel: 'symbols', key: `symbol:${sym.symbolName}:${sym.file}:${sym.line}` });
      for (const f of files) deletions.push({ rel: 'files', key: `file:${f.filePath}` });

      const duration = Date.now() - start;

      return {
        variant: 'ok',
        _deletions: deletions,
        conceptCount: 0,
        symbolCount: 0,
        fileCount: 0,
        syncCount: 0,
        duration,
      };
    }) as StorageProgram<Result>;
  },
};

export const scoreApiHandler = autoInterpret(_handler);
