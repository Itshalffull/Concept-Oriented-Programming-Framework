// ============================================================
// MAG-912 / INV-8 — Unit tests for the `scenario` invariant kind.
//
// Tests drive the shared InvariantBodyParser through the concept
// parser's public entry point (parseConceptFile), which is the
// same path the production grammar uses. Each test embeds a
// scenario invariant inside a minimal concept and asserts the
// parsed InvariantDecl shape.
// ============================================================

import { describe, it, expect } from 'vitest';
import { parseConceptFile } from '../../handlers/ts/framework/parser.js';
import type { InvariantDecl } from '../../runtime/types.js';

function parseScenarios(body: string): InvariantDecl[] {
  const source = `concept Scenario [S] {
  purpose { Test. }
  state { things: set S }
  actions {
    action noop() { -> ok() { Doc. } }
  }
  invariant {
${body}
  }
}`;
  const ast = parseConceptFile(source);
  return ast.invariants;
}

describe('InvariantBodyParser — scenario kind', () => {
  it('parses a minimal scenario with only a then block', () => {
    const invs = parseScenarios(`
    scenario "minimal" {
      then {
        a.x = 1
      }
    }
`);
    expect(invs).toHaveLength(1);
    const inv = invs[0];
    expect(inv.kind).toBe('scenario');
    expect(inv.name).toBe('minimal');
    expect(inv.fixtures).toEqual([]);
    expect(inv.givenSteps).toEqual([]);
    expect(inv.whenSteps).toEqual([]);
    expect(inv.thenSteps).toHaveLength(1);
    expect(inv.thenSteps?.[0].kind).toBe('assertion');
    expect(inv.settlement).toBeUndefined();
  });

  it('parses multiple fixtures with fields', () => {
    const invs = parseScenarios(`
    scenario "two fixtures" {
      fixture blockA { blockId: "A", depth: 0 }
      fixture blockB { blockId: "B", depth: 1 }
      then {
        a.x = 1
      }
    }
`);
    expect(invs).toHaveLength(1);
    const inv = invs[0];
    expect(inv.kind).toBe('scenario');
    expect(inv.fixtures).toHaveLength(2);
    expect(inv.fixtures?.[0].id).toBe('blockA');
    expect(inv.fixtures?.[0].fields.map((f) => f.name)).toEqual(['blockId', 'depth']);
    expect(inv.fixtures?.[1].id).toBe('blockB');
    expect(inv.fixtures?.[1].fields).toHaveLength(2);
  });

  it('parses given/when/then phases with multiple steps', () => {
    const invs = parseScenarios(`
    scenario "gwt" {
      given {
        a.x = 0
      }
      when {
        noop() -> ok
      }
      then {
        a.x = 1
        and a.y = 2
      }
    }
`);
    const inv = invs[0];
    expect(inv.kind).toBe('scenario');
    expect(inv.givenSteps).toHaveLength(1);
    expect(inv.whenSteps).toHaveLength(1);
    expect(inv.whenSteps?.[0].kind).toBe('action');
    expect(inv.thenSteps).toHaveLength(2);
  });

  it('parses settlement: sync', () => {
    const invs = parseScenarios(`
    scenario "sync settle" {
      then { a.x = 1 }
      settlement: sync
    }
`);
    expect(invs[0].settlement).toEqual({ mode: 'sync' });
  });

  it('parses settlement: async-eventually with timeoutMs', () => {
    const invs = parseScenarios(`
    scenario "eventually" {
      then { a.x = 1 }
      settlement: "async-eventually" { timeoutMs: 5000 }
    }
`);
    expect(invs[0].settlement).toEqual({ mode: 'async-eventually', timeoutMs: 5000 });
  });

  it('parses settlement: async-with-anchor', () => {
    const invs = parseScenarios(`
    scenario "anchor" {
      then { a.x = 1 }
      settlement: "async-with-anchor" { anchor: "Task/completed" }
    }
`);
    expect(invs[0].settlement).toEqual({
      mode: 'async-with-anchor',
      anchor: 'Task/completed',
    });
  });

  it('falls back to empty scenario when `then` block is missing (concept grammar is lenient)', () => {
    // The concept parser has withFallback=true, so a missing `then`
    // should not crash the whole parse; it should yield an empty
    // scenario InvariantDecl. This guards against grammar failures
    // corrupting the surrounding concept.
    const invs = parseScenarios(`
    scenario "missing then" {
      given { a.x = 0 }
    }
`);
    expect(invs).toHaveLength(1);
    expect(invs[0].kind).toBe('scenario');
    // Fallback produces empty arrays, not a populated then list.
    expect(invs[0].thenSteps).toEqual([]);
  });
});
