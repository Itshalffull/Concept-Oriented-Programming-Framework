// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// ============================================================
// ConceptScopeProvider Handler
//
// Scope resolution provider for .concept files. Each concept
// declaration is an isolated scope containing state fields,
// actions, and variants as declarations. Type parameters are
// scoped to the concept.
// ============================================================

import type { FunctionalConceptHandler } from '../../runtime/functional-handler.ts';
import {
  createProgram, put, complete, type StorageProgram,
} from '../../runtime/storage-program.ts';
import { autoInterpret } from '../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let idCounter = 0;
function nextId(): string {
  return `concept-scope-provider-${++idCounter}`;
}

let scopeCounter = 0;
function nextScopeId(): string {
  return `csp-scope-${++scopeCounter}`;
}

interface ScopeNode {
  id: string;
  kind: string;
  name: string;
  parentId: string | null;
}

interface Declaration {
  name: string;
  symbolString: string;
  scopeId: string;
  kind: string;
}

function buildConceptScopes(source: string, file: string): {
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
  let conceptScope: ScopeNode | null = null;
  let actionScope: ScopeNode | null = null;
  let conceptName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    const conceptMatch = line.match(/^\s*concept\s+(\w+)\s*(?:\[(\w+)\])?\s*\{/);
    if (conceptMatch) {
      conceptName = conceptMatch[1];
      const typeParam = conceptMatch[2];

      conceptScope = {
        id: nextScopeId(),
        kind: 'module',
        name: conceptName,
        parentId: globalScope.id,
      };
      scopes.push(conceptScope);

      declarations.push({
        name: conceptName,
        symbolString: `clef/concept/${conceptName}`,
        scopeId: globalScope.id,
        kind: 'concept',
      });

      if (typeParam) {
        declarations.push({
          name: typeParam,
          symbolString: `clef/concept/${conceptName}/type/${typeParam}`,
          scopeId: conceptScope.id,
          kind: 'type',
        });
      }
      continue;
    }

    if (conceptScope) {
      const stateMatch = line.match(/^\s+(\w+)\s*:\s*(?:set\s+)?(\w+)(?:\s*->\s*(\w+))?\s*$/);
      if (stateMatch) {
        const fieldName = stateMatch[1];
        if (!['purpose', 'state', 'actions', 'capabilities', 'invariant'].includes(fieldName)) {
          declarations.push({
            name: fieldName,
            symbolString: `clef/concept/${conceptName}/state/${fieldName}`,
            scopeId: conceptScope.id,
            kind: 'state-field',
          });

          const typeRef = stateMatch[2];
          if (typeRef && typeRef !== 'set') {
            references.push({ name: typeRef, scopeId: conceptScope.id, resolved: null });
          }
          if (stateMatch[3]) {
            references.push({ name: stateMatch[3], scopeId: conceptScope.id, resolved: null });
          }
        }
      }

      const actionMatch = line.match(/^\s+action\s+(\w+)\s*\(/);
      if (actionMatch) {
        const actionName = actionMatch[1];
        actionScope = {
          id: nextScopeId(),
          kind: 'function',
          name: actionName,
          parentId: conceptScope.id,
        };
        scopes.push(actionScope);

        declarations.push({
          name: actionName,
          symbolString: `clef/concept/${conceptName}/action/${actionName}`,
          scopeId: conceptScope.id,
          kind: 'action',
        });

        const paramSection = line.match(/\(([^)]*)\)/);
        if (paramSection) {
          const params = paramSection[1].split(',').map((p) => p.trim()).filter(Boolean);
          for (const param of params) {
            const paramParts = param.match(/(\w+)\s*:\s*(\w+)/);
            if (paramParts) {
              declarations.push({
                name: paramParts[1],
                symbolString: `clef/concept/${conceptName}/action/${actionName}/param/${paramParts[1]}`,
                scopeId: actionScope.id,
                kind: 'variable',
              });
            }
          }
        }
      }

      const variantMatch = line.match(/^\s+->\s+(\w+)\s*\(/);
      if (variantMatch && actionScope) {
        const variantName = variantMatch[1];
        declarations.push({
          name: variantName,
          symbolString: `clef/concept/${conceptName}/variant/${variantName}`,
          scopeId: actionScope.id,
          kind: 'variant',
        });
      }
    }
  }

  return { scopes, declarations, references };
}

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
  initialize(input: Record<string, unknown>) {
    const id = nextId();

    let p = createProgram();
    p = put(p, 'concept-scope-provider', id, {
      id,
      providerRef: 'concept-scope-provider',
      handledLanguages: 'concept-spec',
    });

    return complete(p, 'ok', { instance: id }) as StorageProgram<Result>;
  },

  buildScopes(input: Record<string, unknown>) {
    const source = input.source as string;
    const file = input.file as string;

    const result = buildConceptScopes(source, file);

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

  getSupportedLanguages(input: Record<string, unknown>) {
    const p = createProgram();
    return complete(p, 'ok', {
      languages: JSON.stringify(['concept-spec']),
    }) as StorageProgram<Result>;
  },
};

export const conceptScopeProviderHandler = autoInterpret(_handler);

/** Reset the ID counter. Useful for testing. */
export function resetConceptScopeProviderCounter(): void {
  idCounter = 0;
  scopeCounter = 0;
}
