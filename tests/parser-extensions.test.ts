// ============================================================
// Parser Extension Tests
// Tests for enum types, invariant assertions, when guards,
// dot-access, spread, multi-line unions, and derived/sync
// parser improvements.
// ============================================================

import { describe, it, expect } from 'vitest';
import { parseConceptFile } from '../handlers/ts/framework/parser';
import { parseDerivedFile } from '../handlers/ts/framework/derived-parser';
import { parseSyncFile } from '../handlers/ts/framework/sync-parser';

// =====================
// Concept Parser Tests
// =====================

describe('Concept Parser — Enum Types', () => {
  it('parses brace enum type {A | B | C}', () => {
    const ast = parseConceptFile(`
concept Status [T] {
  state { status: T -> {active | paused | stopped} }
  actions {
    action setStatus(item: T, status: {active | paused | stopped}) {
      -> ok() { Set status. }
    }
  }
}`);
    expect(ast.state[0].type).toEqual({
      kind: 'relation',
      from: { kind: 'param', name: 'T' },
      to: { kind: 'enum', values: ['active', 'paused', 'stopped'] },
    });
    expect(ast.actions[0].params[1].type).toEqual({
      kind: 'enum', values: ['active', 'paused', 'stopped'],
    });
  });

  it('parses string literal union type "a" | "b" | "c"', () => {
    const ast = parseConceptFile(`
concept Config [T] {
  state { mode: T -> "fast" | "balanced" | "thorough" }
  actions {
    action configure(item: T) {
      -> ok() { Configure. }
    }
  }
}`);
    expect(ast.state[0].type).toEqual({
      kind: 'relation',
      from: { kind: 'param', name: 'T' },
      to: { kind: 'enum', values: ['fast', 'balanced', 'thorough'] },
    });
  });

  it('parses multi-line string literal unions', () => {
    const ast = parseConceptFile(`
concept Policy [T] {
  state {
    tier: T -> "free" | "pro" | "enterprise"
  }
  actions {
    action setTier(item: T) {
      -> ok() { Set tier. }
    }
  }
}`);
    expect(ast.state[0].type).toEqual({
      kind: 'relation',
      from: { kind: 'param', name: 'T' },
      to: { kind: 'enum', values: ['free', 'pro', 'enterprise'] },
    });
  });
});

describe('Concept Parser — Invariant Assertions', () => {
  it('parses property assertion in then clause', () => {
    const ast = parseConceptFile(`
concept Doc [D] {
  state { status: D -> String }
  actions {
    action complete(doc: D) {
      -> ok(doc: D) { Complete. }
    }
  }
  invariant {
    after complete(doc: d) -> ok(doc: d)
    then d.status = "complete"
  }
}`);
    const inv = ast.invariants[0];
    expect(inv.thenPatterns).toHaveLength(1);
    expect(inv.thenPatterns[0].kind).toBe('assertion');
    if (inv.thenPatterns[0].kind === 'assertion') {
      expect(inv.thenPatterns[0].left).toEqual({ type: 'dot_access', variable: 'd', field: 'status' });
      expect(inv.thenPatterns[0].operator).toBe('=');
      expect(inv.thenPatterns[0].right).toEqual({ type: 'literal', value: 'complete' });
    }
  });

  it('parses mixed action + assertion steps', () => {
    const ast = parseConceptFile(`
concept Counter [C] {
  state { count: C -> Int }
  actions {
    action increment(counter: C) {
      -> ok(counter: C) { Increment. }
    }
    action getCount(counter: C) {
      -> ok(value: Int) { Get count. }
    }
  }
  invariant {
    after increment(counter: c) -> ok(counter: c)
    then c.count > 0
    and getCount(counter: c) -> ok(value: v)
  }
}`);
    const inv = ast.invariants[0];
    expect(inv.thenPatterns).toHaveLength(2);
    expect(inv.thenPatterns[0].kind).toBe('assertion');
    expect(inv.thenPatterns[1].kind).toBe('action');
    if (inv.thenPatterns[0].kind === 'assertion') {
      expect(inv.thenPatterns[0].operator).toBe('>');
      expect(inv.thenPatterns[0].left).toEqual({ type: 'dot_access', variable: 'c', field: 'count' });
      expect(inv.thenPatterns[0].right).toEqual({ type: 'literal', value: 0 });
    }
    if (inv.thenPatterns[1].kind === 'action') {
      expect(inv.thenPatterns[1].actionName).toBe('getCount');
    }
  });

  it('parses "in" operator in assertions', () => {
    const ast = parseConceptFile(`
concept Tags [T] {
  state { tags: T -> set String }
  actions {
    action addTag(item: T, tag: String) {
      -> ok() { Add tag. }
    }
  }
  invariant {
    after addTag(item: x, tag: t) -> ok()
    then t in x.tags
  }
}`);
    const inv = ast.invariants[0];
    expect(inv.thenPatterns[0].kind).toBe('assertion');
    if (inv.thenPatterns[0].kind === 'assertion') {
      expect(inv.thenPatterns[0].operator).toBe('in');
      expect(inv.thenPatterns[0].left).toEqual({ type: 'variable', name: 't' });
      expect(inv.thenPatterns[0].right).toEqual({ type: 'dot_access', variable: 'x', field: 'tags' });
    }
  });
});

