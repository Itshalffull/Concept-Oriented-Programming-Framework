// Resolver Contract Awareness Tests (MAG-661)
//
// Verifies that:
// 1. Existing WidgetResolver outcomes are unchanged in compat mode
// 2. The optional contractProfile state field is accepted without affecting resolve output
// 3. The BindContractsOnResolve sync parses correctly and references the expected concepts/actions
// 4. SurfaceLens.resolve action is present in the spec

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { parseConceptFile } from '../handlers/ts/framework/spec-parser.handler.js';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.handler.js';
import { schemaGenHandler } from '../handlers/ts/framework/schema-gen.handler.js';
import { createInMemoryStorage } from '../runtime/index.js';
import type { ConceptAST, ConceptManifest } from '../runtime/types.js';

const ROOT = resolve(__dirname, '..');

async function generateManifest(ast: ConceptAST): Promise<ConceptManifest> {
  const storage = createInMemoryStorage();
  const result = await schemaGenHandler.generate({ spec: 'test', ast }, storage);
  expect(result.variant).toBe('ok');
  return result.manifest as ConceptManifest;
}

// ─── WidgetResolver spec changes ──────────────────────────────────────────

describe('WidgetResolver concept — contract-profile field (MAG-661)', () => {
  const SPEC_PATH = resolve(ROOT, 'repertoire/concepts/ui-component/widget-resolver.concept');

  it('parses correctly with the new contractProfile state field', () => {
    const source = readFileSync(SPEC_PATH, 'utf-8');
    const ast = parseConceptFile(source);

    expect(ast.name).toBe('WidgetResolver');
    // All original actions are still present — no regressions
    const actionNames = ast.actions.map((a) => a.name);
    expect(actionNames).toContain('resolve');
    expect(actionNames).toContain('resolveAll');
    expect(actionNames).toContain('override');
    expect(actionNames).toContain('setWeights');
    expect(actionNames).toContain('explain');
  });

  it('includes contractProfile as an optional state field (option String relation)', () => {
    const source = readFileSync(SPEC_PATH, 'utf-8');
    const ast = parseConceptFile(source);

    const contractProfileField = ast.state.find((f) => f.name === 'contractProfile');
    expect(contractProfileField).toBeDefined();

    // State fields in Clef are relations: kind === 'relation', to === the value type
    expect(contractProfileField!.type).toMatchObject({ kind: 'relation' });
    // The value type is option String
    expect((contractProfileField!.type as any).to).toMatchObject({
      kind: 'option',
      inner: { kind: 'primitive', name: 'String' },
    });
  });

  it('generates a valid manifest with contractProfile in the relations', async () => {
    const source = readFileSync(SPEC_PATH, 'utf-8');
    const ast = parseConceptFile(source);
    const manifest = await generateManifest(ast);

    expect(manifest.name).toBe('WidgetResolver');
    // Original actions still present in manifest
    const manifestActionNames = manifest.actions.map((a) => a.name);
    expect(manifestActionNames).toContain('resolve');
    expect(manifestActionNames).toContain('resolveAll');
    expect(manifestActionNames).toContain('override');
    expect(manifestActionNames).toContain('setWeights');
    expect(manifestActionNames).toContain('explain');

    // contractProfile appears in the stored relation
    const entries = manifest.relations.find((r) => r.name === 'entries');
    expect(entries?.fields.some((f) => f.name === 'contractProfile')).toBe(true);
  });

  it('resolve action output variants are unchanged — contractProfile is not in resolve output', async () => {
    const source = readFileSync(SPEC_PATH, 'utf-8');
    const ast = parseConceptFile(source);
    const manifest = await generateManifest(ast);

    const resolveAction = manifest.actions.find((a) => a.name === 'resolve');
    expect(resolveAction).toBeDefined();

    // The three ok variant overloads from the original spec are all present
    const okVariants = resolveAction!.variants.filter((v) => v.tag === 'ok');
    expect(okVariants.length).toBeGreaterThanOrEqual(1);

    // contractProfile is NOT added to any resolve output — it is internal state only
    for (const v of okVariants) {
      const hasContractProfile = v.fields.some((f) => f.name === 'contractProfile');
      expect(hasContractProfile).toBe(false);
    }
  });

  it('resolve action variant structure matches the original spec — no regressions', async () => {
    const source = readFileSync(SPEC_PATH, 'utf-8');
    const ast = parseConceptFile(source);
    const manifest = await generateManifest(ast);

    const resolveAction = manifest.actions.find((a) => a.name === 'resolve');
    expect(resolveAction).toBeDefined();

    // All three original ok overloads present with their original output fields
    const okVariants = resolveAction!.variants.filter((v) => v.tag === 'ok');
    expect(okVariants.length).toBe(3);

    // First ok: full resolution with widget, score, reason, bindingMap
    const fullOk = okVariants.find((v) => v.fields.some((f) => f.name === 'widget'));
    expect(fullOk).toBeDefined();
    expect(fullOk!.fields.map((f) => f.name)).toContain('score');
    expect(fullOk!.fields.map((f) => f.name)).toContain('reason');
    expect(fullOk!.fields.map((f) => f.name)).toContain('bindingMap');
  });
});

