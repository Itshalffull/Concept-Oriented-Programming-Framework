// ============================================================
// CLI Tests — copf command-line interface
//
// Tests the CLI argument parser, command routing, and each
// command's core logic against the project's own specs.
// ============================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'fs';
import { resolve, join } from 'path';

// Import CLI internals
import { parseArgs } from '../cli/src/main';
import { findFiles } from '../cli/src/util';

// Import kernel modules used by commands
import { createInMemoryStorage } from '@clef/kernel';
import type { ConceptManifest } from '@clef/kernel';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler';
import { typescriptGenHandler } from '../handlers/ts/framework/typescript-gen.handler';
import { rustGenHandler } from '../handlers/ts/framework/rust-gen.handler';
import { syncCompilerHandler } from '../handlers/ts/framework/sync-compiler.handler';
import type { ConceptAST } from '../kernel/src/types';

const PROJECT_ROOT = resolve(__dirname, '..');
const SPECS_DIR = resolve(PROJECT_ROOT, 'specs');
const SYNCS_DIR = resolve(PROJECT_ROOT, 'syncs');
const TMP_DIR = resolve(PROJECT_ROOT, 'tests/.tmp-cli-test');

// ---- Argument Parsing ----

describe('CLI Argument Parser', () => {
  it('parses command with no args', () => {
    const result = parseArgs(['node', 'copf', 'check']);
    expect(result.command).toBe('check');
    expect(result.positional).toEqual([]);
    expect(result.flags).toEqual({});
  });

  it('parses command with positional args', () => {
    const result = parseArgs(['node', 'copf', 'init', 'myapp']);
    expect(result.command).toBe('init');
    expect(result.positional).toEqual(['myapp']);
  });

  it('parses --flag with value', () => {
    const result = parseArgs(['node', 'copf', 'generate', '--target', 'typescript']);
    expect(result.command).toBe('generate');
    expect(result.flags.target).toBe('typescript');
  });

  it('parses --flag without value (boolean)', () => {
    const result = parseArgs(['node', 'copf', 'test', '--integration']);
    expect(result.command).toBe('test');
    expect(result.flags.integration).toBe(true);
  });

  it('parses mixed args and flags', () => {
    const result = parseArgs([
      'node', 'copf', 'generate',
      '--target', 'rust',
      '--concept', 'Password',
    ]);
    expect(result.command).toBe('generate');
    expect(result.flags.target).toBe('rust');
    expect(result.flags.concept).toBe('Password');
  });

  it('defaults to help when no command given', () => {
    const result = parseArgs(['node', 'copf']);
    expect(result.command).toBe('help');
  });

  it('parses kit subcommand with positional', () => {
    const result = parseArgs(['node', 'copf', 'kit', 'init', 'my-kit']);
    expect(result.command).toBe('kit');
    expect(result.positional).toEqual(['init', 'my-kit']);
  });
});

// ---- File Finder Utility ----

describe('findFiles utility', () => {
  it('finds .concept files recursively', () => {
    const files = findFiles(SPECS_DIR, '.concept');
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f).toMatch(/\.concept$/);
    }
  });

  it('finds .sync files recursively', () => {
    const files = findFiles(SYNCS_DIR, '.sync');
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f).toMatch(/\.sync$/);
    }
  });

  it('returns empty array for nonexistent directory', () => {
    const files = findFiles('/nonexistent/path', '.concept');
    expect(files).toEqual([]);
  });

  it('returns sorted paths', () => {
    const files = findFiles(SPECS_DIR, '.concept');
    const sorted = [...files].sort();
    expect(files).toEqual(sorted);
  });
});

// ---- Check Command Logic ----

describe('check command (spec validation)', () => {
  it('parses all app concept specs without errors', () => {
    const files = findFiles(resolve(SPECS_DIR, 'app'), '.concept');
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, 'utf-8');
      const ast = parseConceptFile(source);
      expect(ast.name).toBeTruthy();
      expect(ast.actions.length).toBeGreaterThan(0);
    }
  });

  it('parses all framework concept specs without errors', () => {
    const files = findFiles(resolve(SPECS_DIR, 'framework'), '.concept');
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, 'utf-8');
      const ast = parseConceptFile(source);
      expect(ast.name).toBeTruthy();
    }
  });
});

