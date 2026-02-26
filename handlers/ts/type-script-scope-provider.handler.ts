// ============================================================
// TypeScriptScopeProvider Handler
//
// Scope resolution provider for TypeScript and JavaScript files.
// Models module scopes, hoisting, closures, and ES module
// import/export edges.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `type-script-scope-provider-${++idCounter}`;
}

let scopeCounter = 0;
function nextScopeId(): string {
  return `tsp-scope-${++scopeCounter}`;
}

/**
 * Scope node for TypeScript files.
 */
interface ScopeNode {
  id: string;
  kind: string;     // "global" | "module" | "function" | "block" | "class"
  name: string;
  parentId: string | null;
}

/**
 * Declaration within a TS scope.
 */
interface Declaration {
  name: string;
  symbolString: string;
  scopeId: string;
  kind: string;
  hoisted: boolean;
}

/**
 * Import edge representing an ES module import.
 */
interface ImportEdge {
  importedName: string;
  localName: string;
  fromModule: string;
  scopeId: string;
}

/**
 * Build scope graph from TypeScript source text.
 * Scope hierarchy: global -> module -> class/function -> block
 * Supports:
 * - Function-scoped hoisting for var and function declarations
 * - Block-scoped let/const
 * - Class body scopes
 * - ES module import/export edges
 */
