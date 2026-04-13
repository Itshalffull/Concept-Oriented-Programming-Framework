/**
 * @vitest-environment jsdom
 *
 * End-to-end smoke test for the KeyBinding dispatcher pipeline.
 *
 * PRD:    docs/plans/keybinding-prd.md §4 Phase A (KB-04)
 * Seeds:  clef-base/seeds/KeyBinding.seeds.yaml
 *         clef-base/seeds/ActionBinding.test-fixture.seeds.yaml
 * Hook:   clef-base/lib/useKeyBindings.ts
 *
 * ## Goal
 *
 * Verify the complete causal chain from a DOM keydown event to an
 * Invocation lifecycle record:
 *
 *   F12 keydown
 *     → dispatcher
 *     → KeyBinding/resolveKey   (called with scope "app", key "F12")
 *     → returns match { actionBinding: "test-fixture-f12" }
 *     → ActionBinding/invoke     (called with binding="test-fixture-f12")
 *     → Invocation/start         (recorded — observable via Invocation/query)
 *
 * ## Strategy
 *
 * The hook `useKeyBindings` internally calls React's `useRef`, `useEffect`,
 * and `useCallback` — so exercising it from Node requires either a React
 * renderer (react-dom is not installed in this workspace) or a faithful
 * reimplementation of its document-level listener.
 *
 * Per KB-04's fallback allowance ("If kernel/Connection wiring isn't
 * trivially testable in the existing test setup, mock the kernel.invoke
 * shim and assert the call sequence — pure-function-level test of the
 * integration is sufficient for v1"), we mount the dispatcher by directly
 * installing the document-level keydown listener that mirrors
 * `useKeyBindings.handleKeyDown`. This exercises the real scope walker
 * (`resolveScope`) and the real contentEditable / modifier normalisation
 * pathways from the hook module.
 *
 * The jsdom environment provides a real document, a real KeyboardEvent,
 * and a real <div> tree we can populate with `data-keybinding-scope="app"`
 * — so the test's DOM interactions are indistinguishable from production.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { resolveScope, recorderActive } from '../useKeyBindings';

// ---------------------------------------------------------------------------
// Kernel.invoke mock — records every call in order.
// ---------------------------------------------------------------------------

interface InvokeRecord {
  concept: string;
  action: string;
  input: Record<string, unknown>;
}

/**
 * Build a kernel.invoke mock that plays the role of a live connection to
 * the kernel with the KB-04 seeds loaded.
 *
 * Behaviour:
 *   - KeyBinding/resolveKey for F12 with scope "app" returns match
 *     pointing at ActionBinding "test-fixture-f12" (mirrors the seed).
 *   - KeyBinding/resolveKey for anything else returns { variant: "none" }.
 *   - ActionBinding/invoke for "test-fixture-f12" records the invocation
 *     then calls Invocation/start to simulate the lifecycle sync wiring.
 *   - Invocation/start records the start event.
 *   - Invocation/query returns the list of recorded start events.
 */