// ---- Generate Command Logic ----

describe('generate command (schema + code generation)', () => {
  let passwordAST: ConceptAST;
  let passwordManifest: ConceptManifest;

  beforeAll(async () => {
    const source = readFileSync(
      resolve(SPECS_DIR, 'app/password.concept'),
      'utf-8',
    );
    passwordAST = parseConceptFile(source);

    const storage = createInMemoryStorage();
    const result = await schemaGenHandler.generate(
      { spec: 'password.concept', ast: passwordAST },
      storage,
    );
    expect(result.variant).toBe('ok');
    passwordManifest = result.manifest as ConceptManifest;
  });

  it('produces a valid ConceptManifest from Password spec', () => {
    expect(passwordManifest.name).toBe('Password');
    expect(passwordManifest.uri).toBe('urn:copf/Password');
    expect(passwordManifest.actions.length).toBeGreaterThan(0);
    expect(passwordManifest.relations.length).toBeGreaterThan(0);
    expect(passwordManifest.graphqlSchema).toContain('Password');
    expect(passwordManifest.jsonSchemas.invocations).toBeDefined();
  });

  it('generates TypeScript files from manifest', async () => {
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'password.concept', manifest: passwordManifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    expect(files.length).toBeGreaterThanOrEqual(3);

    const fileNames = files.map(f => f.path);
    expect(fileNames).toContain('password.types.ts');
    expect(fileNames).toContain('password.handler.ts');
    expect(fileNames).toContain('password.adapter.ts');

    // Types file should contain input/output types
    const typesFile = files.find(f => f.path === 'password.types.ts')!;
    expect(typesFile.content).toContain('PasswordSetInput');
    expect(typesFile.content).toContain('PasswordCheckInput');
    expect(typesFile.content).toContain('variant');
  });

  it('generates Rust files from manifest', async () => {
    const storage = createInMemoryStorage();
    const result = await rustGenHandler.generate(
      { spec: 'password.concept', manifest: passwordManifest },
      storage,
    );

    expect(result.variant).toBe('ok');
    const files = result.files as { path: string; content: string }[];
    expect(files.length).toBeGreaterThanOrEqual(3);

    const fileNames = files.map(f => f.path);
    expect(fileNames).toContain('password/types.rs');
    expect(fileNames).toContain('password/handler.rs');
    expect(fileNames).toContain('password/adapter.rs');

    // Types file should contain Rust structs
    const typesFile = files.find(f => f.path === 'password/types.rs')!;
    expect(typesFile.content).toContain('pub struct');
    expect(typesFile.content).toContain('pub enum');
    expect(typesFile.content).toContain('Serialize');
  });

  it('generates conformance tests when invariants exist', async () => {
    const storage = createInMemoryStorage();
    const result = await typescriptGenHandler.generate(
      { spec: 'password.concept', manifest: passwordManifest },
      storage,
    );

    const files = result.files as { path: string; content: string }[];
    const conformance = files.find(f => f.path.includes('conformance'));
    expect(conformance).toBeDefined();
    expect(conformance!.content).toContain('describe');
    expect(conformance!.content).toContain('expect');
  });
});

// ---- Compile Syncs Logic ----

