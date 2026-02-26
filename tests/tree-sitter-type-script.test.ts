// ============================================================
// TreeSitterTypeScript Handler Tests
//
// Tree-sitter grammar provider for TypeScript and TSX files.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  treeSitterTypeScriptHandler,
  resetTreeSitterTypeScriptCounter,
} from '../handlers/ts/tree-sitter-type-script.handler.js';

describe('TreeSitterTypeScript', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetTreeSitterTypeScriptCounter();
  });

  describe('initialize', () => {
    it('creates a grammar instance for TypeScript language', async () => {
      const result = await treeSitterTypeScriptHandler.initialize!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBeDefined();
    });

    it('returns existing instance on repeated initialization', async () => {
      const first = await treeSitterTypeScriptHandler.initialize!({}, storage);
      const second = await treeSitterTypeScriptHandler.initialize!({}, storage);
      expect(second.instance).toBe(first.instance);
    });
  });

  describe('parse', () => {
    it('parses import declarations', async () => {
      const source = `import { useState } from 'react';
import type { FC } from 'react';`;
      const result = await treeSitterTypeScriptHandler.parse!(
        { source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const tree = JSON.parse(result.tree as string);
      const imports = tree.children.filter((c: any) => c.type === 'import_declaration');
      expect(imports.length).toBe(2);
      // Check module specifier
      const moduleSpec = imports[0].children.find((c: any) => c.type === 'module_specifier');
      expect(moduleSpec.text).toBe('react');
    });

    it('parses function declarations', async () => {
      const source = `export async function processData(input: string): Promise<void> {
  console.log(input);
}`;
      const result = await treeSitterTypeScriptHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const funcDecl = tree.children.find((c: any) => c.type === 'function_declaration');
      expect(funcDecl).toBeDefined();
      const funcName = funcDecl.children.find((c: any) => c.type === 'function_name');
      expect(funcName.text).toBe('processData');
      const exportMod = funcDecl.children.find((c: any) => c.type === 'export_modifier');
      expect(exportMod).toBeDefined();
      const asyncMod = funcDecl.children.find((c: any) => c.type === 'async_modifier');
      expect(asyncMod).toBeDefined();
    });

    it('parses class declarations with extends and implements', async () => {
      const source = `export class UserService extends BaseService implements IUserService {
}`;
      const result = await treeSitterTypeScriptHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const classDecl = tree.children.find((c: any) => c.type === 'class_declaration');
      expect(classDecl).toBeDefined();
      const className = classDecl.children.find((c: any) => c.type === 'class_name');
      expect(className.text).toBe('UserService');
      const extendsClause = classDecl.children.find((c: any) => c.type === 'extends_clause');
      expect(extendsClause.text).toBe('BaseService');
    });

    it('parses interface declarations', async () => {
      const source = `export interface Config {
  port: number;
  host: string;
}`;
      const result = await treeSitterTypeScriptHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const ifaceDecl = tree.children.find((c: any) => c.type === 'interface_declaration');
      expect(ifaceDecl).toBeDefined();
      const ifaceName = ifaceDecl.children.find((c: any) => c.type === 'interface_name');
      expect(ifaceName.text).toBe('Config');
    });

    it('parses type alias declarations', async () => {
      const source = `export type Result<T> = { ok: true; value: T } | { ok: false; error: string };`;
      const result = await treeSitterTypeScriptHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const typeAlias = tree.children.find((c: any) => c.type === 'type_alias');
      expect(typeAlias).toBeDefined();
      const typeName = typeAlias.children.find((c: any) => c.type === 'type_name');
      expect(typeName.text).toBe('Result');
    });

    it('parses enum declarations', async () => {
      const source = `export enum Status {
  Active,
  Inactive,
}`;
      const result = await treeSitterTypeScriptHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const enumDecl = tree.children.find((c: any) => c.type === 'enum_declaration');
      expect(enumDecl).toBeDefined();
    });

    it('parses const/variable declarations', async () => {
      const source = `const MAX_RETRIES = 3;
let counter = 0;`;
      const result = await treeSitterTypeScriptHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const varDecls = tree.children.filter((c: any) => c.type === 'variable_declaration');
      expect(varDecls.length).toBe(2);
    });

    it('parses arrow functions', async () => {
      const source = `export const handler = async (req: Request) => {
  return new Response();
};`;
      const result = await treeSitterTypeScriptHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const arrowFn = tree.children.find((c: any) => c.type === 'arrow_function');
      expect(arrowFn).toBeDefined();
    });

    it('identifies comments', async () => {
      const source = `// This is a comment
/* Block comment */
const x = 1;`;
      const result = await treeSitterTypeScriptHandler.parse!(
        { source },
        storage,
      );
      const tree = JSON.parse(result.tree as string);
      const comments = tree.children.filter((c: any) => c.type === 'comment');
      expect(comments.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('highlight', () => {
    it('identifies keyword highlights', async () => {
      const source = `import { foo } from 'bar';
export const x = 42;`;
      const result = await treeSitterTypeScriptHandler.highlight!(
        { source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const highlights = JSON.parse(result.highlights as string);
      const keywords = highlights.filter((h: any) => h.tokenType === 'keyword');
      expect(keywords.length).toBeGreaterThan(0);
    });

    it('identifies string highlights', async () => {
      const source = `const name = "hello";`;
      const result = await treeSitterTypeScriptHandler.highlight!(
        { source },
        storage,
      );
      const highlights = JSON.parse(result.highlights as string);
      const strings = highlights.filter((h: any) => h.tokenType === 'string');
      expect(strings.length).toBeGreaterThan(0);
    });

    it('identifies number highlights', async () => {
      const source = `const count = 42;`;
      const result = await treeSitterTypeScriptHandler.highlight!(
        { source },
        storage,
      );
      const highlights = JSON.parse(result.highlights as string);
      const numbers = highlights.filter((h: any) => h.tokenType === 'number');
      expect(numbers.length).toBeGreaterThan(0);
    });
  });

  describe('query', () => {
    it('queries for function declarations', async () => {
      const source = `function foo() {}
function bar() {}
const baz = () => {};`;
      const result = await treeSitterTypeScriptHandler.query!(
        { pattern: '(function_declaration)', source },
        storage,
      );
      expect(result.variant).toBe('ok');
      const matches = JSON.parse(result.matches as string);
      expect(matches.length).toBe(2);
    });

    it('queries for import declarations', async () => {
      const source = `import { a } from 'x';
import { b } from 'y';
const c = 1;`;
      const result = await treeSitterTypeScriptHandler.query!(
        { pattern: '(import_declaration)', source },
        storage,
      );
      const matches = JSON.parse(result.matches as string);
      expect(matches.length).toBe(2);
    });
  });

  describe('register', () => {
    it('returns TypeScript language registration info', async () => {
      const result = await treeSitterTypeScriptHandler.register!({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.language).toBe('typescript');
      const extensions = JSON.parse(result.extensions as string);
      expect(extensions).toContain('.ts');
      expect(extensions).toContain('.tsx');
    });
  });
});
