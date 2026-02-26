// ============================================================
// ConceptScopeProvider Handler
//
// Scope resolution provider for .concept files. Each concept
// declaration is an isolated scope containing state fields,
// actions, and variants as declarations. Type parameters are
// scoped to the concept.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `concept-scope-provider-${++idCounter}`;
}

let scopeCounter = 0;
function nextScopeId(): string {
  return `csp-scope-${++scopeCounter}`;
}

/**
 * Scope node for concept files.
 */
interface ScopeNode {
  id: string;
  kind: string;
  name: string;
  parentId: string | null;
}

/**
 * Declaration within a concept scope.
 */
interface Declaration {
  name: string;
  symbolString: string;
  scopeId: string;
  kind: string;
}

/**
 * Build scope graph nodes from concept spec source text.
 * Scope hierarchy: file (global) -> concept -> action -> variant
 * Type parameters are declared in the concept scope.
 * State fields, actions are declared in the concept scope.
 * Variants and their params are declared in the action scope.
 */
function buildConceptScopes(source: string, file: string): {
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
  let conceptScope: ScopeNode | null = null;
  let actionScope: ScopeNode | null = null;
  let conceptName = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match concept declaration: concept ConceptName [T] {
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

      // Declare the concept itself in the global scope
      declarations.push({
        name: conceptName,
        symbolString: `copf/concept/${conceptName}`,
        scopeId: globalScope.id,
        kind: 'concept',
      });

      // Declare the type parameter in the concept scope
      if (typeParam) {
        declarations.push({
          name: typeParam,
          symbolString: `copf/concept/${conceptName}/type/${typeParam}`,
          scopeId: conceptScope.id,
          kind: 'type',
        });
      }
      continue;
    }

    // Match state field declarations
    if (conceptScope) {
      const stateMatch = line.match(/^\s+(\w+)\s*:\s*(?:set\s+)?(\w+)(?:\s*->\s*(\w+))?\s*$/);
      if (stateMatch) {
        const fieldName = stateMatch[1];
        if (!['purpose', 'state', 'actions', 'capabilities', 'invariant'].includes(fieldName)) {
          declarations.push({
            name: fieldName,
            symbolString: `copf/concept/${conceptName}/state/${fieldName}`,
            scopeId: conceptScope.id,
            kind: 'state-field',
          });

          // Type references in state fields
          const typeRef = stateMatch[2];
          if (typeRef && typeRef !== 'set') {
            references.push({
              name: typeRef,
              scopeId: conceptScope.id,
              resolved: null,
            });
          }
          if (stateMatch[3]) {
            references.push({
              name: stateMatch[3],
              scopeId: conceptScope.id,
              resolved: null,
            });
          }
        }
      }

      // Match action declarations
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
          symbolString: `copf/concept/${conceptName}/action/${actionName}`,
          scopeId: conceptScope.id,
          kind: 'action',
        });

        // Extract action parameters as declarations in the action scope
        const paramSection = line.match(/\(([^)]*)\)/);
        if (paramSection) {
          const params = paramSection[1].split(',').map((p) => p.trim()).filter(Boolean);
          for (const param of params) {
            const paramParts = param.match(/(\w+)\s*:\s*(\w+)/);
            if (paramParts) {
              declarations.push({
                name: paramParts[1],
                symbolString: `copf/concept/${conceptName}/action/${actionName}/param/${paramParts[1]}`,
                scopeId: actionScope.id,
                kind: 'variable',
              });
            }
          }
        }
      }

      // Match variant declarations within an action
      const variantMatch = line.match(/^\s+->\s+(\w+)\s*\(/);
      if (variantMatch && actionScope) {
        const variantName = variantMatch[1];
        declarations.push({
          name: variantName,
          symbolString: `copf/concept/${conceptName}/variant/${variantName}`,
          scopeId: actionScope.id,
          kind: 'variant',
        });
      }
    }
  }

  return { scopes, declarations, references };
}

/**
 * Resolve a name within the concept scope chain.
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

export const conceptScopeProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();

    try {
      await storage.put('concept-scope-provider', id, {
        id,
        providerRef: 'concept-scope-provider',
        handledLanguages: 'concept-spec',
      });

      return { variant: 'ok', instance: id };
    } catch (e) {
      return { variant: 'loadError', message: String(e) };
    }
  },

  async buildScopes(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;
    const file = input.file as string;

    const result = buildConceptScopes(source, file);

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
      languages: JSON.stringify(['concept-spec']),
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetConceptScopeProviderCounter(): void {
  idCounter = 0;
  scopeCounter = 0;
}
