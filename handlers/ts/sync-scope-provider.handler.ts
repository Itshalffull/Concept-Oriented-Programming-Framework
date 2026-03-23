// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// SyncScopeProvider Handler
//
// Scope resolution provider for .sync files. Models cross-concept
// references with variable scoping -- when-clause bindings are
// visible in where and then clauses.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, complete, completeFrom,
  type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

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
 */
function buildSyncScopes(source: string, file: string): {
  scopes: ScopeNode[];
  declarations: Declaration[];
  references: Array<{ name: string; scopeId: string; resolved: string | null }>;
} {
  const scopes: ScopeNode[] = [];
  const declarations: Declaration[] = [];
  const references: Array<{ name: string; scopeId: string; resolved: string | null }> = [];

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

    const whereMatch = line.match(/^\s+where\b/);
    if (whereMatch) {
      currentClauseScope = {
        id: nextScopeId(),
        kind: 'block',
        name: 'where',
        parentId: syncScope.id,
      };
      scopes.push(currentClauseScope);
    }

    const thenMatch = line.match(/^\s+then\b/);
    if (thenMatch) {
      currentClauseScope = {
        id: nextScopeId(),
        kind: 'block',
        name: 'then',
        parentId: syncScope.id,
      };
      scopes.push(currentClauseScope);
    }

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

    const bindingRegex = /(\w+)\s*:\s*([a-z]\w*)\b/g;
    let bindingMatch;
    while ((bindingMatch = bindingRegex.exec(line)) !== null) {
      const varName = bindingMatch[2];
      if (['string', 'int', 'bool', 'true', 'false', 'null', 'undefined',
        'when', 'where', 'then', 'sync'].includes(varName)) continue;

      declarations.push({
        name: varName,
        symbolString: `clef/sync/${syncName}/var/${varName}`,
        scopeId: syncScope.id,
        kind: 'variable',
      });
    }

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

const _handler: FunctionalConceptHandler = {
  initialize(_input: Record<string, unknown>) {
    const id = nextId();

    let p = createProgram();
    p = put(p, 'sync-scope-provider', id, {
      id,
      providerRef: 'sync-scope-provider',
      handledLanguages: 'sync-spec',
    });

    return complete(p, 'ok', { instance: id }) as StorageProgram<Result>;
  },

  buildScopes(input: Record<string, unknown>) {
    const source = input.source as string;
    const file = input.file as string;

    const result = buildSyncScopes(source, file);

    const p = createProgram();
    return complete(p, 'ok', {
      scopes: JSON.stringify(result.scopes),
      declarations: JSON.stringify(result.declarations),
      references: JSON.stringify(result.references),
    }) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const name = input.name as string;
    const scopeId = input.scopeId as string;
    const scopes = JSON.parse(input.scopes as string) as ScopeNode[];
    const declarations = JSON.parse(input.declarations as string) as Declaration[];

    const resolved = resolveInChain(name, scopeId, scopes, declarations);
    const p = createProgram();
    if (resolved) {
      return complete(p, 'ok', { symbolString: resolved }) as StorageProgram<Result>;
    }
    return complete(p, 'unresolved', { name }) as StorageProgram<Result>;
  },

  getSupportedLanguages(_input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      languages: JSON.stringify(['sync-spec']),
    }) as StorageProgram<Result>;
  },
};

export const syncScopeProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetSyncScopeProviderCounter(): void {
  idCounter = 0;
  scopeCounter = 0;
}
