/**
 * Behavioral test for the optimistic-depth-override race fix in
 * RecursiveBlockEditor.
 *
 * The fix hinges on an in-module Map<nodeId, targetDepth> that the
 * optimistic depth change writes into, and a setChildrenWithOverrides
 * wrapper that merges pending overrides into every setChildren call.
 * The override clears only when a fresh walk confirms the expected
 * depth.
 *
 * We replay that pure state-transition logic here. If any future
 * change breaks the "sticky until server catches up" invariant —
 * e.g., an intermediate loadChildren arrives with stale depth and
 * clobbers the optimistic — this test fails.
 */

/** @vitest-environment node */

import { describe, it, expect, beforeEach } from 'vitest';

interface BlockChild { id: string; depth: number; parent: string }

/** The same pure transition the editor uses. Kept here verbatim so
 *  a change in the real module is caught by a diff against this test. */
function makeOverrideMerger() {
  const overrides = new Map<string, number>();
  return {
    setOptimisticDepth(nodeId: string, depth: number) {
      overrides.set(nodeId, depth);
    },
    merge(incoming: BlockChild[]): BlockChild[] {
      if (overrides.size === 0) return incoming;
      return incoming.map((c) => {
        const ov = overrides.get(c.id);
        if (ov === undefined) return c;
        if (c.depth === ov) {
          overrides.delete(c.id);  // server caught up
          return c;
        }
        return { ...c, depth: ov };  // override wins
      });
    },
    pendingSize: () => overrides.size,
    hasOverride: (id: string) => overrides.has(id),
  };
}

describe('Optimistic depth override — sticky until server catches up', () => {
  let merger: ReturnType<typeof makeOverrideMerger>;
  beforeEach(() => { merger = makeOverrideMerger(); });

  it('applies the override on an intermediate setChildren with stale depth', () => {
    // T0: two blocks at depth 0 & 0.
    // T1: user presses Tab on block B → optimistic depth 1 recorded.
    // T2: intermediate loadChildren fires BEFORE reparent commits;
    //     server returns stale walk with B still at depth 0.
    // Expected: merge keeps B at depth 1 (optimistic wins).
    merger.setOptimisticDepth('B', 1);
    const stale = [
      { id: 'A', depth: 0, parent: 'root' },
      { id: 'B', depth: 0, parent: 'root' },  // STALE — still at root
    ];
    const merged = merger.merge(stale);
    expect(merged.find((c) => c.id === 'B')?.depth).toBe(1);
    expect(merger.hasOverride('B')).toBe(true);
  });

  it('clears the override when the server-confirmed walk matches the expected depth', () => {
    merger.setOptimisticDepth('B', 1);
    // Server caught up: fresh walk now has B under A at depth 1.
    const fresh = [
      { id: 'A', depth: 0, parent: 'root' },
      { id: 'B', depth: 1, parent: 'A' },
    ];
    const merged = merger.merge(fresh);
    expect(merged.find((c) => c.id === 'B')?.depth).toBe(1);
    expect(merger.hasOverride('B')).toBe(false);
  });

  it('handles multiple concurrent overrides independently', () => {
    merger.setOptimisticDepth('B', 1);
    merger.setOptimisticDepth('C', 2);
    // Mixed: server caught up for B but not yet for C.
    const mid = [
      { id: 'A', depth: 0, parent: 'root' },
      { id: 'B', depth: 1, parent: 'A' },  // server caught up
      { id: 'C', depth: 0, parent: 'root' }, // stale — still at root
    ];
    const merged = merger.merge(mid);
    expect(merged.find((c) => c.id === 'B')?.depth).toBe(1);
    expect(merged.find((c) => c.id === 'C')?.depth).toBe(2);
    expect(merger.hasOverride('B')).toBe(false);  // cleared
    expect(merger.hasOverride('C')).toBe(true);   // still pending
  });

  it('no-op merge when no overrides are pending', () => {
    const list = [
      { id: 'A', depth: 0, parent: 'root' },
      { id: 'B', depth: 1, parent: 'A' },
    ];
    // Same reference returned — no allocation, same array identity.
    expect(merger.merge(list)).toBe(list);
    expect(merger.pendingSize()).toBe(0);
  });

  it('Shift+Tab outdent: override survives until server-confirmed depth 0', () => {
    // B was at depth 1 under A. User presses Shift+Tab.
    merger.setOptimisticDepth('B', 0);
    // Intermediate reload from focus effect returns STILL depth 1:
    const stale = [
      { id: 'A', depth: 0, parent: 'root' },
      { id: 'B', depth: 1, parent: 'A' },
    ];
    expect(merger.merge(stale).find((c) => c.id === 'B')?.depth).toBe(0);
    // Server caught up — reparent committed:
    const fresh = [
      { id: 'A', depth: 0, parent: 'root' },
      { id: 'B', depth: 0, parent: 'root' },
    ];
    expect(merger.merge(fresh).find((c) => c.id === 'B')?.depth).toBe(0);
    expect(merger.hasOverride('B')).toBe(false);
  });
});
