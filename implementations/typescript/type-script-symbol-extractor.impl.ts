// ============================================================
// TypeScriptSymbolExtractor Handler
//
// Symbol extraction provider for TypeScript and TSX files.
// Extracts functions, classes, types, interfaces, variables,
// and module exports as symbols using regex-based pattern matching.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `type-script-symbol-extractor-${++idCounter}`;
}

/**
 * Extract symbols from TypeScript source text using regex patterns.
 */
function extractFromTypeScript(source: string, file: string): Array<{
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

    // Match function declarations: export function name or function name or async function name
    const funcMatch = line.match(/(?:export\s+(?:default\s+)?)?(?:async\s+)?function\s+(\w+)\s*(?:<[^>]*>)?\s*\(/);
    if (funcMatch) {
      const funcName = funcMatch[1];
      const isExported = /export\s+/.test(line);
      symbols.push({
        symbolString: `ts/function/${file}/${funcName}`,
        kind: 'function',
        displayName: funcName,
        role: 'definition',
        line: lineNum,
        col: line.indexOf(funcName) + 1,
      });
      if (isExported) {
        symbols.push({
          symbolString: `ts/function/${file}/${funcName}`,
          kind: 'function',
          displayName: funcName,
          role: 'export',
          line: lineNum,
          col: line.indexOf(funcName) + 1,
        });
      }
    }

    // Match class declarations: export class ClassName or class ClassName
    const classMatch = line.match(/(?:export\s+(?:default\s+)?)?(?:abstract\s+)?class\s+(\w+)/);
    if (classMatch) {
      const className = classMatch[1];
      const isExported = /export\s+/.test(line);
      symbols.push({
        symbolString: `ts/class/${file}/${className}`,
        kind: 'class',
        displayName: className,
        role: 'definition',
        line: lineNum,
        col: line.indexOf(className) + 1,
      });
      if (isExported) {
        symbols.push({
          symbolString: `ts/class/${file}/${className}`,
          kind: 'class',
          displayName: className,
          role: 'export',
          line: lineNum,
          col: line.indexOf(className) + 1,
        });
      }
    }

    // Match interface declarations: export interface InterfaceName
    const ifaceMatch = line.match(/(?:export\s+)?interface\s+(\w+)/);
    if (ifaceMatch) {
      const ifaceName = ifaceMatch[1];
      const isExported = /export\s+/.test(line);
      symbols.push({
        symbolString: `ts/interface/${file}/${ifaceName}`,
        kind: 'type',
        displayName: ifaceName,
        role: 'definition',
        line: lineNum,
        col: line.indexOf(ifaceName) + 1,
      });
      if (isExported) {
        symbols.push({
          symbolString: `ts/interface/${file}/${ifaceName}`,
          kind: 'type',
          displayName: ifaceName,
          role: 'export',
          line: lineNum,
          col: line.indexOf(ifaceName) + 1,
        });
      }
    }

    // Match type alias declarations: export type TypeName = ...
    const typeMatch = line.match(/(?:export\s+)?type\s+(\w+)\s*(?:<[^>]*>)?\s*=/);
    if (typeMatch) {
      const typeName = typeMatch[1];
      const isExported = /export\s+/.test(line);
      symbols.push({
        symbolString: `ts/type/${file}/${typeName}`,
        kind: 'type',
        displayName: typeName,
        role: 'definition',
        line: lineNum,
        col: line.indexOf(typeName) + 1,
      });
      if (isExported) {
        symbols.push({
          symbolString: `ts/type/${file}/${typeName}`,
          kind: 'type',
          displayName: typeName,
          role: 'export',
          line: lineNum,
          col: line.indexOf(typeName) + 1,
        });
      }
    }

    // Match enum declarations: export enum EnumName
    const enumMatch = line.match(/(?:export\s+)?(?:const\s+)?enum\s+(\w+)/);
    if (enumMatch) {
      const enumName = enumMatch[1];
      const isExported = /export\s+/.test(line);
      symbols.push({
        symbolString: `ts/enum/${file}/${enumName}`,
        kind: 'type',
        displayName: enumName,
        role: 'definition',
        line: lineNum,
        col: line.indexOf(enumName) + 1,
      });
      if (isExported) {
        symbols.push({
          symbolString: `ts/enum/${file}/${enumName}`,
          kind: 'type',
          displayName: enumName,
          role: 'export',
          line: lineNum,
          col: line.indexOf(enumName) + 1,
        });
      }
    }

    // Match const/let/var declarations: export const varName = ...
    const varMatch = line.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*(?::\s*[^=]+)?\s*=/);
    if (varMatch) {
      const varName = varMatch[1];
      // Skip if already matched as function/class (arrow functions assigned to const)
      const isExported = /export\s+/.test(line);
      symbols.push({
        symbolString: `ts/variable/${file}/${varName}`,
        kind: 'variable',
        displayName: varName,
        role: 'definition',
        line: lineNum,
        col: line.indexOf(varName) + 1,
      });
      if (isExported) {
        symbols.push({
          symbolString: `ts/variable/${file}/${varName}`,
          kind: 'variable',
          displayName: varName,
          role: 'export',
          line: lineNum,
          col: line.indexOf(varName) + 1,
        });
      }
    }

    // Match import statements: import { Name } from 'module' or import Name from 'module'
    const importMatch = line.match(/import\s+(?:type\s+)?(?:\{([^}]+)\}|(\w+))\s+from\s+['"]([^'"]+)['"]/);
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
        const names = namedImports.split(',').map((n) => {
          const parts = n.trim().split(/\s+as\s+/);
          return parts[parts.length - 1].trim();
        });
        for (const name of names) {
          if (name && name !== 'type') {
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

    // Match re-exports: export { Name } from 'module'
    const reexportMatch = line.match(/export\s+\{([^}]+)\}\s+from\s+['"]([^'"]+)['"]/);
    if (reexportMatch) {
      const names = reexportMatch[1].split(',').map((n) => n.trim().split(/\s+as\s+/)[0].trim());
      const fromModule = reexportMatch[2];
      for (const name of names) {
        if (name) {
          symbols.push({
            symbolString: `ts/reexport/${fromModule}/${name}`,
            kind: 'variable',
            displayName: name,
            role: 'export',
            line: lineNum,
            col: line.indexOf(name) + 1,
          });
        }
      }
    }

    // Match export default
    const exportDefaultMatch = line.match(/export\s+default\s+(\w+)\s*;/);
    if (exportDefaultMatch) {
      const name = exportDefaultMatch[1];
      symbols.push({
        symbolString: `ts/export-default/${file}/${name}`,
        kind: 'variable',
        displayName: name,
        role: 'export',
        line: lineNum,
        col: line.indexOf(name) + 1,
      });
    }
  }

  return symbols;
}

export const typeScriptSymbolExtractorHandler: ConceptHandler = {
  async initialize(input: Record<string, unknown>, storage: ConceptStorage) {
    const id = nextId();

    try {
      await storage.put('type-script-symbol-extractor', id, {
        id,
        extractorRef: 'type-script-symbol-extractor',
        handledExtensions: '.ts,.tsx',
        language: 'typescript',
      });

      return { variant: 'ok', instance: id };
    } catch (e) {
      return { variant: 'loadError', message: String(e) };
    }
  },

  async extract(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;
    const file = input.file as string;

    const symbols = extractFromTypeScript(source, file);

    return {
      variant: 'ok',
      symbols: JSON.stringify(symbols),
    };
  },

  async getSupportedExtensions(input: Record<string, unknown>, storage: ConceptStorage) {
    return {
      variant: 'ok',
      extensions: JSON.stringify(['.ts', '.tsx']),
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetTypeScriptSymbolExtractorCounter(): void {
  idCounter = 0;
}
