// ============================================================
// WidgetScopeProvider Handler
//
// Scope resolution provider for .widget spec files. Models
// widget-level scopes containing anatomy parts, states,
// transitions, props, slots, and composed widget references.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../runtime/types.js';

let idCounter = 0;
function nextId(): string {
  return `widget-scope-provider-${++idCounter}`;
}

let scopeCounter = 0;
function nextScopeId(): string {
  return `wsp-scope-${++scopeCounter}`;
}

/**
 * Scope node for widget spec files.
 */
interface ScopeNode {
  id: string;
  kind: string;
  name: string;
  parentId: string | null;
}

/**
 * Declaration within a widget scope.
 */
interface Declaration {
  name: string;
  symbolString: string;
  scopeId: string;
  kind: string;
}

/**
 * Build scope graph from widget spec source text.
 * Scope hierarchy: file (global) -> widget -> section (anatomy/states/props/etc.)
 * Each widget is a self-contained scope. Sections within the widget
 * create child scopes for organization, but all declarations are
 * visible from the widget scope level.
 */
function buildWidgetScopes(source: string, file: string): {
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
  let widgetScope: ScopeNode | null = null;
  let sectionScope: ScopeNode | null = null;
  let widgetName = '';
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Match widget declaration: widget WidgetName { or name: WidgetName
    const widgetMatch = line.match(/^\s*(?:widget\s+(\w[\w-]*)|name\s*:\s*['"]?([\w-]+)['"]?)\s*/);
    if (widgetMatch) {
      widgetName = widgetMatch[1] || widgetMatch[2];
      if (widgetName) {
        widgetScope = {
          id: nextScopeId(),
          kind: 'module',
          name: widgetName,
          parentId: globalScope.id,
        };
        scopes.push(widgetScope);

        declarations.push({
          name: widgetName,
          symbolString: `surface/widget/${widgetName}`,
          scopeId: globalScope.id,
          kind: 'concept',
        });
      }
      continue;
    }

    if (!widgetScope) continue;

    // Track sections
    const sectionMatch = line.match(/^\s*(anatomy|states?|transitions?|props?|slots?|compose|affordances?|interactors?)\s*[:{]/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      sectionScope = {
        id: nextScopeId(),
        kind: 'block',
        name: currentSection,
        parentId: widgetScope.id,
      };
      scopes.push(sectionScope);
      continue;
    }

    // Match declarations within sections
    const declMatch = line.match(/^\s+([\w-]+)\s*[:({]/);
    if (declMatch && widgetName && currentSection) {
      const itemName = declMatch[1];
      if (['true', 'false', 'null', 'description', 'type', 'value', 'default',
        'required', 'optional'].includes(itemName)) continue;

      const scopeId = sectionScope?.id || widgetScope.id;
      const prefix = `surface/widget/${widgetName}`;

      if (currentSection === 'anatomy') {
        declarations.push({
          name: itemName,
          symbolString: `${prefix}/part/${itemName}`,
          scopeId,
          kind: 'state-field',
        });
      } else if (currentSection === 'states' || currentSection === 'state') {
        declarations.push({
          name: itemName,
          symbolString: `${prefix}/state/${itemName}`,
          scopeId,
          kind: 'state-field',
        });
      } else if (currentSection === 'transitions' || currentSection === 'transition') {
        declarations.push({
          name: itemName,
          symbolString: `${prefix}/transition/${itemName}`,
          scopeId,
          kind: 'action',
        });
      } else if (currentSection === 'props' || currentSection === 'prop') {
        declarations.push({
          name: itemName,
          symbolString: `${prefix}/prop/${itemName}`,
          scopeId,
          kind: 'state-field',
        });
      } else if (currentSection === 'slots' || currentSection === 'slot') {
        declarations.push({
          name: itemName,
          symbolString: `${prefix}/slot/${itemName}`,
          scopeId,
          kind: 'state-field',
        });
      } else if (currentSection === 'compose') {
        // Composed widget references are external references, not declarations
        references.push({
          name: itemName,
          scopeId,
          resolved: null,
        });
      } else if (currentSection === 'affordances' || currentSection === 'affordance' ||
                 currentSection === 'interactors' || currentSection === 'interactor') {
        declarations.push({
          name: itemName,
          symbolString: `${prefix}/affordance/${itemName}`,
          scopeId,
          kind: 'action',
        });
      }
    }

    // Match extends references
    const extendsMatch = line.match(/extends\s+([\w-]+)/);
    if (extendsMatch) {
      references.push({
        name: extendsMatch[1],
        scopeId: widgetScope.id,
        resolved: null,
      });
    }

    // Match transition event references: on eventName -> stateName
    const eventMatch = line.match(/on\s+([\w-]+)\s*->\s*([\w-]+)/);
    if (eventMatch && widgetScope) {
      references.push({
        name: eventMatch[1],
        scopeId: sectionScope?.id || widgetScope.id,
        resolved: null,
      });
      references.push({
        name: eventMatch[2],
        scopeId: sectionScope?.id || widgetScope.id,
        resolved: null,
      });
    }
  }

  return { scopes, declarations, references };
}

/**
 * Resolve a name within the widget scope chain.
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

export const widgetScopeProviderHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();

    try {
      await storage.put('widget-scope-provider', id, {
        id,
        providerRef: 'widget-scope-provider',
        handledLanguages: 'widget-spec',
      });

      return { variant: 'ok', instance: id };
    } catch (e) {
      return { variant: 'loadError', message: String(e) };
    }
  },

  async buildScopes(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;
    const file = input.file as string;

    const result = buildWidgetScopes(source, file);

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
      languages: JSON.stringify(['widget-spec']),
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetWidgetScopeProviderCounter(): void {
  idCounter = 0;
  scopeCounter = 0;
}
