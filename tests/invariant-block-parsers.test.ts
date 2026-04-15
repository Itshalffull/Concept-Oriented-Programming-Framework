/**
 * MAG-911 / INV-7 — Invariant Block Parser Portability
 *
 * Verifies that the .view, .sync, and .derived parsers each accept a
 * top-level `invariant { ... }` block by delegating to the shared
 * InvariantBodyParser. One happy-path test per parser; deeper grammar
 * coverage lives in the shared parser's own tests and in the concept /
 * widget parser invariant test suites.
 *
 * See: handlers/ts/framework/invariant-body-parser.ts
 *      docs/plans/invariant-grammar-portability-prd.md
 */

import { describe, it, expect } from 'vitest';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser.js';
import { parseDerivedFile } from '../handlers/ts/framework/derived-parser.js';
import { parseViewFile } from '../handlers/ts/framework/view-spec-parser.js';

describe('MAG-911 — invariant block portability', () => {
  it('sync-parser accepts an invariant block on a sync', () => {
    const source = `
sync OrderConfirmed
  purpose: "Send confirmation"
when {
  Order/place: [ id: ?id ] => ok(order: ?o)
}
then {
  Notification/send: [ to: ?o; subject: "Confirmed" ]
}
invariant {
  always "every placed order eventually notifies" {
    after Order/place(id: ?x)
    then exists Notification/send(to: ?x)
  }
}
`;
    const syncs = parseSyncFile(source);
    expect(syncs).toHaveLength(1);
    expect(syncs[0].name).toBe('OrderConfirmed');
    expect(syncs[0].invariants).toBeDefined();
    expect(syncs[0].invariants).toHaveLength(1);
    expect(syncs[0].invariants![0]).toMatchObject({
      kind: 'always',
      name: 'every placed order eventually notifies',
    });
  });

  it('derived-parser accepts an invariant block on a derived concept', () => {
    const source = `
derived Trash {
  purpose { soft-delete and restore }
  composes { Item }
  syncs {
    required: [ MoveToTrashOnDelete ]
  }
  invariant {
    always "trashed items can be restored" {
      after Item/delete(id: ?x)
      then exists Item/restore(id: ?x)
    }
  }
}
`;
    const ast = parseDerivedFile(source);
    expect(ast.name).toBe('Trash');
    expect(ast.invariants).toBeDefined();
    expect(ast.invariants).toHaveLength(1);
    expect(ast.invariants![0]).toMatchObject({
      kind: 'always',
      name: 'trashed items can be restored',
    });
  });

  it('view-spec-parser accepts a singular invariant block on a view', () => {
    const source = `
view "UserList" {
  shell: "SimpleListShell"
  purpose { list of users }
  invariant {
    always "results are non-empty after compile" {
      after compile
      then exists row
    }
  }
}
`;
    const spec = parseViewFile(source);
    expect(spec.name).toBe('UserList');
    // sanity
    expect(spec.shell).toBe('SimpleListShell');
    expect(spec.invariants).toHaveLength(1);
    expect(spec.invariants[0]).toMatchObject({
      kind: 'always',
      name: 'results are non-empty after compile',
    });
  });
});
