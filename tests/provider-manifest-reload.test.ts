// ProviderManifest reload diff semantics + dev-mode file watcher tests.
// See docs/plans/virtual-provider-registry-prd.md §4.6 (VPR-19).

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  providerManifestHandler,
  registerManifestReader,
  clearManifestReaders,
  setPluginRegistryEmitter,
  type ManifestReaderFn,
} from '../handlers/ts/app/provider-manifest.handler.ts';
import { interpret } from '../runtime/interpreter.ts';
import { createInMemoryStorage } from '../runtime/adapters/storage.ts';
import { startFileWatcher } from '../handlers/ts/readers/file-watcher.ts';

type Entry = {
  kind: 'parse' | 'format' | 'highlight' | 'content-serializer';
  slot: string;
  provider: string;
  options: string;
  extensions: string[];
  priority: number;
  sourcePath: string;
};

function makeMutableReader(initial: Entry[]): {
  fn: ManifestReaderFn;
  set(entries: Entry[]): void;
} {
  let current = initial;
  return {
    fn: (_path: string) => current.map((e) => ({ ...e })),
    set(entries: Entry[]) {
      current = entries;
    },
  };
}

describe('ProviderManifest/reload diff semantics', () => {
  beforeEach(() => {
    clearManifestReaders();
    setPluginRegistryEmitter(null);
  });

  afterEach(() => {
    clearManifestReaders();
    setPluginRegistryEmitter(null);
  });

  it('reports added=1 when a new entry appears', async () => {
    const storage = createInMemoryStorage();
    const reader = makeMutableReader([
      { kind: 'parse', slot: 'ts', provider: 'tree-sitter', options: '', extensions: ['ts'], priority: 10, sourcePath: 'fake.yaml' },
    ]);
    registerManifestReader('mutable', ['fake.yaml'], 10, reader.fn);

    const loadResult = await interpret(
      providerManifestHandler.load({ sources: ['fake.yaml'] }),
      storage,
    );
    expect(loadResult.variant).toBe('ok');

    reader.set([
      { kind: 'parse', slot: 'ts', provider: 'tree-sitter', options: '', extensions: ['ts'], priority: 10, sourcePath: 'fake.yaml' },
      { kind: 'parse', slot: 'js', provider: 'tree-sitter', options: '', extensions: ['js'], priority: 10, sourcePath: 'fake.yaml' },
    ]);

    const reloadResult = await interpret(
      providerManifestHandler.reload({}),
      storage,
    );
    expect(reloadResult.variant).toBe('ok');
    expect(reloadResult.output?.added).toBe(1);
    expect(reloadResult.output?.removed).toBe(0);
    expect(reloadResult.output?.changed).toBe(0);
  });

  it('reports removed=1 when an entry disappears', async () => {
    const storage = createInMemoryStorage();
    const reader = makeMutableReader([
      { kind: 'parse', slot: 'ts', provider: 'tree-sitter', options: '', extensions: ['ts'], priority: 10, sourcePath: 'fake.yaml' },
      { kind: 'parse', slot: 'js', provider: 'tree-sitter', options: '', extensions: ['js'], priority: 10, sourcePath: 'fake.yaml' },
    ]);
    registerManifestReader('mutable', ['fake.yaml'], 10, reader.fn);

    const loadResult = await interpret(
      providerManifestHandler.load({ sources: ['fake.yaml'] }),
      storage,
    );
    expect(loadResult.variant).toBe('ok');

    reader.set([
      { kind: 'parse', slot: 'ts', provider: 'tree-sitter', options: '', extensions: ['ts'], priority: 10, sourcePath: 'fake.yaml' },
    ]);

    const reloadResult = await interpret(
      providerManifestHandler.reload({}),
      storage,
    );
    expect(reloadResult.variant).toBe('ok');
    expect(reloadResult.output?.added).toBe(0);
    expect(reloadResult.output?.removed).toBe(1);
    expect(reloadResult.output?.changed).toBe(0);
  });

  it('reports changed=1 when an entry options string differs', async () => {
    const storage = createInMemoryStorage();
    const reader = makeMutableReader([
      { kind: 'parse', slot: 'ts', provider: 'tree-sitter', options: 'aaa', extensions: ['ts'], priority: 10, sourcePath: 'fake.yaml' },
    ]);
    registerManifestReader('mutable', ['fake.yaml'], 10, reader.fn);

    const loadResult = await interpret(
      providerManifestHandler.load({ sources: ['fake.yaml'] }),
      storage,
    );
    expect(loadResult.variant).toBe('ok');

    reader.set([
      { kind: 'parse', slot: 'ts', provider: 'tree-sitter', options: 'bbb', extensions: ['ts'], priority: 10, sourcePath: 'fake.yaml' },
    ]);

    const reloadResult = await interpret(
      providerManifestHandler.reload({}),
      storage,
    );
    expect(reloadResult.variant).toBe('ok');
    expect(reloadResult.output?.added).toBe(0);
    expect(reloadResult.output?.removed).toBe(0);
    expect(reloadResult.output?.changed).toBe(1);
  });
});

describe('dev-mode file watcher', () => {
  let tempDir: string;

  beforeEach(() => {
    clearManifestReaders();
    tempDir = mkdtempSync(join(tmpdir(), 'provider-manifest-watcher-'));
  });

  afterEach(() => {
    clearManifestReaders();
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch { /* ignore */ }
  });

  it('fires ProviderManifest/reload on file change (debounced)', async () => {
    const configPath = join(tempDir, 'providers.yaml');
    writeFileSync(configPath, 'initial: true\n');

    const invocations: Array<{ concept: string; action: string }> = [];
    const invoke = async (concept: string, action: string) => {
      invocations.push({ concept, action });
      return { variant: 'ok' };
    };

    const handle = startFileWatcher(invoke, {
      paths: [configPath],
      debounceMs: 40,
    });

    try {
      // Write twice in quick succession — debounce should collapse to one reload.
      writeFileSync(configPath, 'changed: 1\n');
      writeFileSync(configPath, 'changed: 2\n');

      await new Promise((r) => setTimeout(r, 150));

      expect(invocations.length).toBeGreaterThanOrEqual(1);
      expect(invocations[0]).toEqual({
        concept: 'ProviderManifest',
        action: 'reload',
      });
    } finally {
      handle.stop();
    }
  });
});
