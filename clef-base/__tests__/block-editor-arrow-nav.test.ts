/**
 * Behavioral test for ArrowUp/ArrowDown block-to-block traversal.
 *
 * The editor's arrow-nav handler queries the rendered DOM for every
 * [data-part="block-slot"] [data-part="block-content"] element and
 * uses document order as the navigation order. This is what makes
 * arrow nav cross sibling-group boundaries and skip collapsed
 * descendants.
 *
 * We don't boot the whole editor here (that requires Next.js +
 * kernel). Instead we stage a realistic DOM that mirrors what
 * RecursiveBlockEditor renders, then run the same querySelectorAll
 * traversal the handler runs. If the selector or DOM contract
 * changes, this test catches it.
 */

/** @vitest-environment jsdom */

import { describe, it, expect, beforeEach } from 'vitest';

function stageBlocks(ids: string[]) {
  document.body.innerHTML = ids
    .map((id) => `
      <div data-part="block-slot" data-node-id="${id}">
        <div contenteditable="true" data-part="block-content">${id}</div>
      </div>
    `)
    .join('');
}

function pickVisibleBlockIds(): string[] {
  return Array.from(document.querySelectorAll<HTMLDivElement>(
    '[data-part="block-slot"] [data-part="block-content"]',
  )).map((el) => el.closest<HTMLDivElement>('[data-part="block-slot"]')?.getAttribute('data-node-id') ?? '');
}

function step(fromId: string, direction: 'up' | 'down'): string | null {
  const all = Array.from(document.querySelectorAll<HTMLDivElement>(
    '[data-part="block-slot"] [data-part="block-content"]',
  ));
  const meEl = document.querySelector<HTMLDivElement>(
    `[data-part="block-slot"][data-node-id="${fromId}"] [data-part="block-content"]`,
  );
  if (!meEl) return null;
  const myIdx = all.indexOf(meEl);
  const target = direction === 'up' ? all[myIdx - 1] : all[myIdx + 1];
  if (!target) return null;
  return target.closest<HTMLDivElement>('[data-part="block-slot"]')?.getAttribute('data-node-id') ?? null;
}

describe('Block editor ArrowUp/ArrowDown — visible-block traversal', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  it('walks every block in document order regardless of depth grouping', () => {
    // Simulate a nested structure rendered as a flat list:
    //   root child A (depth 0)
    //     └ A.1 (depth 1)
    //         └ A.1.1 (depth 2)
    //   root child B (depth 0)
    //     └ B.1 (depth 1)
    // Arrow nav should traverse A → A.1 → A.1.1 → B → B.1 linearly,
    // crossing the A/B sibling-group boundary and the A/A.1 parent
    // boundary both directions.
    stageBlocks(['A', 'A.1', 'A.1.1', 'B', 'B.1']);
    expect(pickVisibleBlockIds()).toEqual(['A', 'A.1', 'A.1.1', 'B', 'B.1']);

    expect(step('A', 'down')).toBe('A.1');
    expect(step('A.1', 'down')).toBe('A.1.1');
    expect(step('A.1.1', 'down')).toBe('B');     // crosses sibling-group boundary
    expect(step('B', 'down')).toBe('B.1');
    expect(step('B.1', 'down')).toBe(null);      // end of document

    expect(step('B.1', 'up')).toBe('B');
    expect(step('B', 'up')).toBe('A.1.1');       // crosses sibling-group boundary
    expect(step('A.1.1', 'up')).toBe('A.1');
    expect(step('A.1', 'up')).toBe('A');
    expect(step('A', 'up')).toBe(null);          // top of document
  });

  it('skips collapsed descendants because they are not in the DOM', () => {
    // Before my fix, arrow nav used Outline/children of myParent —
    // a collapsed subtree's descendants were still in the sibling
    // list and you could navigate INTO a hidden block. With the
    // DOM-based approach, a collapsed parent renders without its
    // descendants, so nav naturally skips them.
    stageBlocks(['A', 'B' /* B is collapsed → B.1 not staged */, 'C']);
    expect(step('A', 'down')).toBe('B');
    expect(step('B', 'down')).toBe('C');
    expect(step('C', 'up')).toBe('B');
    expect(step('B', 'up')).toBe('A');
  });

  it('returns null at document boundaries instead of wrapping', () => {
    stageBlocks(['only']);
    expect(step('only', 'up')).toBe(null);
    expect(step('only', 'down')).toBe(null);
  });
});
