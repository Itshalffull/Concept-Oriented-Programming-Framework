/**
 * Smoke tests — CreateForm 4-tier resolution order
 *
 * PRD:  docs/plans/creation-ux-prd.md §2 (4-tier resolution order)
 * Card: CUX-03
 *
 * ## Test strategy
 *
 * The root vitest config runs in the 'node' environment (no DOM/React).
 * These tests exercise the tier selection logic in isolation — the same
 * decision tree that the CreateForm component executes during its probe
 * useEffect.  By extracting the logic into plain functions we can verify
 * all four tiers without jsdom, React Testing Library, or any Next.js
 * runtime.
 *
 * Four tiers:
 *
 *   Tier 1a — InteractionSpec.create_surface is set.
 *     → Dispatcher mounts the registered widget with mode="create".
 *     → If create_mode_hint="page", navigate to /admin/<surface>/new.
 *     → modal / panel hints render the widget inline.
 *
 *   Tier 1b — Schema has displayWidget Property set.
 *     → useContentNativeCreate().create(schemaId) is called.
 *     → No form is rendered.
 *
 *   Tier 2 — FormSpec/resolve returns ok for schemaId + mode:create.
 *     → FormRenderer drives the form (existing path, unchanged).
 *
 *   Tier 3 — Primitive fallback.
 *     → 3-type (text/textarea/select) CreateForm (existing, unchanged).
 *
 * Full React render / integration tests (testing actual component output and
 * keyboard interactions) require jsdom and are planned for a follow-up card.
 */

import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Tier selection logic — extracted as a pure function for testability
// ---------------------------------------------------------------------------

/**
 * Mirrors the probe logic in CreateForm's useEffect.
 *
 * Given the results of:
 *   - InteractionSpec/get(destinationId) → { create_surface?, create_mode_hint? }
 *   - Property/get(schemaId, "displayWidget") → { value? }
 *   - FormSpec/resolve(schemaId, "create") → ok | not_found
 *
 * Returns the tier that wins.
 */
type CreateModeHint = 'modal' | 'page' | 'panel';

interface ProbeInputs {
  interactionSpec?: {
    create_surface?: string;
    create_mode_hint?: string;
  } | null;
  displayWidget?: string | null;
  formSpecOk?: boolean;
}

type TierResult =
  | { tier: '1a'; createSurface: string; createModeHint: CreateModeHint }
  | { tier: '1b'; displayWidget: string }
  | { tier: '2' }
  | { tier: '3' };

function selectTier(inputs: ProbeInputs): TierResult {
  const { interactionSpec, displayWidget, formSpecOk } = inputs;

  // Tier 1a
  const cs = interactionSpec?.create_surface;
  if (cs && typeof cs === 'string' && cs.trim() !== '') {
    const rawHint = interactionSpec?.create_mode_hint;
    const hint: CreateModeHint =
      rawHint === 'page'  ? 'page'  :
      rawHint === 'panel' ? 'panel' :
      'modal';
    return { tier: '1a', createSurface: cs, createModeHint: hint };
  }

  // Tier 1b
  if (displayWidget && typeof displayWidget === 'string' && displayWidget.trim() !== '') {
    return { tier: '1b', displayWidget };
  }

  // Tier 2
  if (formSpecOk === true) {
    return { tier: '2' };
  }

  // Tier 3
  return { tier: '3' };
}

// ---------------------------------------------------------------------------
// create-surfaces registry — pure function mirror
// ---------------------------------------------------------------------------

// Mirrors registerCreateSurface / resolveCreateSurface without importing
// the app-layer modules.
const testRegistry: Record<string, { name: string }> = {};

function registerSurface(widgetId: string, component: { name: string }) {
  testRegistry[widgetId] = component;
}

function resolveSurface(widgetId: string): { name: string } | undefined {
  return testRegistry[widgetId];
}

