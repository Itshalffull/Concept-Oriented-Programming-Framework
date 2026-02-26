// ============================================================
// TypeScriptSymbolExtractor Handler Tests
//
// Tests for extracting symbols from TypeScript files: functions,
// classes, interfaces, type aliases, enums, variables, imports,
// re-exports, and export defaults.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  typeScriptSymbolExtractorHandler,
  resetTypeScriptSymbolExtractorCounter,
} from '../handlers/ts/type-script-symbol-extractor.handler.js';

describe('TypeScriptSymbolExtractor', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetTypeScriptSymbolExtractorCounter();
  });

  // ── initialize ────────────────────────────────────────────

  describe('initialize', () => {
    it('initializes and returns ok with an instance id', async () => {
      const result = await typeScriptSymbolExtractorHandler.initialize({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('type-script-symbol-extractor-1');
    });
  });

  // ── extract ───────────────────────────────────────────────

  describe('extract', () => {
    it('extracts function declarations', async () => {
      const source = `function greet(name: string): string {
  return 'Hello ' + name;
}`;
      const result = await typeScriptSymbolExtractorHandler.extract({
        source, file: 'greet.ts',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const func = symbols.find((s: Record<string, string>) =>
        s.kind === 'function' && s.displayName === 'greet'
      );
      expect(func).toBeDefined();
      expect(func.symbolString).toBe('ts/function/greet.ts/greet');
      expect(func.role).toBe('definition');
    });

    it('extracts exported function with both definition and export roles', async () => {
      const source = `export function handler() {}`;
      const result = await typeScriptSymbolExtractorHandler.extract({
        source, file: 'handler.ts',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const funcSymbols = symbols.filter((s: Record<string, string>) =>
        s.displayName === 'handler' && s.kind === 'function'
      );
      expect(funcSymbols).toHaveLength(2);
      expect(funcSymbols.map((s: Record<string, string>) => s.role)).toContain('definition');
      expect(funcSymbols.map((s: Record<string, string>) => s.role)).toContain('export');
    });

    it('extracts async function declarations', async () => {
      const source = `export async function fetchData(url: string) {}`;
      const result = await typeScriptSymbolExtractorHandler.extract({
        source, file: 'api.ts',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const func = symbols.find((s: Record<string, string>) =>
        s.displayName === 'fetchData' && s.role === 'definition'
      );
      expect(func).toBeDefined();
    });

    it('extracts class declarations', async () => {
      const source = `export class UserService {
  constructor() {}
}`;
      const result = await typeScriptSymbolExtractorHandler.extract({
        source, file: 'user-service.ts',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const classDef = symbols.find((s: Record<string, string>) =>
        s.kind === 'class' && s.displayName === 'UserService' && s.role === 'definition'
      );
      expect(classDef).toBeDefined();
      expect(classDef.symbolString).toBe('ts/class/user-service.ts/UserService');
    });

    it('extracts abstract class declarations', async () => {
      const source = `abstract class BaseModel {}`;
      const result = await typeScriptSymbolExtractorHandler.extract({
        source, file: 'base.ts',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      expect(symbols.some((s: Record<string, string>) =>
        s.displayName === 'BaseModel' && s.kind === 'class'
      )).toBe(true);
    });

    it('extracts interface declarations', async () => {
      const source = `export interface Config {
  port: number;
  host: string;
}`;
      const result = await typeScriptSymbolExtractorHandler.extract({
        source, file: 'config.ts',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const iface = symbols.find((s: Record<string, string>) =>
        s.displayName === 'Config' && s.role === 'definition'
      );
      expect(iface).toBeDefined();
      expect(iface.symbolString).toBe('ts/interface/config.ts/Config');
      expect(iface.kind).toBe('type');
    });

    it('extracts type alias declarations', async () => {
      const source = `export type Result<T> = { ok: true; value: T } | { ok: false; error: string };`;
      const result = await typeScriptSymbolExtractorHandler.extract({
        source, file: 'types.ts',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const typeAlias = symbols.find((s: Record<string, string>) =>
        s.displayName === 'Result' && s.symbolString.startsWith('ts/type/')
      );
      expect(typeAlias).toBeDefined();
    });

    it('extracts enum declarations', async () => {
      const source = `export enum Status {
  Active,
  Inactive,
  Pending,
}`;
      const result = await typeScriptSymbolExtractorHandler.extract({
        source, file: 'status.ts',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const enumDef = symbols.find((s: Record<string, string>) =>
        s.displayName === 'Status' && s.symbolString.startsWith('ts/enum/')
      );
      expect(enumDef).toBeDefined();
      expect(enumDef.kind).toBe('type');
    });

    it('extracts const enum declarations', async () => {
      const source = `const enum Direction { Up, Down, Left, Right }`;
      const result = await typeScriptSymbolExtractorHandler.extract({
        source, file: 'dir.ts',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      expect(symbols.some((s: Record<string, string>) =>
        s.displayName === 'Direction' && s.symbolString.includes('ts/enum/')
      )).toBe(true);
    });

    it('extracts const/let/var declarations', async () => {
      const source = `export const API_URL = 'https://api.example.com';
const timeout = 5000;`;
      const result = await typeScriptSymbolExtractorHandler.extract({
        source, file: 'config.ts',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const vars = symbols.filter((s: Record<string, string>) =>
        s.kind === 'variable' && s.symbolString.startsWith('ts/variable/')
      );
      expect(vars.some((v: Record<string, string>) => v.displayName === 'API_URL')).toBe(true);
      expect(vars.some((v: Record<string, string>) => v.displayName === 'timeout')).toBe(true);
    });

    it('extracts import statements with named imports', async () => {
      const source = `import { readFile, writeFile } from 'fs/promises';`;
      const result = await typeScriptSymbolExtractorHandler.extract({
        source, file: 'io.ts',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const imports = symbols.filter((s: Record<string, string>) => s.role === 'import');
      expect(imports).toHaveLength(2);
      expect(imports[0].symbolString).toBe('ts/import/fs/promises/readFile');
      expect(imports[1].symbolString).toBe('ts/import/fs/promises/writeFile');
    });

    it('extracts default import', async () => {
      const source = `import express from 'express';`;
      const result = await typeScriptSymbolExtractorHandler.extract({
        source, file: 'app.ts',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const imp = symbols.find((s: Record<string, string>) =>
        s.role === 'import' && s.displayName === 'express'
      );
      expect(imp).toBeDefined();
    });

    it('extracts type imports', async () => {
      const source = `import type { ConceptHandler } from './types.js';`;
      const result = await typeScriptSymbolExtractorHandler.extract({
        source, file: 'impl.ts',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const imp = symbols.find((s: Record<string, string>) =>
        s.role === 'import' && s.displayName === 'ConceptHandler'
      );
      expect(imp).toBeDefined();
    });

    it('extracts re-exports', async () => {
      const source = `export { symbolHandler, resetSymbolCounter } from './symbol.handler.js';`;
      const result = await typeScriptSymbolExtractorHandler.extract({
        source, file: 'index.ts',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const reexports = symbols.filter((s: Record<string, string>) =>
        s.symbolString.startsWith('ts/reexport/')
      );
      expect(reexports).toHaveLength(2);
      expect(reexports[0].role).toBe('export');
    });

    it('extracts export default statement', async () => {
      const source = `export default handler;`;
      const result = await typeScriptSymbolExtractorHandler.extract({
        source, file: 'handler.ts',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const exportDefault = symbols.find((s: Record<string, string>) =>
        s.symbolString.includes('ts/export-default/')
      );
      expect(exportDefault).toBeDefined();
      expect(exportDefault.displayName).toBe('handler');
    });

    it('handles aliased imports', async () => {
      const source = `import { readFile as read } from 'fs';`;
      const result = await typeScriptSymbolExtractorHandler.extract({
        source, file: 'io.ts',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const imp = symbols.find((s: Record<string, string>) => s.role === 'import');
      // The TS extractor uses the last part after 'as' as the local name
      expect(imp.displayName).toBe('read');
    });

    it('returns empty symbols for empty source', async () => {
      const result = await typeScriptSymbolExtractorHandler.extract({
        source: '', file: 'empty.ts',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      expect(symbols).toHaveLength(0);
    });
  });

  // ── getSupportedExtensions ────────────────────────────────

  describe('getSupportedExtensions', () => {
    it('returns .ts and .tsx extensions', async () => {
      const result = await typeScriptSymbolExtractorHandler.getSupportedExtensions({}, storage);
      expect(result.variant).toBe('ok');
      const extensions = JSON.parse(result.extensions as string);
      expect(extensions).toContain('.ts');
      expect(extensions).toContain('.tsx');
    });
  });
});
