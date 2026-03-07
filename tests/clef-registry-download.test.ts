// ============================================================
// Download Concept Tests (v2)
//
// Validates the Download concept handler — registration with
// kind field, resolve with kind filtering, yank, and stats.
// ============================================================

import { describe, it, expect } from 'vitest';
import { createInMemoryStorage } from '../runtime/index.js';
import { downloadHandler } from '../clef-registry/handlers/ts/download.handler.js';

// ============================================================
// Download Concept
// ============================================================

describe('Download Concept (v2)', () => {
  it('registers a binary artifact with default kind', async () => {
    const storage = createInMemoryStorage();
    const result = await downloadHandler.register({
      artifact_id: 'cli',
      platform: 'darwin-arm64',
      version: '1.0.0',
      content_hash: 'sha256:abc',
      artifact_url: 'https://dl.clef.dev/cli/1.0.0/darwin-arm64',
      size_bytes: 42000000,
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.download).toBe('cli:darwin-arm64:1.0.0');
  });

  it('registers an artifact with explicit kind', async () => {
    const storage = createInMemoryStorage();
    const result = await downloadHandler.register({
      artifact_id: 'my-lib',
      platform: 'any',
      version: '2.0.0',
      content_hash: 'sha256:def',
      artifact_url: 'https://dl.clef.dev/my-lib/2.0.0/any',
      size_bytes: 1000000,
      kind: 'package',
    }, storage);

    expect(result.variant).toBe('ok');
    expect(result.download).toBe('my-lib:any:2.0.0');
  });

  it('stores the kind field in storage', async () => {
    const storage = createInMemoryStorage();

    await downloadHandler.register({
      artifact_id: 'cli',
      platform: 'linux-amd64',
      version: '1.0.0',
      content_hash: 'sha256:abc',
      artifact_url: 'https://dl.clef.dev/cli/1.0.0/linux-amd64',
      size_bytes: 42000000,
      kind: 'binary',
    }, storage);

    await downloadHandler.register({
      artifact_id: 'my-pkg',
      platform: 'any',
      version: '1.0.0',
      content_hash: 'sha256:xyz',
      artifact_url: 'https://dl.clef.dev/my-pkg/1.0.0/any',
      size_bytes: 500000,
      kind: 'package',
    }, storage);

    // Resolve the binary
    const bin = await downloadHandler.resolve({
      artifact_id: 'cli',
      platform: 'linux-amd64',
      version_range: '^1.0.0',
    }, storage);
    expect(bin.variant).toBe('ok');
    expect(bin.download).toBe('cli:linux-amd64:1.0.0');

    // Resolve the package
    const pkg = await downloadHandler.resolve({
      artifact_id: 'my-pkg',
      platform: 'any',
      version_range: '^1.0.0',
    }, storage);
    expect(pkg.variant).toBe('ok');
    expect(pkg.download).toBe('my-pkg:any:1.0.0');
  });

  it('rejects duplicate registration', async () => {
    const storage = createInMemoryStorage();

    await downloadHandler.register({
      artifact_id: 'cli',
      platform: 'darwin-arm64',
      version: '1.0.0',
      content_hash: 'sha256:abc',
      artifact_url: 'https://dl.clef.dev/cli/1.0.0/darwin-arm64',
      size_bytes: 42000000,
      kind: 'binary',
    }, storage);

    const dup = await downloadHandler.register({
      artifact_id: 'cli',
      platform: 'darwin-arm64',
      version: '1.0.0',
      content_hash: 'sha256:abc',
      artifact_url: 'https://dl.clef.dev/cli/1.0.0/darwin-arm64',
      size_bytes: 42000000,
      kind: 'binary',
    }, storage);

    expect(dup.variant).toBe('exists');
  });

  it('resolve filters by kind when specified', async () => {
    const storage = createInMemoryStorage();

    // Register a binary and a package for the same artifact_id and platform
    await downloadHandler.register({
      artifact_id: 'multi',
      platform: 'linux-amd64',
      version: '1.0.0',
      content_hash: 'sha256:bin1',
      artifact_url: 'https://dl.clef.dev/multi/1.0.0/linux-amd64-bin',
      size_bytes: 50000000,
      kind: 'binary',
    }, storage);

    await downloadHandler.register({
      artifact_id: 'multi',
      platform: 'linux-amd64',
      version: '1.1.0',
      content_hash: 'sha256:pkg1',
      artifact_url: 'https://dl.clef.dev/multi/1.1.0/linux-amd64-pkg',
      size_bytes: 2000000,
      kind: 'package',
    }, storage);

    // Resolve with kind=binary should only return the binary
    const binResult = await downloadHandler.resolve({
      artifact_id: 'multi',
      platform: 'linux-amd64',
      version_range: '^1.0.0',
      kind: 'binary',
    }, storage);
    expect(binResult.variant).toBe('ok');
    expect(binResult.download).toBe('multi:linux-amd64:1.0.0');

    // Resolve with kind=package should only return the package
    const pkgResult = await downloadHandler.resolve({
      artifact_id: 'multi',
      platform: 'linux-amd64',
      version_range: '^1.0.0',
      kind: 'package',
    }, storage);
    expect(pkgResult.variant).toBe('ok');
    expect(pkgResult.download).toBe('multi:linux-amd64:1.1.0');
  });

  it('resolve without kind returns all active artifacts', async () => {
    const storage = createInMemoryStorage();

    await downloadHandler.register({
      artifact_id: 'tool',
      platform: 'any',
      version: '1.0.0',
      content_hash: 'sha256:aaa',
      artifact_url: 'https://dl.clef.dev/tool/1.0.0/any',
      size_bytes: 1000000,
      kind: 'binary',
    }, storage);

    await downloadHandler.register({
      artifact_id: 'tool',
      platform: 'any',
      version: '2.0.0',
      content_hash: 'sha256:bbb',
      artifact_url: 'https://dl.clef.dev/tool/2.0.0/any',
      size_bytes: 2000000,
      kind: 'package',
    }, storage);

    // Without kind filter, should return the highest version regardless of kind
    const result = await downloadHandler.resolve({
      artifact_id: 'tool',
      platform: 'any',
      version_range: '*',
    }, storage);
    expect(result.variant).toBe('ok');
    expect(result.download).toBe('tool:any:2.0.0');
  });

  it('resolve returns notfound when kind filter excludes all', async () => {
    const storage = createInMemoryStorage();

    await downloadHandler.register({
      artifact_id: 'only-bin',
      platform: 'darwin-arm64',
      version: '1.0.0',
      content_hash: 'sha256:xxx',
      artifact_url: 'https://dl.clef.dev/only-bin/1.0.0/darwin-arm64',
      size_bytes: 30000000,
      kind: 'binary',
    }, storage);

    const result = await downloadHandler.resolve({
      artifact_id: 'only-bin',
      platform: 'darwin-arm64',
      version_range: '^1.0.0',
      kind: 'package',
    }, storage);
    expect(result.variant).toBe('notfound');
  });

  it('yank marks artifact as yanked', async () => {
    const storage = createInMemoryStorage();

    await downloadHandler.register({
      artifact_id: 'cli',
      platform: 'linux-amd64',
      version: '1.0.0',
      content_hash: 'sha256:abc',
      artifact_url: 'https://dl.clef.dev/cli/1.0.0/linux-amd64',
      size_bytes: 42000000,
      kind: 'binary',
    }, storage);

    const yank = await downloadHandler.yank(
      { download: 'cli:linux-amd64:1.0.0' },
      storage,
    );
    expect(yank.variant).toBe('ok');

    // Resolve should no longer find it
    const resolve = await downloadHandler.resolve({
      artifact_id: 'cli',
      platform: 'linux-amd64',
      version_range: '^1.0.0',
    }, storage);
    expect(resolve.variant).toBe('notfound');
  });

  it('yank returns notfound for unknown download', async () => {
    const storage = createInMemoryStorage();
    const result = await downloadHandler.yank(
      { download: 'nonexistent:linux:1.0.0' },
      storage,
    );
    expect(result.variant).toBe('notfound');
  });

  it('stats returns download counts', async () => {
    const storage = createInMemoryStorage();

    await downloadHandler.register({
      artifact_id: 'cli',
      platform: 'darwin-arm64',
      version: '1.0.0',
      content_hash: 'sha256:abc',
      artifact_url: 'https://dl.clef.dev/cli/1.0.0/darwin-arm64',
      size_bytes: 42000000,
      kind: 'binary',
    }, storage);

    await downloadHandler.register({
      artifact_id: 'cli',
      platform: 'linux-amd64',
      version: '1.0.0',
      content_hash: 'sha256:def',
      artifact_url: 'https://dl.clef.dev/cli/1.0.0/linux-amd64',
      size_bytes: 43000000,
      kind: 'binary',
    }, storage);

    // Resolve a few times to increment counts
    await downloadHandler.resolve({
      artifact_id: 'cli',
      platform: 'darwin-arm64',
      version_range: '^1.0.0',
    }, storage);
    await downloadHandler.resolve({
      artifact_id: 'cli',
      platform: 'darwin-arm64',
      version_range: '^1.0.0',
    }, storage);
    await downloadHandler.resolve({
      artifact_id: 'cli',
      platform: 'linux-amd64',
      version_range: '^1.0.0',
    }, storage);

    const stats = await downloadHandler.stats({ artifact_id: 'cli' }, storage);
    expect(stats.variant).toBe('ok');
    expect(stats.total_downloads).toBe(3);
    const byPlatform = stats.by_platform as Array<{ platform: string; count: number }>;
    expect(byPlatform).toHaveLength(2);
  });

  it('stats returns notfound for unknown artifact', async () => {
    const storage = createInMemoryStorage();
    const result = await downloadHandler.stats({ artifact_id: 'nonexistent' }, storage);
    expect(result.variant).toBe('notfound');
  });

  it('kind defaults to binary when not provided', async () => {
    const storage = createInMemoryStorage();

    await downloadHandler.register({
      artifact_id: 'default-kind',
      platform: 'any',
      version: '1.0.0',
      content_hash: 'sha256:zzz',
      artifact_url: 'https://dl.clef.dev/default-kind/1.0.0/any',
      size_bytes: 100000,
      // kind not provided — should default to 'binary'
    }, storage);

    // Should be findable with kind=binary filter
    const result = await downloadHandler.resolve({
      artifact_id: 'default-kind',
      platform: 'any',
      version_range: '^1.0.0',
      kind: 'binary',
    }, storage);
    expect(result.variant).toBe('ok');
  });
});