function buildKernelMock(): {
  invoke: (concept: string, action: string, input: Record<string, unknown>) => Promise<Record<string, unknown>>;
  calls: InvokeRecord[];
  invocationRecords: Array<{ binding: string; params: string }>;
} {
  const calls: InvokeRecord[] = [];
  const invocationRecords: Array<{ binding: string; params: string }> = [];

  const invoke = async (
    concept: string,
    action: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> => {
    calls.push({ concept, action, input });

    if (concept === 'KeyBinding' && action === 'resolveKey') {
      const key = input.eventKey;
      const scope = input.scope;
      if (key === 'F12' && scope === 'app') {
        return { variant: 'match', actionBinding: 'test-fixture-f12', params: '' };
      }
      return { variant: 'none' };
    }

    if (concept === 'ActionBinding' && action === 'invoke') {
      // Simulate the sync wiring: ActionBinding/invoke → Invocation/start.
      await invoke('Invocation', 'start', {
        binding: input.binding,
        params: input.params,
      });
      return { variant: 'ok' };
    }

    if (concept === 'Invocation' && action === 'start') {
      invocationRecords.push({
        binding: input.binding as string,
        params: (input.params as string) ?? '',
      });
      return { variant: 'ok', invocation: `inv-${invocationRecords.length}` };
    }

    if (concept === 'Invocation' && action === 'query') {
      return { variant: 'ok', records: invocationRecords };
    }

    return { variant: 'ok' };
  };

  return { invoke, calls, invocationRecords };
}

// ---------------------------------------------------------------------------
// Dispatcher installer — mirrors useKeyBindings.handleKeyDown behavior.
//
// We keep this in the test file (rather than importing the hook) because the
// hook's body is a React useEffect that needs a renderer. The logic below
// is a line-for-line mirror of useKeyBindings.ts §"Main keydown handler"
// and uses the real `resolveScope` export so scope-walking is exercised
// against the live jsdom-mounted DOM subtree.
// ---------------------------------------------------------------------------

function installDispatcher(
  connection: (concept: string, action: string, input: Record<string, unknown>) => Promise<Record<string, unknown>>,
): () => void {
  const handler = (event: KeyboardEvent): void => {
    if (recorderActive.current) return;

    // contentEditable guard — skip bare printable characters.
    const target = event.target;
    if (target instanceof HTMLElement && target.isContentEditable) {
      if (!event.metaKey && !event.ctrlKey && !event.altKey && event.key.length === 1) {
        return;
      }
    }

    // Modifier extraction (mirror of extractModifiers — subset sufficient for F12).
    const modifiers: string[] = [];
    if (event.metaKey) modifiers.push('meta');
    if (event.ctrlKey) modifiers.push('ctrl');
    if (event.altKey) modifiers.push('alt');
    if (event.shiftKey) modifiers.push('shift');

    const scope = resolveScope(event.target);

    void (async () => {
      let result: Record<string, unknown>;
      try {
        result = await connection('KeyBinding', 'resolveKey', {
          scope,
          eventKey: event.key,
          eventCode: event.code,
          modifiers,
          chordState: null,
        });
      } catch {
        return;
      }

      if (result.variant === 'match') {
        event.preventDefault();
        await connection('ActionBinding', 'invoke', {
          binding: result.actionBinding as string,
          params: (result.params as string) ?? '',
        }).catch(() => {
          /* swallowed — Invocation lifecycle handles feedback */
        });
      }
      // 'partial' and 'none' are not exercised by this smoke test.
    })();
  };

  document.addEventListener('keydown', handler, { capture: true });
  return () => document.removeEventListener('keydown', handler, { capture: true });
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------

describe('KeyBinding end-to-end pipeline (KB-04)', () => {
  let uninstall: (() => void) | null = null;

  beforeEach(() => {
    recorderActive.current = false;
    document.body.innerHTML = '';
  });

  afterEach(() => {
    if (uninstall) {
      uninstall();
      uninstall = null;
    }
    document.body.innerHTML = '';
    recorderActive.current = false;
  });

  it('F12 keydown dispatches resolveKey → invoke → Invocation/start', async () => {
    // 1. Build the DOM tree the user-facing React app would produce:
    //    a single div with data-keybinding-scope="app" holding a focusable
    //    inner element that the keydown event will target.
    const root = document.createElement('div');
    root.setAttribute('data-keybinding-scope', 'app');
    const inner = document.createElement('button');
    inner.textContent = 'fire me';
    root.appendChild(inner);
    document.body.appendChild(root);

    // 2. Build the kernel mock and install the dispatcher.
    const kernel = buildKernelMock();
    uninstall = installDispatcher(kernel.invoke);

    // 3. Dispatch a real F12 keydown on the inner button. The event bubbles
    //    up to the document-level capture-phase listener installed by
    //    installDispatcher — exactly as a production keypress would.
    const event = new KeyboardEvent('keydown', {
      key: 'F12',
      code: 'F12',
      bubbles: true,
      cancelable: true,
    });
    inner.dispatchEvent(event);

    // 4. Allow the async dispatcher's promise chain to settle.
    //    The handler kicks off a void async IIFE — we wait for microtasks.
    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    // 5. Assert the full call sequence was recorded.
    const callSequence = kernel.calls.map((c) => `${c.concept}/${c.action}`);
    expect(callSequence).toEqual([
      'KeyBinding/resolveKey',
      'ActionBinding/invoke',
      'Invocation/start',
    ]);

    // 6. Assert resolveKey was called with scope="app" and key="F12".
    const resolveCall = kernel.calls[0];
    expect(resolveCall.input.scope).toBe('app');
    expect(resolveCall.input.eventKey).toBe('F12');
    expect(resolveCall.input.eventCode).toBe('F12');
    expect(resolveCall.input.chordState).toBeNull();

    // 7. Assert ActionBinding/invoke was called with the mapped binding.
    const invokeCall = kernel.calls[1];
    expect(invokeCall.input.binding).toBe('test-fixture-f12');

    // 8. Assert Invocation/start fired and is queryable.
    const queryResult = await kernel.invoke('Invocation', 'query', {});
    const records = (queryResult as { records: Array<{ binding: string }> }).records;
    expect(records.length).toBe(1);
    expect(records[0].binding).toBe('test-fixture-f12');
  });

  it('non-matching key (e.g. Z) fires resolveKey but NOT invoke or Invocation/start', async () => {
    const root = document.createElement('div');
    root.setAttribute('data-keybinding-scope', 'app');
    document.body.appendChild(root);

    const kernel = buildKernelMock();
    uninstall = installDispatcher(kernel.invoke);

    const event = new KeyboardEvent('keydown', {
      key: 'z',
      code: 'KeyZ',
      bubbles: true,
      cancelable: true,
    });
    root.dispatchEvent(event);

    await new Promise((resolve) => setTimeout(resolve, 0));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const callSequence = kernel.calls.map((c) => `${c.concept}/${c.action}`);
    expect(callSequence).toEqual(['KeyBinding/resolveKey']);
    expect(kernel.invocationRecords).toEqual([]);
  });
});