describe('Concept Parser — When Guards', () => {
  it('parses when clause on invariant', () => {
    const ast = parseConceptFile(`
concept Mutex [F] {
  state { exclusive: F -> set String }
  actions {
    action acquire(flag: F, name: String) {
      -> ok() { Acquire. }
      -> conflict() { Already held. }
    }
  }
  invariant {
    when f1.name in f2.mutually_exclusive_with
    after acquire(flag: f1, name: n1) -> ok()
    then acquire(flag: f2, name: n2) -> conflict()
  }
}`);
    const inv = ast.invariants[0];
    expect(inv.whenClause).toBeDefined();
    expect(inv.whenClause!.conditions).toHaveLength(1);
    expect(inv.whenClause!.conditions[0].operator).toBe('in');
  });
});

describe('Concept Parser — Spread and Dot-Access in Args', () => {
  it('parses spread operator in action args', () => {
    const ast = parseConceptFile(`
concept Audit [T] {
  state { log: set T }
  actions {
    action record(entry: T) {
      -> ok(id: T) { Record entry. }
    }
  }
  invariant {
    after record(entry: { type: "create", ... }) -> ok(id: r)
    then r != none
  }
}`);
    const afterArg = ast.invariants[0].afterPatterns[0].inputArgs[0];
    expect(afterArg.value.type).toBe('record');
    if (afterArg.value.type === 'record') {
      expect(afterArg.value.fields.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('parses dot-access in action args', () => {
    const ast = parseConceptFile(`
concept Chain [B] {
  state { blocks: set B }
  actions {
    action verify(block: B) {
      -> ok() { Verify. }
    }
  }
  invariant {
    after verify(block: b) -> ok()
    then b.hash != none
  }
}`);
    const assertion = ast.invariants[0].thenPatterns[0];
    expect(assertion.kind).toBe('assertion');
    if (assertion.kind === 'assertion') {
      expect(assertion.left).toEqual({ type: 'dot_access', variable: 'b', field: 'hash' });
      expect(assertion.operator).toBe('!=');
    }
  });
});

describe('Concept Parser — Unknown Sections', () => {
  it('gracefully skips unknown sections like types {}', () => {
    const ast = parseConceptFile(`
concept Typed [T] {
  types {
    record Foo { bar: String }
  }
  state { items: set T }
  actions {
    action add(item: T) {
      -> ok() { Add. }
    }
  }
}`);
    expect(ast.name).toBe('Typed');
    expect(ast.actions).toHaveLength(1);
    expect(ast.actions[0].name).toBe('add');
  });
});

describe('Concept Parser — Variant Without Parens', () => {
  it('handles variant without parens (-> ok { ... })', () => {
    const ast = parseConceptFile(`
concept Simple [T] {
  state { items: set T }
  actions {
    action doIt(item: T) {
      -> ok { Did it. }
      -> error { Failed. }
    }
  }
}`);
    expect(ast.actions[0].variants).toHaveLength(2);
    expect(ast.actions[0].variants[0].name).toBe('ok');
    expect(ast.actions[0].variants[0].params).toHaveLength(0);
    expect(ast.actions[0].variants[1].name).toBe('error');
  });
});

// =====================
// Derived Parser Tests
// =====================

describe('Derived Parser', () => {
  it('parses standard derived with matches + arrow queries', () => {
    const ast = parseDerivedFile(`
derived Trash [T] {
  purpose { Move items to a holding area before permanent deletion. }
  composes {
    Storage [T]
    Flag [T]
  }
  syncs {
    required: [ trash-delete, trash-restore ]
  }
  surface {
    action moveToTrash(item: T) {
      matches: Flag/set
    }
    query trashedItems() -> Storage/listFlagged(flag: "trashed")
  }
  principle {
    after moveToTrash(item: x)
    then trashedItems() includes x
  }
}`);
    expect(ast.name).toBe('Trash');
    expect(ast.composes).toHaveLength(2);
    expect(ast.syncs.required).toEqual(['trash-delete', 'trash-restore']);
    expect(ast.surface.actions).toHaveLength(1);
    expect(ast.surface.actions[0].matches.type).toBe('action');
    expect(ast.surface.queries).toHaveLength(1);
    expect(ast.surface.queries[0].target.concept).toBe('Storage');
    expect(ast.principle?.steps).toHaveLength(2);
  });

  it('parses entry/triggers surface action format', () => {
    const ast = parseDerivedFile(`
derived Verified [T] {
  composes { Schema [T]; Intent [T] }
  syncs { required: [ verify-intent ] }
  surface {
    action verify(target: String) {
      entry: Intent/verify matches on targetId: ?target
      triggers: [
        Schema/synthesize(target_symbol: ?target, intent_ref: ?intent),
        Run/start(properties: ?props, solver: "auto", timeout_ms: 30000)
      ]
    }
  }
}`);
    const action = ast.surface.actions[0];
    expect(action.name).toBe('verify');
    expect(action.matches.type).toBe('entry');
    if (action.matches.type === 'entry') {
      expect(action.matches.concept).toBe('Intent');
      expect(action.matches.action).toBe('verify');
    }
    expect(action.triggers).toHaveLength(2);
    expect(action.triggers![0].concept).toBe('Schema');
    expect(action.triggers![0].action).toBe('synthesize');
    expect(action.triggers![1].args['solver']).toBe('auto');
  });

  it('parses reads: query format', () => {
    const ast = parseDerivedFile(`
derived Dashboard [T] {
  composes { Signal [T] }
  syncs { required: [] }
  surface {
    query status(target: String) {
      reads: Signal/latest(target_symbol: ?target, dimension: "formal")
    }
  }
}`);
    const query = ast.surface.queries[0];
    expect(query.name).toBe('status');
    expect(query.target.concept).toBe('Signal');
    expect(query.target.action).toBe('latest');
    expect(query.target.args['dimension']).toBe('formal');
  });

  it('parses recommended syncs', () => {
    const ast = parseDerivedFile(`
derived Full [T] {
  composes { A [T]; B [T] }
  syncs {
    required: [ a-to-b ]
    recommended: [ b-enrichment, a-validation ]
  }
  surface {}
}`);
    expect(ast.syncs.required).toEqual(['a-to-b']);
    expect(ast.syncs.recommended).toEqual(['b-enrichment', 'a-validation']);
  });

  it('parses derivedContext match', () => {
    const ast = parseDerivedFile(`
derived Composed [T] {
  composes { derived Inner [T] }
  syncs { required: [] }
  surface {
    action compose(item: T) {
      matches: derivedContext "Inner/process"
    }
  }
}`);
    const action = ast.surface.actions[0];
    expect(action.matches.type).toBe('derivedContext');
    if (action.matches.type === 'derivedContext') {
      expect(action.matches.tag).toBe('Inner/process');
    }
  });
});

// =====================
// Sync Parser Tests
// =====================

describe('Sync Parser — Purpose Formats', () => {
  it('parses purpose: "string" format', () => {
    const syncs = parseSyncFile(`
sync Test [eager]
  purpose: "A test sync."
when {
  Foo/bar: [ x: ?x ] => [ ok ]
}
then {
  Baz/qux: [ y: ?x ]
}`);
    expect(syncs[0].purpose).toBe('A test sync.');
  });

  it('parses purpose { prose } format', () => {
    const syncs = parseSyncFile(`
sync Test [eager]
  purpose { Persist alias registrations as queryable content entities. }
when {
  Foo/bar: [ x: ?x ] => [ ok ]
}
then {
  Baz/qux: [ y: ?x ]
}`);
    expect(syncs[0].purpose).toContain('Persist alias registrations');
  });
});

describe('Sync Parser — Named Variant Outputs', () => {
  it('parses => ok(field: ?var) without brackets', () => {
    const syncs = parseSyncFile(`
sync Test [eager]
when {
  Foo/bar: [ x: ?x ]
    => ok(entity: ?e)
}
then {
  Baz/qux: [ y: ?e ]
}`);
    const output = syncs[0].when[0].outputFields;
    expect(output.some(f => f.name === 'variant' && f.match.type === 'literal' && f.match.value === 'ok')).toBe(true);
    expect(output.some(f => f.name === 'entity' && f.match.type === 'variable')).toBe(true);
  });

  it('parses => [ ok(field: ?var) ] with brackets', () => {
    const syncs = parseSyncFile(`
sync Test [eager]
when {
  Foo/bar: [ x: ?x ]
    => [ ok(result: ?r) ]
}
then {
  Baz/qux: [ y: ?r ]
}`);
    const output = syncs[0].when[0].outputFields;
    expect(output.some(f => f.name === 'variant' && f.match.type === 'literal' && f.match.value === 'ok')).toBe(true);
    expect(output.some(f => f.name === 'result' && f.match.type === 'variable')).toBe(true);
  });

  it('parses => [ ok ] bare variant', () => {
    const syncs = parseSyncFile(`
sync Test [eager]
when {
  Foo/bar: [ x: ?x ]
    => [ ok ]
}
then {
  Baz/qux: [ y: ?x ]
}`);
    const output = syncs[0].when[0].outputFields;
    expect(output).toHaveLength(1);
    expect(output[0].name).toBe('variant');
    expect(output[0].match).toEqual({ type: 'literal', value: 'ok' });
  });

  it('parses => ok() empty parens', () => {
    const syncs = parseSyncFile(`
sync Test [eager]
when {
  Foo/bar: [ x: ?x ]
    => ok()
}
then {
  Baz/qux: [ y: ?x ]
}`);
    const output = syncs[0].when[0].outputFields;
    expect(output).toHaveLength(1);
    expect(output[0].name).toBe('variant');
  });
});

describe('Sync Parser — Keyword as Field/Variable Names', () => {
  it('allows sync as field name in variant output', () => {
    const syncs = parseSyncFile(`
sync Test [eager]
when {
  SyncEntity/register: [ name: ?name; source: ?source ]
    => ok(sync: ?sync)
}
then {
  Save/store: [ data: ?sync ]
}`);
    expect(syncs[0].when[0].outputFields.some(
      f => f.name === 'sync' && f.match.type === 'variable',
    )).toBe(true);
  });

  it('allows keyword as variable name after ?', () => {
    const syncs = parseSyncFile(`
sync Test [eager]
when {
  Foo/bar: [ filter: ?filter; where: ?where ]
    => ok(then: ?then)
}
then {
  Baz/qux: [ a: ?filter; b: ?where; c: ?then ]
}`);
    expect(syncs).toHaveLength(1);
  });
});

describe('Sync Parser — Advanced Where Clause', () => {
  it('parses concept action queries in where', () => {
    const syncs = parseSyncFile(`
sync Test [eventual]
when {
  Step/complete: [ step: ?s; run: ?r ]
    => [ variant: "ok" ]
}
where {
  Vars/snapshot: [ run_ref: ?r ] => [ variant: "ok"; snapshot: ?vars ]
}
then {
  Checkpoint/capture: [ run: ?r; vars: ?vars ]
}`);
    expect(syncs[0].where).toHaveLength(1);
    expect(syncs[0].where[0].type).toBe('query');
  });

  it('parses guard expressions in where', () => {
    const syncs = parseSyncFile(`
sync Test [lazy]
when {
  Foo/bar: [ x: ?x ] => ok(total: ?total)
}
where {
  guard(greaterThan(?total, 0))
}
then {
  Signal/record: [ target: ?x ]
}`);
    expect(syncs[0].where).toHaveLength(1);
    expect(syncs[0].where[0].type).toBe('filter');
  });

  it('parses bind with function calls', () => {
    const syncs = parseSyncFile(`
sync Test [eager]
when {
  Foo/compile: [ sync: ?s; ast: ?ast ]
    => ok(compiled: ?compiled)
}
where {
  bind(sourceConceptOf(?compiled) as ?source)
  bind(targetConceptOf(?compiled) as ?target)
}
then {
  Contract/define: [ source: ?source; target: ?target ]
}`);
    expect(syncs[0].where).toHaveLength(2);
    expect(syncs[0].where[0].type).toBe('bind');
    expect(syncs[0].where[1].type).toBe('bind');
  });
});

describe('Sync Parser — Then Clause', () => {
  it('handles null and none as values', () => {
    const syncs = parseSyncFile(`
sync Test [eager]
when {
  Foo/bar: [ x: ?x ] => ok()
}
then {
  Artifact/store: [ content: null; metadata: none; path: ?x ]
}`);
    const fields = syncs[0].then[0].fields;
    expect(fields.find(f => f.name === 'content')?.value).toEqual({ type: 'literal', value: null });
    expect(fields.find(f => f.name === 'metadata')?.value).toEqual({ type: 'literal', value: null });
    expect(fields.find(f => f.name === 'path')?.value).toEqual({ type: 'variable', name: 'x' });
  });

  it('handles function call expressions as values', () => {
    const syncs = parseSyncFile(`
sync Test [eager]
when {
  Foo/bar: [ target: ?t ] => ok()
}
then {
  Agent/run: [ goal: concat("Synthesize for ", ?t); strategy: "formal" ]
}`);
    const fields = syncs[0].then[0].fields;
    const goal = fields.find(f => f.name === 'goal');
    expect(goal?.value.type).toBe('literal');
  });

  it('handles multiple then blocks', () => {
    const syncs = parseSyncFile(`
sync Pipeline [eager]
when {
  Publisher/package: [ source: ?sp ] => [ ok(publication: ?u) ]
}
then {
  Publisher/attest: [ publication: ?u ]
}
then {
  Publisher/sign: [ publication: ?u ]
}`);
    expect(syncs[0].then).toHaveLength(2);
    expect(syncs[0].then[0].action).toBe('attest');
    expect(syncs[0].then[1].action).toBe('sign');
  });

  it('handles dynamic concept refs (?provider/action)', () => {
    const syncs = parseSyncFile(`
sync Dispatch [eager]
when {
  Call/invoke: [ call: ?c; type: ?ctype ]
    => [ variant: "ok" ]
}
then {
  ?provider/execute: [ call: ?c; type: ?ctype ]
}`);
    expect(syncs[0].then[0].concept).toBe('?provider');
    expect(syncs[0].then[0].action).toBe('execute');
  });

  it('handles for-each blocks (skips gracefully)', () => {
    const syncs = parseSyncFile(`
sync Multi [eager]
when {
  Run/complete: [ run: ?run; results: ?results ]
    => ok()
}
then {
  for each ?r in ?results {
    Signal/record: [ status: "pass" ]
  }
}`);
    // for-each is skipped — no actions generated from it
    expect(syncs[0].then).toHaveLength(0);
  });
});

describe('Sync Parser — Multiple Syncs Per File', () => {
  it('parses multiple sync declarations in one file', () => {
    const syncs = parseSyncFile(`
# First sync
sync AlphaSync [eager]
  purpose { First sync. }
when {
  Concept/action: [ x: ?x ] => ok(entity: ?e)
}
then {
  Storage/save: [ record: ?e ]
}

# Second sync
sync BetaSync [eager]
  purpose { Second sync. }
when {
  Other/register: [ name: ?name ] => ok(sync: ?sync)
}
then {
  Relation/link: [ source: ?sync; target: ?name ]
}
`);
    expect(syncs).toHaveLength(2);
    expect(syncs[0].name).toBe('AlphaSync');
    expect(syncs[1].name).toBe('BetaSync');
    expect(syncs[0].purpose).toContain('First sync');
    expect(syncs[1].purpose).toContain('Second sync');
  });
});
