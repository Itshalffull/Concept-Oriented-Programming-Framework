// ============================================================
// Parser Tests - .concept and .sync file parsing
// ============================================================

import { describe, it, expect } from 'vitest';
import { parseConceptFile } from '@copf/kernel';
import { parseSyncFile } from '@copf/kernel';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const SPECS_DIR = resolve(__dirname, '../specs/app');
const SYNCS_DIR = resolve(__dirname, '../syncs/app');

describe('Concept Parser', () => {

  it('parses echo.concept', () => {
    const source = readFileSync(resolve(SPECS_DIR, 'echo.concept'), 'utf-8');
    const ast = parseConceptFile(source);

    expect(ast.name).toBe('Echo');
    expect(ast.typeParams).toEqual(['M']);
    expect(ast.purpose).toContain('echo');

    // State
    expect(ast.state).toHaveLength(2);
    expect(ast.state[0].name).toBe('messages');
    expect(ast.state[1].name).toBe('text');

    // Actions
    expect(ast.actions).toHaveLength(1);
    const send = ast.actions[0];
    expect(send.name).toBe('send');
    expect(send.params).toHaveLength(2);
    expect(send.params[0].name).toBe('id');
    expect(send.params[1].name).toBe('text');
    expect(send.variants).toHaveLength(1);
    expect(send.variants[0].name).toBe('ok');

    // Invariant
    expect(ast.invariants).toHaveLength(1);
    expect(ast.invariants[0].afterPatterns).toHaveLength(1);
    expect(ast.invariants[0].thenPatterns).toHaveLength(1);
  });

  it('parses password.concept', () => {
    const source = readFileSync(resolve(SPECS_DIR, 'password.concept'), 'utf-8');
    const ast = parseConceptFile(source);

    expect(ast.name).toBe('Password');
    expect(ast.typeParams).toEqual(['U']);

    // State
    expect(ast.state).toHaveLength(2);
    expect(ast.state[0].name).toBe('hash');
    expect(ast.state[1].name).toBe('salt');

    // Actions
    expect(ast.actions).toHaveLength(3);
    expect(ast.actions.map(a => a.name)).toEqual(['set', 'check', 'validate']);

    // set action has 2 variants
    expect(ast.actions[0].variants).toHaveLength(2);
    expect(ast.actions[0].variants[0].name).toBe('ok');
    expect(ast.actions[0].variants[1].name).toBe('invalid');

    // check action has 2 variants
    expect(ast.actions[1].variants).toHaveLength(2);

    // validate action has 1 variant
    expect(ast.actions[2].variants).toHaveLength(1);

    // Capabilities
    expect(ast.capabilities).toContain('crypto');

    // Invariant with multiple then patterns
    expect(ast.invariants).toHaveLength(1);
    expect(ast.invariants[0].afterPatterns).toHaveLength(1);
    expect(ast.invariants[0].thenPatterns).toHaveLength(2);
  });

  it('parses user.concept', () => {
    const source = readFileSync(resolve(SPECS_DIR, 'user.concept'), 'utf-8');
    const ast = parseConceptFile(source);

    expect(ast.name).toBe('User');
    expect(ast.typeParams).toEqual(['U']);
    expect(ast.actions).toHaveLength(1);
    expect(ast.actions[0].name).toBe('register');
    expect(ast.actions[0].variants).toHaveLength(2);

    // Invariant
    expect(ast.invariants).toHaveLength(1);
    const inv = ast.invariants[0];
    expect(inv.afterPatterns[0].actionName).toBe('register');
    expect(inv.afterPatterns[0].variantName).toBe('ok');
    expect(inv.thenPatterns[0].actionName).toBe('register');
    expect(inv.thenPatterns[0].variantName).toBe('error');
  });

  it('parses jwt.concept', () => {
    const source = readFileSync(resolve(SPECS_DIR, 'jwt.concept'), 'utf-8');
    const ast = parseConceptFile(source);

    expect(ast.name).toBe('JWT');
    expect(ast.typeParams).toEqual(['U']);
    expect(ast.actions).toHaveLength(2);
    expect(ast.actions[0].name).toBe('generate');
    expect(ast.actions[1].name).toBe('verify');
  });

  it('handles inline state declarations', () => {
    const source = `
concept Test [T] {
  state {
    count: T -> Int
    label: T -> String
  }
  actions {
    action doStuff(item: T) {
      -> ok(item: T) { Do stuff. }
    }
  }
}`;
    const ast = parseConceptFile(source);
    expect(ast.name).toBe('Test');
    expect(ast.state).toHaveLength(2);
    expect(ast.state[0].name).toBe('count');
    expect(ast.state[1].name).toBe('label');
  });

  it('handles multiple type parameters', () => {
    const source = `
concept Edge [A, B] {
  state {
    source: A -> B
  }
  actions {
    action link(from: A, to: B) {
      -> ok(from: A, to: B) { Link A to B. }
    }
  }
}`;
    const ast = parseConceptFile(source);
    expect(ast.typeParams).toEqual(['A', 'B']);
    expect(ast.state[0].type).toEqual({ kind: 'relation', from: { kind: 'param', name: 'A' }, to: { kind: 'param', name: 'B' } });
  });

  it('allows set/list/option as identifiers outside type expressions', () => {
    const source = `
concept Collection [T] {
  state {
    items: set T
    list: T -> String
    option: T -> Bool
  }
  actions {
    action set(item: T, list: list String) {
      -> ok(item: T) { Set the item. }
    }
    action list(option: Bool) {
      -> ok(items: list T) { List all items. }
    }
    action option(set: set T) {
      -> ok(valid: Bool) { Check option. }
    }
  }
  invariant {
    after set(item: x, list: "a") -> ok(item: x)
    then list(option: true) -> ok(items: x)
  }
}`;
    const ast = parseConceptFile(source);
    expect(ast.name).toBe('Collection');

    // 'list' and 'option' as state field names
    expect(ast.state[1].name).toBe('list');
    expect(ast.state[2].name).toBe('option');

    // 'set' as type constructor in state
    expect(ast.state[0].type).toEqual({ kind: 'set', inner: { kind: 'param', name: 'T' } });

    // 'set', 'list', 'option' as action names
    expect(ast.actions.map(a => a.name)).toEqual(['set', 'list', 'option']);

    // 'list' as parameter name, 'list String' as type
    expect(ast.actions[0].params[1].name).toBe('list');
    expect(ast.actions[0].params[1].type).toEqual({ kind: 'list', inner: { kind: 'primitive', name: 'String' } });

    // 'option' as parameter name
    expect(ast.actions[1].params[0].name).toBe('option');

    // 'set' as parameter name with 'set T' as type
    expect(ast.actions[2].params[0].name).toBe('set');
    expect(ast.actions[2].params[0].type).toEqual({ kind: 'set', inner: { kind: 'param', name: 'T' } });

    // invariant uses 'set' and 'list' as action names
    expect(ast.invariants[0].afterPatterns[0].actionName).toBe('set');
    expect(ast.invariants[0].thenPatterns[0].actionName).toBe('list');
  });
});

