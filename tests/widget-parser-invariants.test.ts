/**
 * Widget Parser — Structured Invariant Tests
 *
 * Validates that the widget parser supports all 6 invariant construct kinds
 * (example, forall, always, never, eventually, requires_ensures) with named
 * test cases, matching the concept parser's invariant grammar.
 *
 * See Architecture doc Sections on Invariant Language Extensions.
 */

import { describe, it, expect } from 'vitest';
import { parseWidgetFile } from '../handlers/ts/framework/widget-spec-parser.js';

describe('Widget Parser — Structured Invariants', () => {
  describe('legacy prose string backward compatibility', () => {
    it('wraps bare strings as kind=example with name', () => {
      const source = `
        widget LegacyWidget {
          purpose { test widget }
          anatomy { root: container {} }
          states { idle [initial] { on click -> active; } active { on reset -> idle; } }
          accessibility { role: button }
          props {}
          invariant {
            "FSM is deterministic"
            "All states are reachable"
          }
        }
      `;
      const manifest = parseWidgetFile(source);
      expect(manifest.invariants).toHaveLength(2);
      expect(manifest.invariants![0]).toMatchObject({
        kind: 'example',
        name: 'FSM is deterministic',
        afterPatterns: [],
        thenPatterns: [],
      });
      expect(manifest.invariants![1]).toMatchObject({
        kind: 'example',
        name: 'All states are reachable',
      });
    });
  });

  describe('example invariants with named test cases', () => {
    it('parses named example with after/then', () => {
      const source = `
        widget CardWidget {
          purpose { a card }
          anatomy { root: container {} }
          states { idle [initial] { on click -> selected; } selected { on click -> idle; } }
          accessibility { role: listitem }
          props {}
          invariant {
            example "clicking idle card selects it": {
              after transition(from: "idle", event: "click") -> ok
              then state = "selected"
            }
          }
        }
      `;
      const manifest = parseWidgetFile(source);
      expect(manifest.invariants).toHaveLength(1);
      const inv = manifest.invariants![0];
      expect(inv.kind).toBe('example');
      expect(inv.name).toBe('clicking idle card selects it');
      expect(inv.afterPatterns).toHaveLength(1);
      expect(inv.afterPatterns[0].actionName).toBe('transition');
      expect(inv.afterPatterns[0].variantName).toBe('ok');
      expect(inv.thenPatterns).toHaveLength(1);
      expect(inv.thenPatterns[0].kind).toBe('assertion');
    });

    it('parses multiple named examples', () => {
      const source = `
        widget ToggleWidget {
          purpose { a toggle }
          anatomy { root: interactive {} }
          states { inactive [initial] { on toggle -> active; } active { on toggle -> inactive; } }
          accessibility { role: switch }
          props {}
          invariant {
            example "toggle on": {
              after toggle() -> ok
              then state = "active"
            }
            example "toggle off from on": {
              after toggle() -> ok
              and toggle() -> ok
              then state = "inactive"
            }
          }
        }
      `;
      const manifest = parseWidgetFile(source);
      expect(manifest.invariants).toHaveLength(2);
      expect(manifest.invariants![0].name).toBe('toggle on');
      expect(manifest.invariants![1].name).toBe('toggle off from on');
      expect(manifest.invariants![1].afterPatterns).toHaveLength(2);
    });
  });

  describe('always invariants', () => {
    it('parses always with forall quantifier', () => {
      const source = `
        widget FSMWidget {
          purpose { stateful widget }
          anatomy { root: container {} }
          states { idle [initial] { on click -> active; } active { on reset -> idle; } }
          accessibility { role: region }
          props {}
          invariant {
            always "FSM deterministic": {
              forall s in states:
              s.transitions_count <= 1
            }
          }
        }
      `;
      const manifest = parseWidgetFile(source);
      expect(manifest.invariants).toHaveLength(1);
      const inv = manifest.invariants![0];
      expect(inv.kind).toBe('always');
      expect(inv.name).toBe('FSM deterministic');
      expect(inv.quantifiers).toHaveLength(1);
      expect(inv.quantifiers![0].variable).toBe('s');
      expect(inv.quantifiers![0].domain).toEqual({ type: 'state_field', name: 'states' });
      expect(inv.thenPatterns).toHaveLength(1);
    });
  });

  describe('never invariants', () => {
    it('parses never with exists quantifier', () => {
      const source = `
        widget ReachableWidget {
          purpose { all states reachable }
          anatomy { root: container {} }
          states { idle [initial] { on click -> active; } active { on reset -> idle; } }
          accessibility { role: region }
          props {}
          invariant {
            never "unreachable state": {
              exists s in states:
              s.inbound_count = 0
            }
          }
        }
      `;
      const manifest = parseWidgetFile(source);
      expect(manifest.invariants).toHaveLength(1);
      const inv = manifest.invariants![0];
      expect(inv.kind).toBe('never');
      expect(inv.name).toBe('unreachable state');
      expect(inv.quantifiers).toHaveLength(1);
      expect(inv.quantifiers![0].variable).toBe('s');
    });
  });

  describe('forall invariants', () => {
    it('parses forall with given binding and set literal', () => {
      const source = `
        widget EventWidget {
          purpose { event coverage }
          anatomy { root: container {} }
          states { idle [initial] { on click -> active; } active { on reset -> idle; } }
          accessibility { role: button }
          props {}
          invariant {
            forall "all events handled": {
              given e in {"click", "keydown", "focus"}
              after handle(event: e) -> ok
              then handled = true
            }
          }
        }
      `;
      const manifest = parseWidgetFile(source);
      expect(manifest.invariants).toHaveLength(1);
      const inv = manifest.invariants![0];
      expect(inv.kind).toBe('forall');
      expect(inv.name).toBe('all events handled');
      expect(inv.quantifiers).toHaveLength(1);
      expect(inv.quantifiers![0].variable).toBe('e');
      expect(inv.quantifiers![0].domain).toEqual({
        type: 'set_literal',
        values: ['click', 'keydown', 'focus'],
      });
      expect(inv.afterPatterns).toHaveLength(1);
      expect(inv.thenPatterns).toHaveLength(1);
    });
  });

  describe('eventually invariants', () => {
    it('parses eventually with forall and where condition', () => {
      const source = `
        widget AsyncWidget {
          purpose { async operations complete }
          anatomy { root: container {} }
          states { loading [initial] { on complete -> done; } done {} }
          accessibility { role: status }
          props {}
          invariant {
            eventually "loading completes": {
              forall r in requests where r.status = "loading":
              r.status in {"done", "error"}
            }
          }
        }
      `;
      const manifest = parseWidgetFile(source);
      expect(manifest.invariants).toHaveLength(1);
      const inv = manifest.invariants![0];
      expect(inv.kind).toBe('eventually');
      expect(inv.name).toBe('loading completes');
      expect(inv.quantifiers).toHaveLength(1);
      expect(inv.quantifiers![0].variable).toBe('r');
      expect(inv.quantifiers![0].whereCondition).toBeDefined();
      expect(inv.quantifiers![0].whereCondition!.operator).toBe('=');
    });
  });

  describe('action requires/ensures contracts', () => {
    it('parses action contract with requires and ensures', () => {
      const source = `
        widget FormWidget {
          purpose { form input }
          anatomy { root: container {} input: interactive {} }
          states { empty [initial] { on input -> filled; } filled { on clear -> empty; } }
          accessibility { role: textbox }
          props {}
          invariant {
            action validate {
              requires: value != ""
              ensures ok: valid = true
              ensures invalid: valid = false
            }
          }
        }
      `;
      const manifest = parseWidgetFile(source);
      expect(manifest.invariants).toHaveLength(1);
      const inv = manifest.invariants![0];
      expect(inv.kind).toBe('requires_ensures');
      expect(inv.targetAction).toBe('validate');
      expect(inv.contracts).toHaveLength(3);
      expect(inv.contracts![0].kind).toBe('requires');
      expect(inv.contracts![1]).toMatchObject({ kind: 'ensures', variant: 'ok' });
      expect(inv.contracts![2]).toMatchObject({ kind: 'ensures', variant: 'invalid' });
    });
  });

  describe('mixed invariant types', () => {
    it('parses a block with multiple invariant kinds', () => {
      const source = `
        widget MixedWidget {
          purpose { mixed invariants }
          anatomy { root: container {} badge: text {} }
          states { idle [initial] { on click -> selected; } selected { on escape -> idle; } }
          accessibility { role: option }
          props {}
          invariant {
            example "click selects": {
              after transition(from: "idle", event: "click") -> ok
              then state = "selected"
            }
            always "valid state": {
              forall s in states:
              s.name in {"idle", "selected"}
            }
            never "dead state": {
              exists s in states:
              s.reachable = false
            }
            "legacy prose invariant"
          }
        }
      `;
      const manifest = parseWidgetFile(source);
      expect(manifest.invariants).toHaveLength(4);
      expect(manifest.invariants![0].kind).toBe('example');
      expect(manifest.invariants![0].name).toBe('click selects');
      expect(manifest.invariants![1].kind).toBe('always');
      expect(manifest.invariants![2].kind).toBe('never');
      expect(manifest.invariants![3].kind).toBe('example');
      expect(manifest.invariants![3].name).toBe('legacy prose invariant');
    });
  });
});
