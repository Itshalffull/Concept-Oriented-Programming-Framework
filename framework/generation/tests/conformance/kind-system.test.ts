// ============================================================
// KindSystem Conformance Tests
//
// Validates kind taxonomy: define, connect (with cycle
// detection), route, validate, dependents, producers,
// consumers, and graph.
// See copf-generation-kit.md Part 1.2
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '@copf/kernel';
import { kindSystemHandler } from '../../implementations/typescript/kind-system.impl.js';
import type { ConceptStorage } from '@copf/kernel';

describe('KindSystem conformance', () => {
  let storage: ConceptStorage;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // --- define ---

  it('should define a new kind', async () => {
    const result = await kindSystemHandler.define(
      { name: 'ConceptAST', category: 'model' },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.kind).toBeDefined();
  });

  it('should return exists for duplicate kind (idempotent)', async () => {
    await kindSystemHandler.define(
      { name: 'ConceptAST', category: 'model' },
      storage,
    );

    const result = await kindSystemHandler.define(
      { name: 'ConceptAST', category: 'model' },
      storage,
    );
    expect(result.variant).toBe('exists');
  });

  // --- connect ---

  it('should connect two kinds', async () => {
    await kindSystemHandler.define({ name: 'ConceptAST', category: 'model' }, storage);
    await kindSystemHandler.define({ name: 'ConceptManifest', category: 'model' }, storage);

    const result = await kindSystemHandler.connect(
      { from: 'ConceptAST', to: 'ConceptManifest', relation: 'normalizes_to', transformName: 'SchemaGen' },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('should reject edge that would create a cycle', async () => {
    await kindSystemHandler.define({ name: 'A', category: 'model' }, storage);
    await kindSystemHandler.define({ name: 'B', category: 'model' }, storage);
    await kindSystemHandler.define({ name: 'C', category: 'model' }, storage);

    await kindSystemHandler.connect({ from: 'A', to: 'B', relation: 'renders_to' }, storage);
    await kindSystemHandler.connect({ from: 'B', to: 'C', relation: 'renders_to' }, storage);

    const result = await kindSystemHandler.connect(
      { from: 'C', to: 'A', relation: 'renders_to' },
      storage,
    );
    expect(result.variant).toBe('invalid');
    expect(result.message).toContain('cycle');
  });

  it('should reject self-loop', async () => {
    await kindSystemHandler.define({ name: 'A', category: 'model' }, storage);

    const result = await kindSystemHandler.connect(
      { from: 'A', to: 'A', relation: 'renders_to' },
      storage,
    );
    expect(result.variant).toBe('invalid');
  });

  it('should reject edge with nonexistent kind', async () => {
    await kindSystemHandler.define({ name: 'A', category: 'model' }, storage);

    const result = await kindSystemHandler.connect(
      { from: 'A', to: 'Nonexistent', relation: 'renders_to' },
      storage,
    );
    expect(result.variant).toBe('invalid');
  });

  // --- route ---

  it('should find shortest path between connected kinds', async () => {
    await kindSystemHandler.define({ name: 'ConceptAST', category: 'model' }, storage);
    await kindSystemHandler.define({ name: 'ConceptManifest', category: 'model' }, storage);
    await kindSystemHandler.define({ name: 'TypeScriptFiles', category: 'artifact' }, storage);

    await kindSystemHandler.connect(
      { from: 'ConceptAST', to: 'ConceptManifest', relation: 'normalizes_to', transformName: 'SchemaGen' },
      storage,
    );
    await kindSystemHandler.connect(
      { from: 'ConceptManifest', to: 'TypeScriptFiles', relation: 'renders_to', transformName: 'TypeScriptGen' },
      storage,
    );

    const result = await kindSystemHandler.route(
      { from: 'ConceptAST', to: 'TypeScriptFiles' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const path = result.path as any[];
    expect(path).toHaveLength(2);
    expect(path[0].kind).toBe('ConceptManifest');
    expect(path[0].transform).toBe('SchemaGen');
    expect(path[1].kind).toBe('TypeScriptFiles');
    expect(path[1].transform).toBe('TypeScriptGen');
  });

  it('should return unreachable when no path exists', async () => {
    await kindSystemHandler.define({ name: 'A', category: 'source' }, storage);
    await kindSystemHandler.define({ name: 'B', category: 'artifact' }, storage);

    const result = await kindSystemHandler.route(
      { from: 'A', to: 'B' },
      storage,
    );
    expect(result.variant).toBe('unreachable');
  });

  // --- validate ---

  it('should validate existing direct edge', async () => {
    await kindSystemHandler.define({ name: 'A', category: 'model' }, storage);
    await kindSystemHandler.define({ name: 'B', category: 'artifact' }, storage);
    await kindSystemHandler.connect({ from: 'A', to: 'B', relation: 'renders_to' }, storage);

    const result = await kindSystemHandler.validate(
      { from: 'A', to: 'B' },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('should return invalid for nonexistent edge', async () => {
    await kindSystemHandler.define({ name: 'A', category: 'model' }, storage);
    await kindSystemHandler.define({ name: 'B', category: 'artifact' }, storage);

    const result = await kindSystemHandler.validate(
      { from: 'A', to: 'B' },
      storage,
    );
    expect(result.variant).toBe('invalid');
  });

  // --- dependents ---

  it('should return transitive downstream kinds', async () => {
    await kindSystemHandler.define({ name: 'A', category: 'model' }, storage);
    await kindSystemHandler.define({ name: 'B', category: 'model' }, storage);
    await kindSystemHandler.define({ name: 'C', category: 'artifact' }, storage);
    await kindSystemHandler.define({ name: 'D', category: 'artifact' }, storage);

    await kindSystemHandler.connect({ from: 'A', to: 'B', relation: 'normalizes_to' }, storage);
    await kindSystemHandler.connect({ from: 'B', to: 'C', relation: 'renders_to' }, storage);
    await kindSystemHandler.connect({ from: 'B', to: 'D', relation: 'renders_to' }, storage);

    const result = await kindSystemHandler.dependents(
      { kind: 'A' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const downstream = result.downstream as string[];
    expect(downstream).toHaveLength(3);
    expect(downstream).toContain('B');
    expect(downstream).toContain('C');
    expect(downstream).toContain('D');
  });

  // --- producers ---

  it('should return transforms that produce a kind', async () => {
    await kindSystemHandler.define({ name: 'ConceptManifest', category: 'model' }, storage);
    await kindSystemHandler.define({ name: 'TypeScriptFiles', category: 'artifact' }, storage);
    await kindSystemHandler.define({ name: 'RustFiles', category: 'artifact' }, storage);

    await kindSystemHandler.connect(
      { from: 'ConceptManifest', to: 'TypeScriptFiles', relation: 'renders_to', transformName: 'TypeScriptGen' },
      storage,
    );
    await kindSystemHandler.connect(
      { from: 'ConceptManifest', to: 'RustFiles', relation: 'renders_to', transformName: 'RustGen' },
      storage,
    );

    const result = await kindSystemHandler.producers(
      { kind: 'TypeScriptFiles' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const transforms = result.transforms as any[];
    expect(transforms).toHaveLength(1);
    expect(transforms[0].fromKind).toBe('ConceptManifest');
    expect(transforms[0].transformName).toBe('TypeScriptGen');
  });

  // --- consumers ---

  it('should return transforms that consume a kind', async () => {
    await kindSystemHandler.define({ name: 'ConceptManifest', category: 'model' }, storage);
    await kindSystemHandler.define({ name: 'TypeScriptFiles', category: 'artifact' }, storage);
    await kindSystemHandler.define({ name: 'RustFiles', category: 'artifact' }, storage);

    await kindSystemHandler.connect(
      { from: 'ConceptManifest', to: 'TypeScriptFiles', relation: 'renders_to', transformName: 'TypeScriptGen' },
      storage,
    );
    await kindSystemHandler.connect(
      { from: 'ConceptManifest', to: 'RustFiles', relation: 'renders_to', transformName: 'RustGen' },
      storage,
    );

    const result = await kindSystemHandler.consumers(
      { kind: 'ConceptManifest' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const transforms = result.transforms as any[];
    expect(transforms).toHaveLength(2);
  });

  // --- graph ---

  it('should return full topology', async () => {
    await kindSystemHandler.define({ name: 'A', category: 'source' }, storage);
    await kindSystemHandler.define({ name: 'B', category: 'model' }, storage);
    await kindSystemHandler.connect({ from: 'A', to: 'B', relation: 'parses_to' }, storage);

    const result = await kindSystemHandler.graph({}, storage);
    expect(result.variant).toBe('ok');
    const kinds = result.kinds as any[];
    const edges = result.edges as any[];
    expect(kinds).toHaveLength(2);
    expect(edges).toHaveLength(1);
    expect(edges[0].from).toBe('A');
    expect(edges[0].to).toBe('B');
    expect(edges[0].relation).toBe('parses_to');
  });
});