describe('Sync Parser', () => {

  it('parses echo.sync', () => {
    const source = readFileSync(resolve(SYNCS_DIR, 'echo.sync'), 'utf-8');
    const syncs = parseSyncFile(source);

    expect(syncs).toHaveLength(2);

    // HandleEcho
    const handle = syncs[0];
    expect(handle.name).toBe('HandleEcho');
    expect(handle.when).toHaveLength(1);
    expect(handle.when[0].concept).toBe('urn:copf/Web');
    expect(handle.when[0].action).toBe('request');
    expect(handle.where).toHaveLength(1);
    expect(handle.where[0].type).toBe('bind');
    expect(handle.then).toHaveLength(1);
    expect(handle.then[0].concept).toBe('urn:copf/Echo');
    expect(handle.then[0].action).toBe('send');

    // EchoResponse
    const resp = syncs[1];
    expect(resp.name).toBe('EchoResponse');
    expect(resp.when).toHaveLength(2);
    expect(resp.then).toHaveLength(1);
    expect(resp.then[0].concept).toBe('urn:copf/Web');
    expect(resp.then[0].action).toBe('respond');
  });

  it('parses registration.sync', () => {
    const source = readFileSync(resolve(SYNCS_DIR, 'registration.sync'), 'utf-8');
    const syncs = parseSyncFile(source);

    expect(syncs.length).toBeGreaterThanOrEqual(6);

    const names = syncs.map(s => s.name);
    expect(names).toContain('ValidatePassword');
    expect(names).toContain('ValidatePasswordError');
    expect(names).toContain('RegisterUser');
    expect(names).toContain('SetPassword');
    expect(names).toContain('GenerateToken');
    expect(names).toContain('RegistrationResponse');
    expect(names).toContain('RegistrationError');
  });

  it('parses sync annotations', () => {
    const source = readFileSync(resolve(SYNCS_DIR, 'echo.sync'), 'utf-8');
    const syncs = parseSyncFile(source);

    expect(syncs[0].annotations).toContain('eager');
    expect(syncs[1].annotations).toContain('eager');
  });

  it('correctly parses variable references in field patterns', () => {
    const source = readFileSync(resolve(SYNCS_DIR, 'echo.sync'), 'utf-8');
    const syncs = parseSyncFile(source);

    const handle = syncs[0];
    const inputFields = handle.when[0].inputFields;
    expect(inputFields.length).toBe(2);
    expect(inputFields[0].name).toBe('method');
    expect(inputFields[0].match).toEqual({ type: 'literal', value: 'echo' });
    expect(inputFields[1].name).toBe('text');
    expect(inputFields[1].match).toEqual({ type: 'variable', name: 'text' });
  });
});