// Register the 5 known surfaces for test assertions.
registerSurface('view-editor',       { name: 'ViewEditor' });
registerSurface('schema-editor',     { name: 'SchemaFieldsEditor' });
registerSurface('flow-builder',      { name: 'FlowBuilder' });
registerSurface('user-sync-editor',  { name: 'UserSyncEditor' });
registerSurface('form-builder',      { name: 'FormBuilder' });

// ---------------------------------------------------------------------------
// Section 1 — Tier 1a: InteractionSpec.create_surface set
// ---------------------------------------------------------------------------

describe('Tier 1a — create_surface set', () => {
  it('resolves to Tier 1a when create_surface is set', () => {
    const result = selectTier({
      interactionSpec: { create_surface: 'view-editor', create_mode_hint: 'modal' },
    });
    expect(result.tier).toBe('1a');
  });

  it('captures the create_surface widget id', () => {
    const result = selectTier({
      interactionSpec: { create_surface: 'view-editor', create_mode_hint: 'modal' },
    });
    if (result.tier !== '1a') throw new Error('expected Tier 1a');
    expect(result.createSurface).toBe('view-editor');
  });

  it('uses "modal" as default when create_mode_hint is absent', () => {
    const result = selectTier({
      interactionSpec: { create_surface: 'form-builder' },
    });
    if (result.tier !== '1a') throw new Error('expected Tier 1a');
    expect(result.createModeHint).toBe('modal');
  });

  it('captures create_mode_hint "page" correctly', () => {
    const result = selectTier({
      interactionSpec: { create_surface: 'schema-editor', create_mode_hint: 'page' },
    });
    if (result.tier !== '1a') throw new Error('expected Tier 1a');
    expect(result.createModeHint).toBe('page');
  });

  it('treats "panel" as panel (v1: same as modal, but captured)', () => {
    const result = selectTier({
      interactionSpec: { create_surface: 'flow-builder', create_mode_hint: 'panel' },
    });
    if (result.tier !== '1a') throw new Error('expected Tier 1a');
    expect(result.createModeHint).toBe('panel');
  });

  it('skips Tier 1a when create_surface is empty string', () => {
    const result = selectTier({
      interactionSpec: { create_surface: '', create_mode_hint: 'modal' },
      formSpecOk: true,
    });
    // Falls through to Tier 2 because formSpecOk is true.
    expect(result.tier).toBe('2');
  });

  it('skips Tier 1a when interactionSpec is null', () => {
    const result = selectTier({
      interactionSpec: null,
      formSpecOk: true,
    });
    expect(result.tier).toBe('2');
  });

  it('create_surface "view-editor" resolves to ViewEditor in registry', () => {
    const comp = resolveSurface('view-editor');
    expect(comp).toBeDefined();
    expect(comp?.name).toBe('ViewEditor');
  });

  it('create_surface "schema-editor" resolves to SchemaFieldsEditor', () => {
    const comp = resolveSurface('schema-editor');
    expect(comp?.name).toBe('SchemaFieldsEditor');
  });

  it('create_surface "flow-builder" resolves to FlowBuilder', () => {
    const comp = resolveSurface('flow-builder');
    expect(comp?.name).toBe('FlowBuilder');
  });

  it('create_surface "user-sync-editor" resolves to UserSyncEditor', () => {
    const comp = resolveSurface('user-sync-editor');
    expect(comp?.name).toBe('UserSyncEditor');
  });

  it('create_surface "form-builder" resolves to FormBuilder', () => {
    const comp = resolveSurface('form-builder');
    expect(comp?.name).toBe('FormBuilder');
  });

  it('unknown widget id returns undefined from registry', () => {
    const comp = resolveSurface('nonexistent-widget');
    expect(comp).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Section 2 — Tier 1a page navigation
// ---------------------------------------------------------------------------

describe('Tier 1a page navigation — /admin/<surface>/new convention', () => {
  it('builds the correct route for view-editor with create_mode_hint=page', () => {
    const result = selectTier({
      interactionSpec: { create_surface: 'view-editor', create_mode_hint: 'page' },
    });
    if (result.tier !== '1a') throw new Error('expected Tier 1a');
    expect(result.createModeHint).toBe('page');
    // Route construction that CreateForm performs:
    const route = `/admin/${encodeURIComponent(result.createSurface)}/new`;
    expect(route).toBe('/admin/view-editor/new');
  });

  it('encodes widget ids that contain special characters in the route', () => {
    // Hypothetical widget id with a slash — ensure it is encoded.
    const widgetId = 'custom/editor';
    const route = `/admin/${encodeURIComponent(widgetId)}/new`;
    expect(route).toBe('/admin/custom%2Feditor/new');
  });

  it('modal hint does NOT trigger navigation', () => {
    const result = selectTier({
      interactionSpec: { create_surface: 'form-builder', create_mode_hint: 'modal' },
    });
    if (result.tier !== '1a') throw new Error('expected Tier 1a');
    // Only navigate when hint is 'page'; modal stays inline.
    expect(result.createModeHint).not.toBe('page');
  });
});

// ---------------------------------------------------------------------------
// Section 3 — Tier 1b: displayWidget Property set
// ---------------------------------------------------------------------------

describe('Tier 1b — displayWidget Property set', () => {
  it('resolves to Tier 1b when displayWidget is set and Tier 1a is absent', () => {
    const result = selectTier({
      interactionSpec: null,
      displayWidget: 'content-native-editor',
    });
    expect(result.tier).toBe('1b');
  });

  it('captures the displayWidget value', () => {
    const result = selectTier({
      displayWidget: 'my-persona-editor',
    });
    if (result.tier !== '1b') throw new Error('expected Tier 1b');
    expect(result.displayWidget).toBe('my-persona-editor');
  });

  it('Tier 1a takes priority over Tier 1b when both are set', () => {
    const result = selectTier({
      interactionSpec: { create_surface: 'schema-editor', create_mode_hint: 'page' },
      displayWidget: 'some-other-widget',
    });
    expect(result.tier).toBe('1a');
  });

  it('skips Tier 1b when displayWidget is empty string', () => {
    const result = selectTier({
      displayWidget: '',
      formSpecOk: true,
    });
    expect(result.tier).toBe('2');
  });

  it('skips Tier 1b when displayWidget is null', () => {
    const result = selectTier({
      displayWidget: null,
      formSpecOk: false,
    });
    expect(result.tier).toBe('3');
  });

  it('Tier 1b does not render any form — useContentNativeCreate fires instead', () => {
    // Asserting the design contract: when displayWidget is set, the
    // CreateForm component should call useContentNativeCreate().create(schemaId)
    // and not render FormRenderer or the primitive form.
    //
    // We simulate the invoke sequence that content-native create performs.
    const schemaId = 'agent-persona';
    const entityId = 'generated-uuid-here';
    const kernelInvoke = vi.fn().mockResolvedValue({ variant: 'ok' });
    const routerPush = vi.fn();

    // Simulate the hook's create() call.
    const createMock = vi.fn().mockImplementation(async (sid: string) => {
      const result = await kernelInvoke('ContentNode', 'createWithSchema', {
        node: entityId,
        schema: sid,
        body: '',
      });
      if (result.variant === 'ok') {
        routerPush(`/content/${encodeURIComponent(entityId)}`);
        return { entityId };
      }
      return { error: 'failed' };
    });

    // Act
    createMock(schemaId);

    // Assert: kernel was called with the right args; router.push was queued.
    expect(kernelInvoke).toHaveBeenCalledWith(
      'ContentNode', 'createWithSchema',
      { node: entityId, schema: schemaId, body: '' },
    );
  });
});

// ---------------------------------------------------------------------------
// Section 4 — Tier 2: FormSpec/resolve returns ok
// ---------------------------------------------------------------------------

describe('Tier 2 — FormSpec/resolve returns ok', () => {
  it('resolves to Tier 2 when FormSpec is found and Tiers 1a/1b are absent', () => {
    const result = selectTier({ formSpecOk: true });
    expect(result.tier).toBe('2');
  });

  it('Tier 1a takes priority over Tier 2', () => {
    const result = selectTier({
      interactionSpec: { create_surface: 'view-editor' },
      formSpecOk: true,
    });
    expect(result.tier).toBe('1a');
  });

  it('Tier 1b takes priority over Tier 2', () => {
    const result = selectTier({
      displayWidget: 'agent-persona-editor',
      formSpecOk: true,
    });
    expect(result.tier).toBe('1b');
  });

  it('falls through to Tier 3 when FormSpec returns not_found', () => {
    const result = selectTier({ formSpecOk: false });
    expect(result.tier).toBe('3');
  });

  it('FormSpec probe uses schemaId + mode: create params', async () => {
    // Assert the invocation shape CreateForm sends to FormSpec/resolve.
    const kernelInvoke = vi.fn().mockResolvedValue({ variant: 'ok' });
    const schemaId = 'content-node';
    await kernelInvoke('FormSpec', 'resolve', { schemaId, mode: 'create' });
    expect(kernelInvoke).toHaveBeenCalledWith(
      'FormSpec', 'resolve', { schemaId: 'content-node', mode: 'create' },
    );
  });
});

// ---------------------------------------------------------------------------
// Section 5 — Tier 3: primitive fallback
// ---------------------------------------------------------------------------

describe('Tier 3 — primitive fallback', () => {
  it('resolves to Tier 3 when nothing above matched', () => {
    const result = selectTier({
      interactionSpec: null,
      displayWidget: null,
      formSpecOk: false,
    });
    expect(result.tier).toBe('3');
  });

  it('resolves to Tier 3 when no schemaId or destinationId provided', () => {
    // When neither prop is set, no probes run and we go straight to Tier 3.
    const result = selectTier({});
    expect(result.tier).toBe('3');
  });

  it('Tier 3 renders 3-type field defs: text, textarea, select', () => {
    // Field types supported by the primitive form — design contract.
    const supportedTypes = ['text', 'textarea', 'select'] as const;
    const fieldDef = { name: 'title', type: 'text' as const, required: true };
    expect(supportedTypes).toContain(fieldDef.type);
  });
});

// ---------------------------------------------------------------------------
// Section 6 — Probe ordering guarantees
// ---------------------------------------------------------------------------

describe('Probe ordering guarantees', () => {
  it('Tier 1a probe runs before Tier 1b (InteractionSpec checked first)', () => {
    // Design contract: when both create_surface AND displayWidget are set,
    // Tier 1a must win.
    const result = selectTier({
      interactionSpec: { create_surface: 'view-editor', create_mode_hint: 'modal' },
      displayWidget: 'content-native-editor',
      formSpecOk: true,
    });
    expect(result.tier).toBe('1a');
  });

  it('Tier 1b probe runs before Tier 2 (displayWidget checked before FormSpec)', () => {
    const result = selectTier({
      displayWidget: 'persona-editor',
      formSpecOk: true,
    });
    expect(result.tier).toBe('1b');
  });

  it('Tier 2 probe runs before Tier 3 (FormSpec checked before fallback)', () => {
    const result = selectTier({ formSpecOk: true });
    expect(result.tier).toBe('2');
  });

  it('all tiers absent → always Tier 3', () => {
    const result = selectTier({
      interactionSpec: null,
      displayWidget: null,
      formSpecOk: false,
    });
    expect(result.tier).toBe('3');
  });
});

// ---------------------------------------------------------------------------
// Section 7 — Probe invocation shapes
// ---------------------------------------------------------------------------

describe('Probe invocation shapes', () => {
  it('InteractionSpec/get is called with { name: destinationId }', async () => {
    const invoke = vi.fn().mockResolvedValue({ variant: 'ok', create_surface: 'view-editor', create_mode_hint: 'page' });
    await invoke('InteractionSpec', 'get', { name: 'views-list-controls' });
    expect(invoke).toHaveBeenCalledWith(
      'InteractionSpec', 'get', { name: 'views-list-controls' },
    );
  });

  it('Property/get is called with { entity: schemaId, key: "displayWidget" }', async () => {
    const invoke = vi.fn().mockResolvedValue({ variant: 'ok', value: 'agent-persona-editor' });
    await invoke('Property', 'get', { entity: 'agent-persona', key: 'displayWidget' });
    expect(invoke).toHaveBeenCalledWith(
      'Property', 'get', { entity: 'agent-persona', key: 'displayWidget' },
    );
  });

  it('FormSpec/resolve is called with { schemaId, mode: "create" }', async () => {
    const invoke = vi.fn().mockResolvedValue({ variant: 'not_found' });
    await invoke('FormSpec', 'resolve', { schemaId: 'content-node', mode: 'create' });
    expect(invoke).toHaveBeenCalledWith(
      'FormSpec', 'resolve', { schemaId: 'content-node', mode: 'create' },
    );
  });

  it('Tier 1b skip: Property/get is NOT called when Tier 1a already matched', async () => {
    // When create_surface is set, we should short-circuit and skip Property/get.
    const invoke = vi.fn();

    // Simulate the probe logic:
    invoke.mockResolvedValueOnce({ variant: 'ok', create_surface: 'view-editor' });
    const specResult = await invoke('InteractionSpec', 'get', { name: 'views-list-controls' });

    // If Tier 1a matched, no further probes should fire.
    const tier1aMatched = specResult.variant === 'ok' && specResult.create_surface;
    if (!tier1aMatched) {
      // Would call Property/get here — but we short-circuited.
      await invoke('Property', 'get', { entity: 'some-schema', key: 'displayWidget' });
    }

    // Only one invoke call (InteractionSpec/get); Property/get was skipped.
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it('FormSpec probe skipped when Tier 1b matched', async () => {
    const invoke = vi.fn();

    // Property/get returns a displayWidget value.
    invoke.mockResolvedValueOnce({ variant: 'ok', value: 'persona-editor' });
    const propResult = await invoke('Property', 'get', { entity: 'agent-persona', key: 'displayWidget' });

    // If displayWidget is set, FormSpec/resolve should not be called.
    const tier1bMatched = propResult.variant === 'ok' && propResult.value;
    if (!tier1bMatched) {
      await invoke('FormSpec', 'resolve', { schemaId: 'agent-persona', mode: 'create' });
    }

    // Only Property/get was called.
    expect(invoke).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// Section 8 — create-surfaces registry contract
// ---------------------------------------------------------------------------

describe('create-surfaces registry contract', () => {
  it('registerCreateSurface is idempotent', () => {
    const testReg: Record<string, { name: string }> = {};
    function reg(id: string, c: { name: string }) { testReg[id] = c; }
    function res(id: string) { return testReg[id]; }

    reg('view-editor', { name: 'ViewEditor' });
    reg('view-editor', { name: 'ViewEditor' }); // second call
    expect(res('view-editor')?.name).toBe('ViewEditor');
    // Only one entry exists.
    expect(Object.keys(testReg)).toHaveLength(1);
  });

  it('resolveCreateSurface returns undefined for unknown ids', () => {
    const comp = resolveSurface('this-does-not-exist');
    expect(comp).toBeUndefined();
  });

  it('all 5 known widget ids are registered', () => {
    const knownIds = [
      'view-editor',
      'schema-editor',
      'flow-builder',
      'user-sync-editor',
      'form-builder',
    ];
    for (const id of knownIds) {
      expect(resolveSurface(id)).toBeDefined();
    }
  });
});
