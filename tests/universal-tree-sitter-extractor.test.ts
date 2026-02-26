// ============================================================
// UniversalTreeSitterExtractor Handler Tests
//
// Tests for the fallback symbol extraction provider that uses
// universal patterns (function, class, type, enum, module,
// variable, import) across programming languages.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  universalTreeSitterExtractorHandler,
  resetUniversalTreeSitterExtractorCounter,
} from '../handlers/ts/universal-tree-sitter-extractor.handler.js';

describe('UniversalTreeSitterExtractor', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetUniversalTreeSitterExtractorCounter();
  });

  // ── initialize ────────────────────────────────────────────

  describe('initialize', () => {
    it('initializes and returns ok with an instance id', async () => {
      const result = await universalTreeSitterExtractorHandler.initialize({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('universal-tree-sitter-extractor-1');
    });
  });

  // ── extract ───────────────────────────────────────────────

  describe('extract', () => {
    it('extracts JS/TS function declarations', async () => {
      const source = `function greet(name) {
  return 'Hello ' + name;
}`;
      const result = await universalTreeSitterExtractorHandler.extract({
        source, file: 'greet.js',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const func = symbols.find((s: Record<string, string>) =>
        s.kind === 'function' && s.displayName === 'greet'
      );
      expect(func).toBeDefined();
      expect(func.symbolString).toBe('js/function/greet.js/greet');
    });

    it('extracts Python def declarations', async () => {
      const source = `def calculate_total(items):
    return sum(items)`;
      const result = await universalTreeSitterExtractorHandler.extract({
        source, file: 'utils.py',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const func = symbols.find((s: Record<string, string>) =>
        s.kind === 'function' && s.displayName === 'calculate_total'
      );
      expect(func).toBeDefined();
      expect(func.symbolString).toBe('py/function/utils.py/calculate_total');
    });

    it('extracts Rust fn declarations', async () => {
      const source = `pub fn process(data: &str) -> Result<(), Error> {
    Ok(())
}`;
      const result = await universalTreeSitterExtractorHandler.extract({
        source, file: 'main.rs',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const func = symbols.find((s: Record<string, string>) => s.displayName === 'process');
      expect(func).toBeDefined();
      expect(func.symbolString).toBe('rs/function/main.rs/process');
    });

    it('extracts Go func declarations', async () => {
      const source = `func HandleRequest(w http.ResponseWriter, r *http.Request) {
}`;
      const result = await universalTreeSitterExtractorHandler.extract({
        source, file: 'handler.go',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      expect(symbols.some((s: Record<string, string>) => s.displayName === 'HandleRequest')).toBe(true);
    });

    it('extracts class declarations', async () => {
      const source = `class UserService {
  constructor() {}
}`;
      const result = await universalTreeSitterExtractorHandler.extract({
        source, file: 'service.ts',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const cls = symbols.find((s: Record<string, string>) =>
        s.kind === 'class' && s.displayName === 'UserService'
      );
      expect(cls).toBeDefined();
    });

    it('extracts struct declarations', async () => {
      const source = `struct Point {
    x: f64,
    y: f64,
}`;
      const result = await universalTreeSitterExtractorHandler.extract({
        source, file: 'geometry.rs',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const cls = symbols.find((s: Record<string, string>) =>
        s.kind === 'class' && s.displayName === 'Point'
      );
      expect(cls).toBeDefined();
    });

    it('extracts interface/type/trait declarations', async () => {
      const source = `interface Config {
  port: number;
}
type Result = { ok: boolean };
trait Serializable {
  fn serialize(&self) -> String;
}`;
      const result = await universalTreeSitterExtractorHandler.extract({
        source, file: 'types.rs',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const types = symbols.filter((s: Record<string, string>) => s.kind === 'type');
      expect(types.length).toBeGreaterThanOrEqual(3);
    });

    it('extracts enum declarations', async () => {
      const source = `enum Color {
  Red,
  Green,
  Blue,
}`;
      const result = await universalTreeSitterExtractorHandler.extract({
        source, file: 'colors.rs',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const enumSym = symbols.find((s: Record<string, string>) =>
        s.displayName === 'Color' && s.kind === 'type'
      );
      expect(enumSym).toBeDefined();
      expect(enumSym.symbolString).toBe('rs/enum/colors.rs/Color');
    });

    it('extracts module/namespace/package declarations', async () => {
      const source = `module MyModule {
  export function init() {}
}`;
      const result = await universalTreeSitterExtractorHandler.extract({
        source, file: 'mod.ts',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const mod = symbols.find((s: Record<string, string>) =>
        s.displayName === 'MyModule' && s.kind === 'concept'
      );
      expect(mod).toBeDefined();
    });

    it('extracts variable declarations', async () => {
      const source = `const API_URL = 'https://api.example.com';
let count = 0;`;
      const result = await universalTreeSitterExtractorHandler.extract({
        source, file: 'config.js',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const vars = symbols.filter((s: Record<string, string>) => s.kind === 'variable');
      expect(vars.some((v: Record<string, string>) => v.displayName === 'API_URL')).toBe(true);
      expect(vars.some((v: Record<string, string>) => v.displayName === 'count')).toBe(true);
    });

    it('extracts import statements', async () => {
      const source = `import React from 'react';
use std::collections::HashMap;`;
      const result = await universalTreeSitterExtractorHandler.extract({
        source, file: 'mixed.rs',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const imports = symbols.filter((s: Record<string, string>) => s.role === 'import');
      expect(imports.length).toBeGreaterThanOrEqual(2);
    });

    it('uses file extension as language prefix', async () => {
      const source = `def hello(): pass`;
      const result = await universalTreeSitterExtractorHandler.extract({
        source, file: 'hello.py',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      expect(symbols[0].symbolString).toMatch(/^py\//);
    });

    it('uses unknown prefix for extensionless files', async () => {
      const source = `function test() {}`;
      const result = await universalTreeSitterExtractorHandler.extract({
        source, file: 'Makefile',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const func = symbols.find((s: Record<string, string>) => s.displayName === 'test');
      expect(func.symbolString).toMatch(/^unknown\//);
    });

    it('returns empty symbols for empty source', async () => {
      const result = await universalTreeSitterExtractorHandler.extract({
        source: '', file: 'empty.py',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      expect(symbols).toHaveLength(0);
    });
  });

  // ── getSupportedExtensions ────────────────────────────────

  describe('getSupportedExtensions', () => {
    it('returns wildcard since it is a fallback extractor', async () => {
      const result = await universalTreeSitterExtractorHandler.getSupportedExtensions({}, storage);
      expect(result.variant).toBe('ok');
      const extensions = JSON.parse(result.extensions as string);
      expect(extensions).toContain('*');
    });
  });
});
