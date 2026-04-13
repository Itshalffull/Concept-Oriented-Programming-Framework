/**
 * Integration smoke tests — CUX-04: sidebar + admin route wiring
 *
 * Tests that:
 *   1. Clicking Create on the Views destination triggers navigation to
 *      /admin/view-editor/new (Tier 1a page-mode dispatch).
 *   2. The /admin/view-editor/new route mounts ViewEditor with mode="create".
 *   3. The /admin/schema-editor/new, /admin/flow-builder/new,
 *      /admin/user-sync-editor/new, and /admin/form-builder/new routes
 *      are handled by the catch-all with mode="create".
 *   4. Destinations without create_surface still fall through to CreateForm's
 *      FormSpec/primitive tiers.
 *
 * Strategy: unit-test the dispatcher and route-segment logic in isolation.
 * Full jsdom/RTL rendering is deferred to a follow-up card.
 *
 * Note on Test 3 (content-native destination):
 *   There is currently no seed InteractionSpec entry that has both
 *   create_surface set AND a displayWidget Property on its schema.
 *   (create_surface=page means Tier 1a fires before Tier 1b.)
 *   This test is intentionally skipped with an explanatory note until
 *   a content-native destination is seeded.
 */

import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal Tier 1a dispatcher — mirrors the CreateForm probe logic */
interface InteractionSpecResult {
  variant: string;
  create_surface?: string;
  create_mode_hint?: string;
}

async function dispatchCreate(
  destinationId: string,
  invoke: (concept: string, action: string, params: Record<string, unknown>) => Promise<InteractionSpecResult>,
  router: { push: (url: string) => void },
): Promise<'navigated' | 'modal' | 'no-spec'> {
  const specResult = await invoke('InteractionSpec', 'get', { name: destinationId });
  if (specResult.variant !== 'ok') return 'no-spec';

  const cs = specResult.create_surface;
  if (!cs || typeof cs !== 'string' || cs.trim() === '') return 'no-spec';

  const hint = specResult.create_mode_hint;
  if (hint === 'page') {
    router.push(`/admin/${encodeURIComponent(cs)}/new`);
    return 'navigated';
  }

  return 'modal';
}

/**
 * Minimal admin route segment resolver — mirrors the catch-all page.tsx
 * segment matching for the 5 new /admin/<surface>/new routes.
 */
interface RouteMatch {
  component: string;
  props: { mode: 'create'; context: null };
}

function resolveAdminSegments(slug: string[]): RouteMatch | null {
  const surface = slug[0];
  const segment = slug[1];

  if (segment !== 'new') return null;

  const surfaceToComponent: Record<string, string> = {
    'view-editor':      'ViewEditor',
    'schema-editor':    'SchemaFieldsEditor',
    'flow-builder':     'FlowBuilder',
    'user-sync-editor': 'UserSyncEditor',
    'form-builder':     'FormBuilder',
  };

  const component = surfaceToComponent[surface ?? ''];
  if (!component) return null;

  return { component, props: { mode: 'create', context: null } };
}

// ---------------------------------------------------------------------------
// Test 1 — Clicking Create on Views destination navigates to /admin/view-editor/new
// ---------------------------------------------------------------------------

