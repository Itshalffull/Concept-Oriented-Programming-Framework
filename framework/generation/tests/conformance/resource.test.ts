// ============================================================
// Resource Conformance Tests
//
// Validates input resource tracking: upsert (created/changed/
// unchanged), get, list, remove, and diff.
// See clef-generation-suite.md Part 1.1
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@clef/kernel';
import { resourceHandler } from '../../implementations/typescript/resource.impl.js';
import type { ConceptStorage } from '@clef/kernel';

describe('Resource conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- upsert ---

  it('should return created for a new resource', async () => {
    const result = await resourceHandler.upsert(
      { locator: './specs/password.concept', kind: 'concept-spec', digest: 'abc123' },
      storage,
    );
    expect(result.variant).toBe('created');
    expect(result.resource).toBeDefined();
  });

  it('should return unchanged when digest matches', async () => {
    await resourceHandler.upsert(
      { locator: './specs/password.concept', kind: 'concept-spec', digest: 'abc123' },
      storage,
    );

    const result = await resourceHandler.upsert(
      { locator: './specs/password.concept', kind: 'concept-spec', digest: 'abc123' },
      storage,
    );
    expect(result.variant).toBe('unchanged');
  });

  it('should return changed when digest differs', async () => {
    await resourceHandler.upsert(
      { locator: './specs/password.concept', kind: 'concept-spec', digest: 'abc123' },
      storage,
    );

    const result = await resourceHandler.upsert(
      { locator: './specs/password.concept', kind: 'concept-spec', digest: 'def456' },
      storage,
    );
    expect(result.variant).toBe('changed');
    expect(result.previousDigest).toBe('abc123');
  });

  it('should preserve resource ID across upserts', async () => {
    const created = await resourceHandler.upsert(
      { locator: './specs/pw.concept', kind: 'concept-spec', digest: 'aaa' },
      storage,
    );
    const changed = await resourceHandler.upsert(
      { locator: './specs/pw.concept', kind: 'concept-spec', digest: 'bbb' },
      storage,
    );
    expect(changed.resource).toBe(created.resource);
  });

  // --- get ---

  it('should return ok for existing resource', async () => {
    await resourceHandler.upsert(
      { locator: './specs/pw.concept', kind: 'concept-spec', digest: 'abc' },
      storage,
    );

    const result = await resourceHandler.get(
      { locator: './specs/pw.concept' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.kind).toBe('concept-spec');
    expect(result.digest).toBe('abc');
  });

  it('should return notFound for nonexistent resource', async () => {
    const result = await resourceHandler.get(
      { locator: './nonexistent' },
      storage,
    );
    expect(result.variant).toBe('notFound');
  });

  // --- list ---

  it('should list all tracked resources', async () => {
    await resourceHandler.upsert(
      { locator: './specs/a.concept', kind: 'concept-spec', digest: 'a' },
      storage,
    );
    await resourceHandler.upsert(
      { locator: './specs/b.sync', kind: 'sync-spec', digest: 'b' },
      storage,
    );

    const result = await resourceHandler.list({}, storage);
    expect(result.variant).toBe('ok');
    const resources = result.resources as any[];
    expect(resources).toHaveLength(2);
  });

  it('should filter by kind', async () => {
    await resourceHandler.upsert(
      { locator: './specs/a.concept', kind: 'concept-spec', digest: 'a' },
      storage,
    );
    await resourceHandler.upsert(
      { locator: './specs/b.sync', kind: 'sync-spec', digest: 'b' },
      storage,
    );

    const result = await resourceHandler.list(
      { kind: 'concept-spec' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const resources = result.resources as any[];
    expect(resources).toHaveLength(1);
    expect(resources[0].kind).toBe('concept-spec');
  });

  // --- remove ---

  it('should remove an existing resource', async () => {
    await resourceHandler.upsert(
      { locator: './specs/pw.concept', kind: 'concept-spec', digest: 'abc' },
      storage,
    );

    const result = await resourceHandler.remove(
      { locator: './specs/pw.concept' },
      storage,
    );
    expect(result.variant).toBe('ok');

    // Verify it's gone
    const get = await resourceHandler.get(
      { locator: './specs/pw.concept' },
      storage,
    );
    expect(get.variant).toBe('notFound');
  });

  it('should return notFound when removing nonexistent resource', async () => {
    const result = await resourceHandler.remove(
      { locator: './nonexistent' },
      storage,
    );
    expect(result.variant).toBe('notFound');
  });

  // --- diff ---

  it('should return unknown for unregistered kind-specific differ', async () => {
    const result = await resourceHandler.diff(
      { locator: './specs/pw.concept', oldDigest: 'a', newDigest: 'b' },
      storage,
    );
    expect(result.variant).toBe('unknown');
  });
});