describe('compile-syncs command (sync validation)', () => {
  it('parses all app sync files without errors', () => {
    const files = findFiles(resolve(SYNCS_DIR, 'app'), '.sync');
    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const source = readFileSync(file, 'utf-8');
      const syncs = parseSyncFile(source);
      expect(syncs.length).toBeGreaterThan(0);
      for (const sync of syncs) {
        expect(sync.name).toBeTruthy();
        expect(sync.when.length).toBeGreaterThan(0);
        expect(sync.then.length).toBeGreaterThan(0);
      }
    }
  });

  it('validates sync through SyncCompiler', async () => {
    const source = readFileSync(
      resolve(SYNCS_DIR, 'app/echo.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(source);
    expect(syncs.length).toBeGreaterThan(0);

    for (const sync of syncs) {
      const storage = createInMemoryStorage();
      const result = await syncCompilerHandler.compile(
        { sync: sync.name, ast: sync },
        storage,
      );
      expect(result.variant).toBe('ok');
    }
  });
});

// ---- Init Command Logic ----

describe('init command (project scaffolding)', () => {
  const testProjectDir = join(TMP_DIR, 'test-project');

  beforeAll(() => {
    mkdirSync(TMP_DIR, { recursive: true });
  });

  afterAll(() => {
    try {
      rmSync(TMP_DIR, { recursive: true, force: true });
    } catch {
      // cleanup best-effort
    }
  });

  it('creates project directory structure', async () => {
    // Import init command and call it
    const { initCommand } = await import(
      '../cli/src/commands/init'
    );

    // Override process.cwd for the test
    const origCwd = process.cwd;
    process.cwd = () => TMP_DIR;
    // Prevent process.exit from killing tests
    const origExit = process.exit;
    process.exit = (() => { throw new Error('exit'); }) as never;

    try {
      await initCommand(['test-project'], {});
    } catch (e) {
      // Ignore exit errors
      if (e instanceof Error && e.message === 'exit') throw e;
    } finally {
      process.cwd = origCwd;
      process.exit = origExit;
    }

    // Verify directory structure
    expect(existsSync(join(testProjectDir, 'specs/app'))).toBe(true);
    expect(existsSync(join(testProjectDir, 'syncs/app'))).toBe(true);
    expect(existsSync(join(testProjectDir, 'handlers/ts/app'))).toBe(true);
    expect(existsSync(join(testProjectDir, 'tests'))).toBe(true);
    expect(existsSync(join(testProjectDir, 'repertoire'))).toBe(true);

    // Verify template files
    expect(existsSync(join(testProjectDir, 'package.json'))).toBe(true);
    expect(existsSync(join(testProjectDir, 'tsconfig.json'))).toBe(true);
    expect(existsSync(join(testProjectDir, '.gitignore'))).toBe(true);
    expect(existsSync(join(testProjectDir, 'specs/app/hello.concept'))).toBe(true);
    expect(existsSync(join(testProjectDir, 'syncs/app/hello.sync'))).toBe(true);

    // Verify the example concept is parseable
    const conceptSource = readFileSync(
      join(testProjectDir, 'specs/app/hello.concept'),
      'utf-8',
    );
    const ast = parseConceptFile(conceptSource);
    expect(ast.name).toBe('Hello');

    // Verify the example sync is parseable
    const syncSource = readFileSync(
      join(testProjectDir, 'syncs/app/hello.sync'),
      'utf-8',
    );
    const syncs = parseSyncFile(syncSource);
    expect(syncs.length).toBeGreaterThan(0);
  });
});

// ---- Full Pipeline Integration ----

describe('full CLI pipeline (check → generate → compile-syncs)', () => {
  it('processes all project specs end-to-end', async () => {
    // 1. Check: parse all concept specs
    const conceptFiles = findFiles(resolve(SPECS_DIR, 'app'), '.concept');
    const asts: ConceptAST[] = [];

    for (const file of conceptFiles) {
      const source = readFileSync(file, 'utf-8');
      const ast = parseConceptFile(source);
      asts.push(ast);
    }

    expect(asts.length).toBeGreaterThanOrEqual(5);

    // 2. Generate: produce manifests for all concepts
    for (const ast of asts) {
      const storage = createInMemoryStorage();
      const result = await schemaGenHandler.generate(
        { spec: `${ast.name.toLowerCase()}.concept`, ast },
        storage,
      );
      expect(result.variant).toBe('ok');

      const manifest = result.manifest as ConceptManifest;
      expect(manifest.name).toBe(ast.name);

      // Generate TypeScript
      const tsStorage = createInMemoryStorage();
      const tsResult = await typescriptGenHandler.generate(
        { spec: `${ast.name.toLowerCase()}.concept`, manifest },
        tsStorage,
      );
      expect(tsResult.variant).toBe('ok');
    }

    // 3. Compile syncs: validate all sync files
    const syncFiles = findFiles(resolve(SYNCS_DIR, 'app'), '.sync');
    for (const file of syncFiles) {
      const source = readFileSync(file, 'utf-8');
      const syncs = parseSyncFile(source);
      for (const sync of syncs) {
        const storage = createInMemoryStorage();
        const result = await syncCompilerHandler.compile(
          { sync: sync.name, ast: sync },
          storage,
        );
        expect(result.variant).toBe('ok');
      }
    }
  });
});