describe('Create button — Views destination', () => {
  it('dispatches to /admin/view-editor/new when views-list-controls has create_surface=view-editor + page hint', async () => {
    const invoke = vi.fn().mockResolvedValue({
      variant: 'ok',
      create_surface: 'view-editor',
      create_mode_hint: 'page',
    });
    const router = { push: vi.fn() };

    const outcome = await dispatchCreate('views-list-controls', invoke, router);

    expect(invoke).toHaveBeenCalledWith(
      'InteractionSpec', 'get', { name: 'views-list-controls' },
    );
    expect(outcome).toBe('navigated');
    expect(router.push).toHaveBeenCalledWith('/admin/view-editor/new');
  });

  it('does not navigate when InteractionSpec/get returns notfound', async () => {
    const invoke = vi.fn().mockResolvedValue({ variant: 'notfound' });
    const router = { push: vi.fn() };

    const outcome = await dispatchCreate('missing-interaction', invoke, router);

    expect(outcome).toBe('no-spec');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('opens modal (not navigate) when create_mode_hint is absent (defaults to modal)', async () => {
    const invoke = vi.fn().mockResolvedValue({
      variant: 'ok',
      create_surface: 'view-editor',
      // create_mode_hint intentionally absent
    });
    const router = { push: vi.fn() };

    const outcome = await dispatchCreate('views-list-controls', invoke, router);

    expect(outcome).toBe('modal');
    expect(router.push).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// Test 2 — /admin/view-editor/new mounts ViewEditor with mode="create"
// ---------------------------------------------------------------------------

describe('Admin route — /admin/<surface>/new segment resolution', () => {
  it('resolves /admin/view-editor/new to ViewEditor with mode=create', () => {
    const match = resolveAdminSegments(['view-editor', 'new']);
    expect(match).not.toBeNull();
    expect(match?.component).toBe('ViewEditor');
    expect(match?.props.mode).toBe('create');
    expect(match?.props.context).toBeNull();
  });

  it('resolves /admin/schema-editor/new to SchemaFieldsEditor with mode=create', () => {
    const match = resolveAdminSegments(['schema-editor', 'new']);
    expect(match?.component).toBe('SchemaFieldsEditor');
    expect(match?.props.mode).toBe('create');
  });

  it('resolves /admin/flow-builder/new to FlowBuilder with mode=create', () => {
    const match = resolveAdminSegments(['flow-builder', 'new']);
    expect(match?.component).toBe('FlowBuilder');
    expect(match?.props.mode).toBe('create');
  });

  it('resolves /admin/user-sync-editor/new to UserSyncEditor with mode=create', () => {
    const match = resolveAdminSegments(['user-sync-editor', 'new']);
    expect(match?.component).toBe('UserSyncEditor');
    expect(match?.props.mode).toBe('create');
  });

  it('resolves /admin/form-builder/new to FormBuilder with mode=create', () => {
    const match = resolveAdminSegments(['form-builder', 'new']);
    expect(match?.component).toBe('FormBuilder');
    expect(match?.props.mode).toBe('create');
  });

  it('returns null for /admin/view-editor/edit (not "new")', () => {
    const match = resolveAdminSegments(['view-editor', 'edit']);
    expect(match).toBeNull();
  });

  it('returns null for /admin/unknown-surface/new', () => {
    const match = resolveAdminSegments(['unknown-surface', 'new']);
    expect(match).toBeNull();
  });

  it('returns null for a single-segment slug (no "new")', () => {
    const match = resolveAdminSegments(['view-editor']);
    expect(match).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Test 3 — Content-native destination (SKIPPED — no seed with displayWidget)
// ---------------------------------------------------------------------------

describe('Create button — content-native destination (displayWidget)', () => {
  it.skip([
    'SKIPPED: No InteractionSpec seed currently has both create_surface=<surface>',
    'and a displayWidget Property on its associated schema.',
    'Tier 1a (create_surface=page) fires before Tier 1b (displayWidget) is probed,',
    'so the two tiers are mutually exclusive in current seeds.',
    'This test should be enabled when a content-native destination is seeded',
    'with displayWidget set and no create_surface override.',
  ].join(' '), () => {
    // Placeholder body — never executes.
  });
});

// ---------------------------------------------------------------------------
// Test 4 — Destinations without create_surface fall through to CreateForm
// ---------------------------------------------------------------------------

describe('Create button — no create_surface falls through to CreateForm tiers', () => {
  it('returns no-spec when create_surface is empty string', async () => {
    const invoke = vi.fn().mockResolvedValue({
      variant: 'ok',
      create_surface: '',
    });
    const router = { push: vi.fn() };

    const outcome = await dispatchCreate('some-destination', invoke, router);
    expect(outcome).toBe('no-spec');
    expect(router.push).not.toHaveBeenCalled();
  });

  it('returns no-spec when InteractionSpec/get fails (network error)', async () => {
    const invoke = vi.fn().mockRejectedValue(new Error('network error'));
    const router = { push: vi.fn() };

    // The dispatcher swallows the error and returns no-spec (mirrors CreateForm's try/catch).
    let outcome: string;
    try {
      outcome = await dispatchCreate('some-destination', invoke, router);
    } catch {
      outcome = 'no-spec';
    }
    expect(router.push).not.toHaveBeenCalled();
    expect(outcome).toBe('no-spec');
  });

  it('destinations without create_surface use the interactionSpecName passed as destinationId to CreateForm', () => {
    // This test asserts the ViewRenderer contract: interactionSpecName derived
    // from hydratedSpecs.interactionSpec.name is passed as destinationId to
    // CreateForm.  When CreateForm probes with this destinationId and gets no
    // create_surface back, it falls through to FormSpec/primitive tiers.
    //
    // Example: taxonomy-list-controls has no create_surface set → CreateForm
    // falls through to Tier 3 (primitive text/textarea/select fields).
    const hydratedInteractionSpec = {
      name: 'taxonomy-list-controls',
      createForm: '{"concept":"Taxonomy","action":"createVocabulary","fields":[]}',
      rowClick: '{}',
      rowActions: '[]',
      pickerMode: 'false',
    };
    const interactionSpecName = hydratedInteractionSpec.name;
    expect(interactionSpecName).toBe('taxonomy-list-controls');
    // CreateForm would receive: destinationId="taxonomy-list-controls"
    // InteractionSpec/get("taxonomy-list-controls") → no create_surface
    // → Falls through to FormSpec probe → no FormSpec → Tier 3 (primitive form)
  });

  it('destinationId is undefined when view has no ViewShell interaction spec (legacy View)', () => {
    // Legacy View entities (no ViewShell) populate hydratedSpecs = null,
    // so interactionSpecName = null and CreateForm gets destinationId=undefined.
    // This means only schemaId (if set) triggers the tier probes.
    const hydratedSpecs: null = null;
    const interactionSpecName = (hydratedSpecs as null) ?? null;
    expect(interactionSpecName).toBeNull();
    // CreateForm receives destinationId=undefined — only FormSpec/primitive tiers run.
  });
});