// ─── SurfaceLens.resolve action ──────────────────────────────────────────

describe('SurfaceLens concept — resolve action (MAG-661)', () => {
  const SPEC_PATH = resolve(ROOT, 'specs/surface/surface-lens.concept');

  it('parses with resolve action present', () => {
    const source = readFileSync(SPEC_PATH, 'utf-8');
    const ast = parseConceptFile(source);

    expect(ast.actions.map((a) => a.name)).toContain('resolve');
  });

  it('resolve action accepts widget and context params', () => {
    const source = readFileSync(SPEC_PATH, 'utf-8');
    const ast = parseConceptFile(source);

    const resolveAction = ast.actions.find((a) => a.name === 'resolve');
    expect(resolveAction).toBeDefined();

    const paramNames = resolveAction!.params.map((p) => p.name);
    expect(paramNames).toContain('widget');
    expect(paramNames).toContain('context');
  });

  it('resolve action returns ok(bindings) and notfound variants', () => {
    const source = readFileSync(SPEC_PATH, 'utf-8');
    const ast = parseConceptFile(source);

    const resolveAction = ast.actions.find((a) => a.name === 'resolve');
    expect(resolveAction).toBeDefined();

    // In the parsed AST, variants use 'name' not 'tag'
    const variantNames = resolveAction!.variants.map((v) => (v as any).name);
    expect(variantNames).toContain('ok');
    expect(variantNames).toContain('notfound');

    const okVariant = resolveAction!.variants.find((v) => (v as any).name === 'ok');
    const bindingsParam = (okVariant as any)?.params?.find((p: any) => p.name === 'bindings');
    expect(bindingsParam).toBeDefined();
  });

  it('generates a manifest that includes resolve in jsonSchemas', async () => {
    const source = readFileSync(SPEC_PATH, 'utf-8');
    const ast = parseConceptFile(source);
    const manifest = await generateManifest(ast);

    expect(manifest.jsonSchemas.invocations.resolve).toBeDefined();
    expect(manifest.jsonSchemas.completions.resolve?.ok).toBeDefined();
    expect(manifest.jsonSchemas.completions.resolve?.notfound).toBeDefined();
  });

  it('existing bind/get/list actions are still present — no regressions', () => {
    const source = readFileSync(SPEC_PATH, 'utf-8');
    const ast = parseConceptFile(source);

    const actionNames = ast.actions.map((a) => a.name);
    expect(actionNames).toContain('bind');
    expect(actionNames).toContain('get');
    expect(actionNames).toContain('list');
  });
});

// ─── BindContractsOnResolve sync ─────────────────────────────────────────

