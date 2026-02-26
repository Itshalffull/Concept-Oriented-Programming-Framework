// ============================================================
// SyncScopeProvider Handler
//
// Scope resolution provider for .sync files. Models cross-concept
// references with variable scoping -- when-clause bindings are
// visible in where and then clauses.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `sync-scope-provider-${++idCounter}`;
}

let scopeCounter = 0;
function nextScopeId(): string {
  return `ssp-scope-${++scopeCounter}`;
}

/**
 * Scope node for sync files.
 */
interface ScopeNode {
  id: string;
  kind: string;
  name: string;
  parentId: string | null;
}

/**
 * Declaration within a sync scope.
 */
interface Declaration {
  name: string;
  symbolString: string;
  scopeId: string;
  kind: string;
}

/**
 * Build scope graph from sync spec source text.
 * Scope hierarchy: file (global) -> sync -> when/where/then clauses
 * Variable bindings in when clauses are visible in where and then clauses.
 * The sync itself acts as a scope container, with when-clause bindings
 * propagating downward to where and then scopes.
 */
function buildSyncScopes(source: string, file: string): {
  scopes: ScopeNode[];
  declarations: Declaration[];
  references: Array<{ name: string; scopeId: string; resolved: string | null }>;
} {
  const scopes: ScopeNode[] = [];
  const declarations: Declaration[] = [];
  const references: Array<{ name: string; scopeId: string; resolved: string | null }> = [];

  // Global file scope
  const globalScope: ScopeNode = {
    id: nextScopeId(),
    kind: 'global',
    name: file,
    parentId: null,
  };
  scopes.push(globalScope);

  const lines = source.split('\n');
  let syncScope: ScopeNode | null = null;
  let currentClauseScope: ScopeNode | null = null;
  let syncName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match sync declaration: sync SyncName {
    const syncMatch = line.match(/^\s*sync\s+(\w+)\s*\{/);
    if (syncMatch) {
      syncName = syncMatch[1];

      syncScope = {
        id: nextScopeId(),
        kind: 'module',
        name: syncName,
        parentId: globalScope.id,
      };
      scopes.push(syncScope);

      declarations.push({
        name: syncName,
        symbolString: `clef/sync/${syncName}`,
        scopeId: globalScope.id,
        kind: 'sync',
      });
      continue;
    }

    if (!syncScope) continue;

    // Match when clause: when ConceptName.action(...) -> variant(...)
    const whenMatch = line.match(/^\s+when\b/);
    if (whenMatch) {
      currentClauseScope = {
        id: nextScopeId(),
        kind: 'block',
        name: 'when',
        parentId: syncScope.id,
      };
      scopes.push(currentClauseScope);
    }

    // Match where clause: where ...
    const whereMatch = line.match(/^\s+where\b/);
    if (whereMatch) {
      // where scope is a child of the sync scope so when-bindings are visible
      currentClauseScope = {
        id: nextScopeId(),
        kind: 'block',
        name: 'where',
        parentId: syncScope.id,
      };
      scopes.push(currentClauseScope);
    }

    // Match then clause: then ConceptName.action(...)
    const thenMatch = line.match(/^\s+then\b/);
    if (thenMatch) {
      // then scope is a child of the sync scope so when-bindings are visible
      currentClauseScope = {
        id: nextScopeId(),
        kind: 'block',
        name: 'then',
        parentId: syncScope.id,
      };
      scopes.push(currentClauseScope);
    }

    // Extract concept references: ConceptName.actionName(...)
    const conceptRefRegex = /\b([A-Z]\w+)\.(\w+)\s*\(/g;
    let conceptRefMatch;
    while ((conceptRefMatch = conceptRefRegex.exec(line)) !== null) {
      const conceptRef = conceptRefMatch[1];
      const actionRef = conceptRefMatch[2];
      const scopeId = currentClauseScope?.id || syncScope.id;

      references.push({
        name: conceptRef,
        scopeId,
        resolved: null,
      });
      references.push({
        name: `${conceptRef}.${actionRef}`,
        scopeId,
        resolved: null,
      });
    }

    // Extract variable bindings: paramName: varName
    // Variables bound in when clauses are added to the sync scope
    // so they are visible in where and then clauses.
    const bindingRegex = /(\w+)\s*:\s*([a-z]\w*)\b/g;
    let bindingMatch;
    while ((bindingMatch = bindingRegex.exec(line)) !== null) {
      const varName = bindingMatch[2];
      if (['string', 'int', 'bool', 'true', 'false', 'null', 'undefined',
        'when', 'where', 'then', 'sync'].includes(varName)) continue;

      // Bind variables to the sync scope level so they are accessible
      // from when, where, and then clauses
      declarations.push({
        name: varName,
        symbolString: `clef/sync/${syncName}/var/${varName}`,
        scopeId: syncScope.id,
        kind: 'variable',
      });
    }

    // Extract variant references: -> variantName(...)
    const variantMatch = line.match(/->\s+(\w+)\s*\(/);
    if (variantMatch) {
      const variantName = variantMatch[1];
      const scopeId = currentClauseScope?.id || syncScope.id;
      references.push({
        name: variantName,
        scopeId,
        resolved: null,
      });
    }
  }

  return { scopes, declarations, references };
}

/**
 * Resolve a name within the sync scope chain.
 */
function resolveInChain(
  name: string,
  scopeId: string,
  scopes: ScopeNode[],
  declarations: Declaration[],
): string | null {
  const scopeMap = new Map<string, ScopeNode>();
  for (const s of scopes) scopeMap.set(s.id, s);

  let currentScopeId: string | null = scopeId;
  while (currentScopeId) {
    const match = declarations.find(
      (d) => d.scopeId === currentScopeId && d.name === name,
    );
    if (match) return match.symbolString;

    const scope = scopeMap.get(currentScopeId);
    currentScopeId = scope?.parentId || null;
  }
  return null;
}

export const syncScopeProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();

    try {
      await storage.put('sync-scope-provider', id, {
        id,
        providerRef: 'sync-scope-provider',
        handledLanguages: 'sync-spec',
      });

      return { variant: 'ok', instance: id };
    } catch (e) {
      return { variant: 'loadError', message: String(e) };
    }
  },

  async buildScopes(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;
    const file = input.file as string;

    const result = buildSyncScopes(source, file);

    return {
      variant: 'ok',
      scopes: JSON.stringify(result.scopes),
      declarations: JSON.stringify(result.declarations),
      references: JSON.stringify(result.references),
    };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const scopeId = input.scopeId as string;
    const scopes = JSON.parse(input.scopes as string) as ScopeNode[];
    const declarations = JSON.parse(input.declarations as string) as Declaration[];

    const resolved = resolveInChain(name, scopeId, scopes, declarations);
    if (resolved) {
      return { variant: 'ok', symbolString: resolved };
    }

    return { variant: 'unresolved', name };
  },

  async getSupportedLanguages(input: Record<string, unknown>, storage: ConceptStorage) {
    return {
      variant: 'ok',
      languages: JSON.stringify(['sync-spec']),
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetSyncScopeProviderCounter(): void {
  idCounter = 0;
  scopeCounter = 0;
}
