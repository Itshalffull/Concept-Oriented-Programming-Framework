// ============================================================
// WidgetSpecSymbolExtractor Handler
//
// Symbol extraction provider for .widget spec files. Extracts
// widget name, anatomy part names, state names, transition events,
// prop names, slot names, composed widget references, and
// affordance interactor bindings as symbols in the surface/* namespace.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `widget-spec-symbol-extractor-${++idCounter}`;
}

/**
 * Extract symbols from widget spec source text using regex patterns.
 */
function extractFromWidgetSpec(source: string, file: string): Array<{
  symbolString: string;
  kind: string;
  displayName: string;
  role: string;
  line: number;
  col: number;
}> {
  const symbols: Array<{
    symbolString: string;
    kind: string;
    displayName: string;
    role: string;
    line: number;
    col: number;
  }> = [];

  const lines = source.split('\n');
  let widgetName = '';
  let currentSection = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Match widget declaration: widget WidgetName { or name: WidgetName
    const widgetMatch = line.match(/^\s*(?:widget\s+(\w[\w-]*)|name\s*:\s*['"]?([\w-]+)['"]?)\s*/);
    if (widgetMatch) {
      widgetName = widgetMatch[1] || widgetMatch[2];
      if (widgetName) {
        symbols.push({
          symbolString: `surface/widget/${widgetName}`,
          kind: 'concept',
          displayName: widgetName,
          role: 'definition',
          line: lineNum,
          col: line.indexOf(widgetName) + 1,
        });
      }
      continue;
    }

    // Track sections: anatomy, states, transitions, props, slots, compose, affordances
    const sectionMatch = line.match(/^\s*(anatomy|states?|transitions?|props?|slots?|compose|affordances?|interactors?)\s*[:{]/);
    if (sectionMatch) {
      currentSection = sectionMatch[1];
      continue;
    }

    // Match declarations within sections
    const declMatch = line.match(/^\s+([\w-]+)\s*[:({]/);
    if (declMatch && widgetName && currentSection) {
      const itemName = declMatch[1];
      // Skip common structure keywords
      if (['true', 'false', 'null', 'description', 'type', 'value', 'default',
        'required', 'optional'].includes(itemName)) continue;

      const prefix = `surface/widget/${widgetName}`;

      if (currentSection === 'anatomy') {
        symbols.push({
          symbolString: `${prefix}/part/${itemName}`,
          kind: 'state-field',
          displayName: itemName,
          role: 'definition',
          line: lineNum,
          col: line.indexOf(itemName) + 1,
        });
      } else if (currentSection === 'states' || currentSection === 'state') {
        symbols.push({
          symbolString: `${prefix}/state/${itemName}`,
          kind: 'state-field',
          displayName: itemName,
          role: 'definition',
          line: lineNum,
          col: line.indexOf(itemName) + 1,
        });
      } else if (currentSection === 'transitions' || currentSection === 'transition') {
        symbols.push({
          symbolString: `${prefix}/transition/${itemName}`,
          kind: 'action',
          displayName: itemName,
          role: 'definition',
          line: lineNum,
          col: line.indexOf(itemName) + 1,
        });
      } else if (currentSection === 'props' || currentSection === 'prop') {
        symbols.push({
          symbolString: `${prefix}/prop/${itemName}`,
          kind: 'state-field',
          displayName: itemName,
          role: 'definition',
          line: lineNum,
          col: line.indexOf(itemName) + 1,
        });
      } else if (currentSection === 'slots' || currentSection === 'slot') {
        symbols.push({
          symbolString: `${prefix}/slot/${itemName}`,
          kind: 'state-field',
          displayName: itemName,
          role: 'definition',
          line: lineNum,
          col: line.indexOf(itemName) + 1,
        });
      } else if (currentSection === 'compose') {
        // Composed widget references
        symbols.push({
          symbolString: `surface/widget/${itemName}`,
          kind: 'concept',
          displayName: itemName,
          role: 'reference',
          line: lineNum,
          col: line.indexOf(itemName) + 1,
        });
      } else if (currentSection === 'affordances' || currentSection === 'affordance' ||
                 currentSection === 'interactors' || currentSection === 'interactor') {
        symbols.push({
          symbolString: `${prefix}/affordance/${itemName}`,
          kind: 'action',
          displayName: itemName,
          role: 'definition',
          line: lineNum,
          col: line.indexOf(itemName) + 1,
        });
      }
    }

    // Match widget references in compose or extends context
    const extendsMatch = line.match(/extends\s+([\w-]+)/);
    if (extendsMatch) {
      const refName = extendsMatch[1];
      symbols.push({
        symbolString: `surface/widget/${refName}`,
        kind: 'concept',
        displayName: refName,
        role: 'reference',
        line: lineNum,
        col: line.indexOf(refName) + 1,
      });
    }

    // Match event references in transitions: on event -> state
    const eventMatch = line.match(/on\s+([\w-]+)\s*->/);
    if (eventMatch && widgetName) {
      const eventName = eventMatch[1];
      symbols.push({
        symbolString: `surface/widget/${widgetName}/event/${eventName}`,
        kind: 'action',
        displayName: eventName,
        role: 'reference',
        line: lineNum,
        col: line.indexOf(eventName) + 1,
      });
    }
  }

  return symbols;
}

export const widgetSpecSymbolExtractorHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();

    try {
      await storage.put('widget-spec-symbol-extractor', id, {
        id,
        extractorRef: 'widget-spec-symbol-extractor',
        handledExtensions: '.widget',
        language: 'widget-spec',
      });

      return { variant: 'ok', instance: id };
    } catch (e) {
      return { variant: 'loadError', message: String(e) };
    }
  },

  async extract(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;
    const file = input.file as string;

    const symbols = extractFromWidgetSpec(source, file);

    return {
      variant: 'ok',
      symbols: JSON.stringify(symbols),
    };
  },

  async getSupportedExtensions(input: Record<string, unknown>, storage: ConceptStorage) {
    return {
      variant: 'ok',
      extensions: JSON.stringify(['.widget']),
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetWidgetSpecSymbolExtractorCounter(): void {
  idCounter = 0;
}
