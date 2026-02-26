// ScoreApi Concept Implementation
//
// Unified facade over the five Score kits providing a single
// LLM-friendly surface for querying any COPF project's structure,
// symbols, semantics, data flows, and search indexes. Every Clef
// app gets ScoreApi registered automatically.
//
// This handler delegates to the ScoreIndex for materialized data
// and to the underlying Score kit concepts for complex queries
// (dependence graph traversal, data flow analysis, embeddings).

import type { ConceptHandler, ConceptStorage } from '@clef/kernel';

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

export const scoreApiHandler: ConceptHandler = {

  // ─── Structural Queries (Parse Layer) ─────────────────

  async listFiles(input, storage) {
    const pattern = (input.pattern as string) || '*';
    const allFiles = await storage.find('files');

    const matched = allFiles.filter(f => matchGlob(pattern, f.filePath as string));

    if (matched.length === 0) {
      return { variant: 'empty', pattern };
    }

    const files = matched.map(f => ({
      path: f.filePath as string,
      language: (f.language as string) || inferLanguage(f.filePath as string),
      role: (f.role as string) || inferRole(f.filePath as string),
      size: 0,
    }));

    return { variant: 'ok', files };
  },

  async getFileTree(input, storage) {
    const path = (input.path as string) || '.';
    const depth = (input.depth as number) || 0;

    const allFiles = await storage.find('files');
    const paths = allFiles.map(f => f.filePath as string);

    if (paths.length === 0) {
      return { variant: 'notFound', path };
    }

    const { tree, fileCount, dirCount } = buildTreeFromPaths(paths, path, depth);

    return { variant: 'ok', tree, fileCount, dirCount };
  },

  async getFileContent(input, storage) {
    const path = input.path as string;
    if (!path) {
      return { variant: 'notFound', path: '' };
    }

    const fileEntry = await storage.get('files', `file:${path}`);
    if (!fileEntry) {
      return { variant: 'notFound', path };
    }

    // Content comes from the file system via the Score parse layer.
    // The handler returns what's available in the index.
    const language = (fileEntry.language as string) || inferLanguage(path);
    const definitions = (fileEntry.definitions as string[]) || [];

    return {
      variant: 'ok',
      content: `[File: ${path}]`,
      language,
      definitions,
    };
  },

  async getDefinitions(input, storage) {
    const path = input.path as string;
    if (!path) {
      return { variant: 'notFound', path: '' };
    }

    const symbols = await storage.find('symbols', { file: path });
    if (symbols.length === 0) {
      return { variant: 'notFound', path };
    }

    const definitions = symbols.map(s => ({
      name: s.symbolName as string,
      kind: s.symbolKind as string,
      line: s.line as number,
      span: `${path}:${s.line}`,
    }));

    return { variant: 'ok', definitions };
  },

  async matchPattern(input, _storage) {
    const pattern = input.pattern as string;
    const language = input.language as string;

    if (!pattern) {
      return { variant: 'invalidPattern', pattern: '', error: 'Pattern is required' };
    }

    // Pattern matching delegates to the SyntaxTree concept via
    // StructuralPattern. This stub returns the interface contract;
    // the actual tree-sitter query execution happens in the parse kit.
    return {
      variant: 'ok',
      matches: [],
    };
  },

  // ─── Symbol Queries (Symbol Layer) ────────────────────

  async findSymbol(input, storage) {
    const name = input.name as string;
    if (!name) {
      return { variant: 'notFound', name: '' };
    }

    const allSymbols = await storage.find('symbols');
    const matched = allSymbols.filter(s =>
      (s.symbolName as string).toLowerCase().includes(name.toLowerCase())
    );

    if (matched.length === 0) {
      return { variant: 'notFound', name };
    }

    const symbols = matched.map(s => ({
      name: s.symbolName as string,
      kind: s.symbolKind as string,
      file: s.file as string,
      line: s.line as number,
      scope: s.scope as string,
    }));

    return { variant: 'ok', symbols };
  },

  async getReferences(input, storage) {
    const symbol = input.symbol as string;
    if (!symbol) {
      return { variant: 'notFound', symbol: '' };
    }

    // Find the definition
    const allSymbols = await storage.find('symbols', { symbolName: symbol });
    if (allSymbols.length === 0) {
      return { variant: 'notFound', symbol };
    }

    const def = allSymbols[0];
    const definition = {
      file: def.file as string,
      line: def.line as number,
    };

    // References come from the Symbol/SymbolOccurrence layer.
    // This returns what's indexed; full cross-file resolution
    // requires the symbol kit's scope graph.
    const references = allSymbols.slice(1).map(s => ({
      file: s.file as string,
      line: s.line as number,
      kind: 'reference',
    }));

    return { variant: 'ok', definition, references };
  },

  async getScope(input, storage) {
    const file = input.file as string;
    const line = input.line as number;

    if (!file) {
      return { variant: 'notFound', file: '' };
    }

    const symbols = await storage.find('symbols', { file });
    if (symbols.length === 0) {
      return { variant: 'notFound', file };
    }

    // Find the closest enclosing scope
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
  },

  async getRelationships(input, storage) {
    const symbol = input.symbol as string;
    if (!symbol) {
      return { variant: 'notFound', symbol: '' };
    }

    const allSymbols = await storage.find('symbols', { symbolName: symbol });
    if (allSymbols.length === 0) {
      return { variant: 'notFound', symbol };
    }

    // Relationships come from the SymbolRelationship concept.
    // This stub returns the interface contract.
    return {
      variant: 'ok',
      relationships: [],
    };
  },

  // ─── Semantic Queries (Semantic Layer) ────────────────

  async listConcepts(_input, storage) {
    const allConcepts = await storage.find('concepts');

    const concepts = allConcepts.map(c => ({
      name: c.conceptName as string,
      purpose: c.purpose as string,
      actions: (c.actions as string[]) || [],
      stateFields: (c.stateFields as string[]) || [],
      file: c.file as string,
    }));

    return { variant: 'ok', concepts };
  },

  async getConcept(input, storage) {
    const name = input.name as string;
    if (!name) {
      return { variant: 'notFound', name: '' };
    }

    const entry = await storage.get('concepts', `concept:${name}`);
    if (!entry) {
      return { variant: 'notFound', name };
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
  },

  async getAction(input, storage) {
    const conceptName = input.concept as string;
    const actionName = input.action as string;

    if (!conceptName || !actionName) {
      return { variant: 'notFound', concept: conceptName || '', action: actionName || '' };
    }

    const entry = await storage.get('concepts', `concept:${conceptName}`);
    if (!entry) {
      return { variant: 'notFound', concept: conceptName, action: actionName };
    }

    const actions = (entry.actions as string[]) || [];
    if (!actions.includes(actionName)) {
      return { variant: 'notFound', concept: conceptName, action: actionName };
    }

    // Detailed action info comes from the semantic layer.
    // Return the indexed summary.
    const action = {
      name: actionName,
      params: [],
      variants: [],
      description: '',
    };

    return { variant: 'ok', action };
  },

  async listSyncs(_input, storage) {
    const allSyncs = await storage.find('syncs');

    const syncs = allSyncs.map(s => ({
      name: s.syncName as string,
      annotation: s.annotation as string,
      triggers: (s.triggers as string[]) || [],
      effects: (s.effects as string[]) || [],
      file: s.file as string,
    }));

    return { variant: 'ok', syncs };
  },

  async getSync(input, storage) {
    const name = input.name as string;
    if (!name) {
      return { variant: 'notFound', name: '' };
    }

    const entry = await storage.get('syncs', `sync:${name}`);
    if (!entry) {
      return { variant: 'notFound', name };
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
  },

  async getFlow(input, storage) {
    const startConcept = input.startConcept as string;
    const startAction = input.startAction as string;

    if (!startConcept || !startAction) {
      return { variant: 'notFound', concept: startConcept || '', action: startAction || '' };
    }

    // Flow tracing uses the static flow graph from the analysis
    // layer. Walk syncs that trigger on the starting action.
    const allSyncs = await storage.find('syncs');
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

    if (flow.length === 0) {
      return { variant: 'notFound', concept: startConcept, action: startAction };
    }

    return { variant: 'ok', flow };
  },

  // ─── Analysis Queries (Analysis Layer) ────────────────

  async getDependencies(input, _storage) {
    const symbol = input.symbol as string;
    if (!symbol) {
      return { variant: 'notFound', symbol: '' };
    }

    // Delegates to the DependenceGraph concept.
    // Stub returns the interface contract.
    return {
      variant: 'ok',
      directDeps: [],
      transitiveDeps: [],
    };
  },

  async getDependents(input, _storage) {
    const symbol = input.symbol as string;
    if (!symbol) {
      return { variant: 'notFound', symbol: '' };
    }

    return {
      variant: 'ok',
      directDeps: [],
      transitiveDeps: [],
    };
  },

  async getImpact(input, _storage) {
    const file = input.file as string;
    if (!file) {
      return { variant: 'notFound', file: '' };
    }

    return {
      variant: 'ok',
      directImpact: [],
      transitiveImpact: [],
    };
  },

  async getDataFlow(input, _storage) {
    const from = input.from as string;
    const to = input.to as string;

    if (!from || !to) {
      return { variant: 'noPath', from: from || '', to: to || '' };
    }

    return {
      variant: 'ok',
      paths: [],
    };
  },

  // ─── Discovery Queries (Discovery Layer) ──────────────

  async search(input, storage) {
    const query = (input.query as string) || '';
    const limit = (input.limit as number) || 20;

    if (!query) {
      return { variant: 'empty', query: '' };
    }

    const queryLower = query.toLowerCase();
    const results: Array<{ name: string; kind: string; file: string; line: number; score: number; snippet: string }> = [];

    // Search concepts
    const concepts = await storage.find('concepts');
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

    // Search syncs
    const syncs = await storage.find('syncs');
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

    // Search symbols
    const symbols = await storage.find('symbols');
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

    if (limited.length === 0) {
      return { variant: 'empty', query };
    }

    return { variant: 'ok', results: limited };
  },

  async explain(input, storage) {
    const symbol = input.symbol as string;
    if (!symbol) {
      return { variant: 'notFound', symbol: '' };
    }

    // Check concepts first
    const conceptEntry = await storage.get('concepts', `concept:${symbol}`);
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

    // Check syncs
    const syncEntry = await storage.get('syncs', `sync:${symbol}`);
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

    // Check symbols
    const allSymbols = await storage.find('symbols', { symbolName: symbol });
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

    return { variant: 'notFound', symbol };
  },

  // ─── Index Management ─────────────────────────────────

  async status(_input, storage) {
    const concepts = await storage.find('concepts');
    const syncs = await storage.find('syncs');
    const symbols = await storage.find('symbols');
    const files = await storage.find('files');
    const meta = await storage.get('meta', 'concepts');

    return {
      variant: 'ok',
      indexed: concepts.length > 0 || files.length > 0,
      conceptCount: concepts.length,
      symbolCount: symbols.length,
      fileCount: files.length,
      syncCount: syncs.length,
      lastIndexed: meta?.lastUpdated || new Date(0).toISOString(),
    };
  },

  async reindex(_input, storage) {
    const start = Date.now();

    // Clear existing index
    const concepts = await storage.find('concepts');
    const syncs = await storage.find('syncs');
    const symbols = await storage.find('symbols');
    const files = await storage.find('files');

    for (const c of concepts) await storage.del('concepts', `concept:${c.conceptName}`);
    for (const s of syncs) await storage.del('syncs', `sync:${s.syncName}`);
    for (const sym of symbols) await storage.del('symbols', `symbol:${sym.symbolName}:${sym.file}:${sym.line}`);
    for (const f of files) await storage.del('files', `file:${f.filePath}`);

    // The actual reindex is triggered by syncs:
    // reindex → completion fires ScoreOnDeploySync and other
    // indexing syncs which repopulate the index.
    // This action returns immediately; the sync engine handles
    // the cascading reindex.

    const duration = Date.now() - start;

    return {
      variant: 'ok',
      conceptCount: 0,
      symbolCount: 0,
      fileCount: 0,
      syncCount: 0,
      duration,
    };
  },
};
