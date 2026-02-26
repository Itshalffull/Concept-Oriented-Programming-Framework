// ============================================================
// ReactComponentSymbolExtractor Handler
//
// Symbol extraction provider for React component files (.tsx).
// Extracts component names, prop type definitions, hook usages,
// and exported component symbols. Builds on the TypeScript
// extractor with React-specific awareness.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `react-component-symbol-extractor-${++idCounter}`;
}

/**
 * Extract React-specific symbols from TSX source text using regex patterns.
 */
function extractFromReactComponent(source: string, file: string): Array<{
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Match function component declarations: export function ComponentName or function ComponentName
    const funcCompMatch = line.match(/(?:export\s+(?:default\s+)?)?function\s+([A-Z]\w*)\s*\(/);
    if (funcCompMatch) {
      const compName = funcCompMatch[1];
      const isExported = /export\s+/.test(line);
      symbols.push({
        symbolString: `react/component/${file}/${compName}`,
        kind: 'function',
        displayName: compName,
        role: 'definition',
        line: lineNum,
        col: line.indexOf(compName) + 1,
      });
      if (isExported) {
        symbols.push({
          symbolString: `react/component/${file}/${compName}`,
          kind: 'function',
          displayName: compName,
          role: 'export',
          line: lineNum,
          col: line.indexOf(compName) + 1,
        });
      }
    }

    // Match arrow function component: export const ComponentName = or const ComponentName: React.FC
    const arrowCompMatch = line.match(/(?:export\s+)?const\s+([A-Z]\w*)\s*(?::\s*React\.(?:FC|FunctionComponent|Component))?.*?=/);
    if (arrowCompMatch) {
      const compName = arrowCompMatch[1];
      const isExported = /export\s+/.test(line);
      symbols.push({
        symbolString: `react/component/${file}/${compName}`,
        kind: 'function',
        displayName: compName,
        role: 'definition',
        line: lineNum,
        col: line.indexOf(compName) + 1,
      });
      if (isExported) {
        symbols.push({
          symbolString: `react/component/${file}/${compName}`,
          kind: 'function',
          displayName: compName,
          role: 'export',
          line: lineNum,
          col: line.indexOf(compName) + 1,
        });
      }
    }

    // Match class component: class ComponentName extends React.Component
    const classCompMatch = line.match(/(?:export\s+(?:default\s+)?)?class\s+([A-Z]\w*)\s+extends\s+(?:React\.)?(?:Component|PureComponent)/);
    if (classCompMatch) {
      const compName = classCompMatch[1];
      const isExported = /export\s+/.test(line);
      symbols.push({
        symbolString: `react/component/${file}/${compName}`,
        kind: 'class',
        displayName: compName,
        role: 'definition',
        line: lineNum,
        col: line.indexOf(compName) + 1,
      });
      if (isExported) {
        symbols.push({
          symbolString: `react/component/${file}/${compName}`,
          kind: 'class',
          displayName: compName,
          role: 'export',
          line: lineNum,
          col: line.indexOf(compName) + 1,
        });
      }
    }

    // Match prop type interfaces/types: interface ComponentNameProps or type ComponentNameProps
    const propsMatch = line.match(/(?:export\s+)?(?:interface|type)\s+(\w+Props)\s*[={<]/);
    if (propsMatch) {
      const propsName = propsMatch[1];
      symbols.push({
        symbolString: `react/props/${file}/${propsName}`,
        kind: 'type',
        displayName: propsName,
        role: 'definition',
        line: lineNum,
        col: line.indexOf(propsName) + 1,
      });
    }

    // Match hook usages: useState, useEffect, useRef, useMemo, useCallback, useContext, useReducer, custom hooks
    const hookRegex = /\b(use[A-Z]\w*)\s*(?:<[^>]*>)?\s*\(/g;
    let hookMatch;
    while ((hookMatch = hookRegex.exec(line)) !== null) {
      const hookName = hookMatch[1];
      symbols.push({
        symbolString: `react/hook/${hookName}`,
        kind: 'function',
        displayName: hookName,
        role: 'reference',
        line: lineNum,
        col: hookMatch.index + 1,
      });
    }

    // Match custom hook definitions: export function useCustomHook or function useCustomHook
    const customHookMatch = line.match(/(?:export\s+)?function\s+(use[A-Z]\w*)\s*\(/);
    if (customHookMatch) {
      const hookName = customHookMatch[1];
      symbols.push({
        symbolString: `react/hook/${file}/${hookName}`,
        kind: 'function',
        displayName: hookName,
        role: 'definition',
        line: lineNum,
        col: line.indexOf(hookName) + 1,
      });
    }

    // Match import statements
    const importMatch = line.match(/import\s+(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/);
    if (importMatch) {
      const namedImports = importMatch[1];
      const defaultImport = importMatch[2];
      const fromModule = importMatch[3];

      if (defaultImport) {
        symbols.push({
          symbolString: `ts/import/${fromModule}/${defaultImport}`,
          kind: 'variable',
          displayName: defaultImport,
          role: 'import',
          line: lineNum,
          col: line.indexOf(defaultImport) + 1,
        });
      }
      if (namedImports) {
        const names = namedImports.split(',').map((n) => n.trim().split(/\s+as\s+/)[0].trim());
        for (const name of names) {
          if (name) {
            symbols.push({
              symbolString: `ts/import/${fromModule}/${name}`,
              kind: 'variable',
              displayName: name,
              role: 'import',
              line: lineNum,
              col: line.indexOf(name) + 1,
            });
          }
        }
      }
    }
  }

  return symbols;
}

export const reactComponentSymbolExtractorHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();

    try {
      await storage.put('react-component-symbol-extractor', id, {
        id,
        extractorRef: 'react-component-symbol-extractor',
        handledExtensions: '.tsx',
        language: 'react-tsx',
      });

      return { variant: 'ok', instance: id };
    } catch (e) {
      return { variant: 'loadError', message: String(e) };
    }
  },

  async extract(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;
    const file = input.file as string;

    const symbols = extractFromReactComponent(source, file);

    return {
      variant: 'ok',
      symbols: JSON.stringify(symbols),
    };
  },

  async getSupportedExtensions(input: Record<string, unknown>, storage: ConceptStorage) {
    return {
      variant: 'ok',
      extensions: JSON.stringify(['.tsx']),
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetReactComponentSymbolExtractorCounter(): void {
  idCounter = 0;
}