describe('BindContractsOnResolve sync (MAG-661)', () => {
  const SYNC_PATH = resolve(ROOT, 'syncs/surface/bind-contracts-on-resolve.sync');

  it('sync file exists and parses without errors', () => {
    const source = readFileSync(SYNC_PATH, 'utf-8');
    const syncs = parseSyncFile(source);

    expect(Array.isArray(syncs)).toBe(true);
    expect(syncs.length).toBeGreaterThanOrEqual(1);
  });

  it('sync is named BindContractsOnResolve', () => {
    const source = readFileSync(SYNC_PATH, 'utf-8');
    const syncs = parseSyncFile(source);

    const bindSync = syncs.find((s) => s.name === 'BindContractsOnResolve');
    expect(bindSync).toBeDefined();
  });

  it('sync fires on WidgetResolver/resolve completion', () => {
    const source = readFileSync(SYNC_PATH, 'utf-8');
    const syncs = parseSyncFile(source);

    const bindSync = syncs.find((s) => s.name === 'BindContractsOnResolve');
    expect(bindSync).toBeDefined();

    const whenPatterns = bindSync!.when;
    expect(whenPatterns.length).toBeGreaterThanOrEqual(1);

    // The parser resolves concept names to URNs: urn:clef/WidgetResolver
    const resolverPattern = whenPatterns.find(
      (p) =>
        (p.concept === 'WidgetResolver' || p.concept === 'urn:clef/WidgetResolver') &&
        p.action === 'resolve',
    );
    expect(resolverPattern).toBeDefined();
  });

  it('sync then clause invokes SurfaceLens/resolve', () => {
    const source = readFileSync(SYNC_PATH, 'utf-8');
    const syncs = parseSyncFile(source);

    const bindSync = syncs.find((s) => s.name === 'BindContractsOnResolve');
    expect(bindSync).toBeDefined();

    const thenClauses = bindSync!.then;
    expect(thenClauses.length).toBeGreaterThanOrEqual(1);

    // The parser resolves concept names to URNs: urn:clef/SurfaceLens
    const lensInvocation = thenClauses.find(
      (t) =>
        (t.concept === 'SurfaceLens' || t.concept === 'urn:clef/SurfaceLens') &&
        t.action === 'resolve',
    );
    expect(lensInvocation).toBeDefined();
  });

  it('sync is annotated as eager', () => {
    const source = readFileSync(SYNC_PATH, 'utf-8');
    const syncs = parseSyncFile(source);

    const bindSync = syncs.find((s) => s.name === 'BindContractsOnResolve');
    expect(bindSync).toBeDefined();
    expect(bindSync!.annotations).toContain('eager');
  });

  it('widget variable bound in when is forwarded to then via variable reference', () => {
    const source = readFileSync(SYNC_PATH, 'utf-8');
    const syncs = parseSyncFile(source);

    const bindSync = syncs.find((s) => s.name === 'BindContractsOnResolve');
    expect(bindSync).toBeDefined();

    const thenClauses = bindSync!.then;
    const lensInvocation = thenClauses.find(
      (t) =>
        (t.concept === 'SurfaceLens' || t.concept === 'urn:clef/SurfaceLens') &&
        t.action === 'resolve',
    );
    expect(lensInvocation).toBeDefined();

    // In the sync AST, then-clause inputs are called 'fields'
    const widgetArg = (lensInvocation as any).fields.find((i: any) => i.name === 'widget');
    expect(widgetArg).toBeDefined();
    // Must reference the bound variable from when, not a hardcoded literal
    expect(widgetArg!.value).toMatchObject({ type: 'variable', name: 'widget' });
  });

  it('context variable bound in when is forwarded to then', () => {
    const source = readFileSync(SYNC_PATH, 'utf-8');
    const syncs = parseSyncFile(source);

    const bindSync = syncs.find((s) => s.name === 'BindContractsOnResolve');
    const lensInvocation = bindSync!.then.find(
      (t) =>
        (t.concept === 'SurfaceLens' || t.concept === 'urn:clef/SurfaceLens') &&
        t.action === 'resolve',
    );

    const ctxArg = (lensInvocation as any).fields.find((i: any) => i.name === 'context');
    expect(ctxArg).toBeDefined();
    expect(ctxArg!.value).toMatchObject({ type: 'variable', name: 'ctx' });
  });

  it('sync has a purpose clause', () => {
    const source = readFileSync(SYNC_PATH, 'utf-8');
    const syncs = parseSyncFile(source);

    const bindSync = syncs.find((s) => s.name === 'BindContractsOnResolve');
    expect(bindSync).toBeDefined();
    expect((bindSync as any).purpose).toBeDefined();
    expect((bindSync as any).purpose.length).toBeGreaterThan(0);
  });
});