function buildTypeScriptScopes(source: string, file: string): {
  scopes: ScopeNode[];
  declarations: Declaration[];
  references: Array<{ name: string; scopeId: string; resolved: string | null }>;
  importEdges: ImportEdge[];
} {
  const scopes: ScopeNode[] = [];
  const declarations: Declaration[] = [];
  const references: Array<{ name: string; scopeId: string; resolved: string | null }> = [];
  const importEdges: ImportEdge[] = [];

  // Module-level scope
  const moduleScope: ScopeNode = {
    id: nextScopeId(),
    kind: 'module',
    name: file,
    parentId: null,
  };
  scopes.push(moduleScope);

  const lines = source.split('\n');
  let currentScope = moduleScope;
  const scopeStack: ScopeNode[] = [moduleScope];
  let braceDepth = 0;
  const scopeAtDepth = new Map<number, ScopeNode>();
  scopeAtDepth.set(0, moduleScope);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Track brace depth for scope management
    const openBraces = (line.match(/\{/g) || []).length;
    const closeBraces = (line.match(/\}/g) || []).length;

    // Match import statements
    const importMatch = line.match(/import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      const namedImports = importMatch[1];
      const defaultImport = importMatch[2];
      const fromModule = importMatch[3];

      if (defaultImport) {
        importEdges.push({
          importedName: 'default',
          localName: defaultImport,
          fromModule,
          scopeId: moduleScope.id,
        });
        declarations.push({
          name: defaultImport,
          symbolString: `ts/import/${fromModule}/${defaultImport}`,
          scopeId: moduleScope.id,
          kind: 'variable',
          hoisted: false,
        });
      }
      if (namedImports) {
        const names = namedImports.split(',').map((n) => n.trim());
        for (const nameSpec of names) {
          const asParts = nameSpec.split(/\s+as\s+/);
          const importedName = asParts[0].trim();
          const localName = asParts.length > 1 ? asParts[1].trim() : importedName;
          if (importedName && importedName !== 'type') {
            importEdges.push({
              importedName,
              localName,
              fromModule,
              scopeId: moduleScope.id,
            });
            declarations.push({
              name: localName,
              symbolString: `ts/import/${fromModule}/${importedName}`,
              scopeId: moduleScope.id,
              kind: 'variable',
              hoisted: false,
            });
          }
        }
      }
    }

    // Match function declarations (hoisted)
    const funcMatch = line.match(/(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+(\w+)/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      // Function declarations are hoisted to the enclosing function scope
      declarations.push({
        name: funcName,
        symbolString: `ts/function/${file}/${funcName}`,
        scopeId: currentScope.id,
        kind: 'function',
        hoisted: true,
      });

      // Create a new function scope
      const funcScope: ScopeNode = {
        id: nextScopeId(),
        kind: 'function',
        name: funcName,
        parentId: currentScope.id,
      };
      scopes.push(funcScope);
      scopeAtDepth.set(braceDepth + openBraces, funcScope);
    }

    // Match class declarations
    const classMatch = line.match(/(?:export\s+(?:default\s+)?)?(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) {
      const className = classMatch[1];
      declarations.push({
        name: className,
        symbolString: `ts/class/${file}/${className}`,
        scopeId: currentScope.id,
        kind: 'class',
        hoisted: false,
      });

      const classScope: ScopeNode = {
        id: nextScopeId(),
        kind: 'class',
        name: className,
        parentId: currentScope.id,
      };
      scopes.push(classScope);
      scopeAtDepth.set(braceDepth + openBraces, classScope);
    }

    // Match interface/type declarations
    const ifaceMatch = line.match(/(?:export\s+)?interface\s+(\w+)/);
    if (ifaceMatch) {
      declarations.push({
        name: ifaceMatch[1],
        symbolString: `ts/interface/${file}/${ifaceMatch[1]}`,
        scopeId: currentScope.id,
        kind: 'type',
        hoisted: false,
      });
    }

    const typeMatch = line.match(/(?:export\s+)?type\s+(\w+)\s*(?:<[^>]*>)?\s*=/);
    if (typeMatch) {
      declarations.push({
        name: typeMatch[1],
        symbolString: `ts/type/${file}/${typeMatch[1]}`,
        scopeId: currentScope.id,
        kind: 'type',
        hoisted: false,
      });
    }

    // Match const/let declarations (block-scoped)
    const constLetMatch = line.match(/(?:export\s+)?(?:const|let)\s+(\w+)/);
    if (constLetMatch && !funcMatch && !classMatch) {
      declarations.push({
        name: constLetMatch[1],
        symbolString: `ts/variable/${file}/${constLetMatch[1]}`,
        scopeId: currentScope.id,
        kind: 'variable',
        hoisted: false,
      });
    }

    // Match var declarations (function-scoped, hoisted)
    const varMatch = line.match(/\bvar\s+(\w+)/);
    if (varMatch) {
      // var is hoisted to the nearest function scope or module scope
      let hoistTarget = currentScope;
      let checkId: string | null = currentScope.id;
      const scopeMap = new Map<string, ScopeNode>();
      for (const s of scopes) scopeMap.set(s.id, s);
      while (checkId) {
        const s = scopeMap.get(checkId);
        if (s && (s.kind === 'function' || s.kind === 'module')) {
          hoistTarget = s;
          break;
        }
        checkId = s?.parentId || null;
      }
      declarations.push({
        name: varMatch[1],
        symbolString: `ts/variable/${file}/${varMatch[1]}`,
        scopeId: hoistTarget.id,
        kind: 'variable',
        hoisted: true,
      });
    }

    // Match arrow function or block opening that creates a new block scope
    // (if/for/while/switch blocks)
    const blockMatch = line.match(/\b(if|for|while|switch)\s*\(/);
    if (blockMatch && openBraces > 0) {
      const blockScope: ScopeNode = {
        id: nextScopeId(),
        kind: 'block',
        name: blockMatch[1],
        parentId: currentScope.id,
      };
      scopes.push(blockScope);
      scopeAtDepth.set(braceDepth + openBraces, blockScope);
    }

    // Update brace depth and current scope
    braceDepth += openBraces - closeBraces;
    if (braceDepth >= 0) {
      const scopeAtCurrent = scopeAtDepth.get(braceDepth);
      if (scopeAtCurrent) {
        currentScope = scopeAtCurrent;
      }
    }

    // Clean up scope references for closed depths
    const depthKeys = Array.from(scopeAtDepth.keys());
    for (const depth of depthKeys) {
      if (depth > braceDepth) {
        scopeAtDepth.delete(depth);
      }
    }
  }

  return { scopes, declarations, references, importEdges };
}

/**
 * Resolve a name within the TypeScript scope chain, respecting hoisting.
 */
function resolveInChain(
  name: string,
  scopeId: string,
  scopes: ScopeNode[],
  declarations: Declaration[],
  importEdges: ImportEdge[],
): string | null {
  const scopeMap = new Map<string, ScopeNode>();
  for (const s of scopes) scopeMap.set(s.id, s);

  let currentScopeId: string | null = scopeId;
  while (currentScopeId) {
    // Check declarations in this scope
    const match = declarations.find(
      (d) => d.scopeId === currentScopeId && d.name === name,
    );
    if (match) return match.symbolString;

    // Check import edges in this scope
    const importMatch = importEdges.find(
      (e) => e.scopeId === currentScopeId && e.localName === name,
    );
    if (importMatch) {
      return `ts/import/${importMatch.fromModule}/${importMatch.importedName}`;
    }

    // Walk up to parent scope
    const scope = scopeMap.get(currentScopeId);
    currentScopeId = scope?.parentId || null;
  }
  return null;
}

export const typeScriptScopeProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();

    try {
      await storage.put('type-script-scope-provider', id, {
        id,
        providerRef: 'type-script-scope-provider',
        handledLanguages: 'typescript,javascript',
      });

      return { variant: 'ok', instance: id };
    } catch (e) {
      return { variant: 'loadError', message: String(e) };
    }
  },

  async buildScopes(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;
    const file = input.file as string;

    const result = buildTypeScriptScopes(source, file);

    return {
      variant: 'ok',
      scopes: JSON.stringify(result.scopes),
      declarations: JSON.stringify(result.declarations),
      references: JSON.stringify(result.references),
      importEdges: JSON.stringify(result.importEdges),
    };
  },

  async resolve(input: Record<string, unknown>, storage: ConceptStorage) {
    const name = input.name as string;
    const scopeId = input.scopeId as string;
    const scopes = JSON.parse(input.scopes as string) as ScopeNode[];
    const declarations = JSON.parse(input.declarations as string) as Declaration[];
    const importEdges = JSON.parse((input.importEdges as string) || '[]') as ImportEdge[];

    const resolved = resolveInChain(name, scopeId, scopes, declarations, importEdges);
    if (resolved) {
      return { variant: 'ok', symbolString: resolved };
    }

    return { variant: 'unresolved', name };
  },

  async getSupportedLanguages(input: Record<string, unknown>, storage: ConceptStorage) {
    return {
      variant: 'ok',
      languages: JSON.stringify(['typescript', 'javascript']),
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetTypeScriptScopeProviderCounter(): void {
  idCounter = 0;
  scopeCounter = 0;
}
