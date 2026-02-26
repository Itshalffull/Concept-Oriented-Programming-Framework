// ============================================================
// WidgetStateEntity Handler Tests
//
// Tests for widget-state-entity: registration, retrieval,
// widget queries, reachability analysis, unreachable state
// detection, event tracing, and get.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import {
  widgetStateEntityHandler,
  resetWidgetStateEntityCounter,
} from '../handlers/ts/widget-state-entity.handler.js';

describe('WidgetStateEntity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetWidgetStateEntityCounter();
  });

  /** Helper to register a state and set its transitions */
  async function registerStateWithTransitions(
    widget: string,
    name: string,
    initial: string,
    transitions: Array<{ target: string; event: string; guard?: string }>,
  ) {
    const reg = await widgetStateEntityHandler.register(
      { widget, name, initial },
      storage,
    );
    // Update the record with transitions
    const record = await storage.get('widget-state-entity', reg.widgetState as string);
    await storage.put('widget-state-entity', reg.widgetState as string, {
      ...record!,
      transitions: JSON.stringify(transitions),
      transitionCount: transitions.length,
    });
    return reg;
  }

  // ----------------------------------------------------------
  // register
  // ----------------------------------------------------------

  describe('register', () => {
    it('registers a new widget state and returns ok', async () => {
      const result = await widgetStateEntityHandler.register(
        { widget: 'Button', name: 'idle', initial: 'true' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.widgetState).toBe('widget-state-entity-1');
    });

    it('stores the state with correct symbol and defaults', async () => {
      await widgetStateEntityHandler.register(
        { widget: 'Button', name: 'pressed', initial: 'false' },
        storage,
      );
      const record = await storage.get('widget-state-entity', 'widget-state-entity-1');
      expect(record!.symbol).toBe('clef/widget-state/Button/pressed');
      expect(record!.transitions).toBe('[]');
      expect(record!.transitionCount).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // get
  // ----------------------------------------------------------

  describe('get', () => {
    it('returns state details after registration', async () => {
      const reg = await widgetStateEntityHandler.register(
        { widget: 'Button', name: 'idle', initial: 'true' },
        storage,
      );
      const result = await widgetStateEntityHandler.get({ widgetState: reg.widgetState }, storage);
      expect(result.variant).toBe('ok');
      expect(result.widget).toBe('Button');
      expect(result.name).toBe('idle');
      expect(result.initial).toBe('true');
      expect(result.transitionCount).toBe(0);
    });

    it('returns notfound for nonexistent state', async () => {
      const result = await widgetStateEntityHandler.get({ widgetState: 'nope' }, storage);
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // findByWidget
  // ----------------------------------------------------------

  describe('findByWidget', () => {
    it('returns states filtered by widget', async () => {
      await widgetStateEntityHandler.register({ widget: 'Button', name: 'idle', initial: 'true' }, storage);
      await widgetStateEntityHandler.register({ widget: 'Button', name: 'pressed', initial: 'false' }, storage);
      await widgetStateEntityHandler.register({ widget: 'Input', name: 'empty', initial: 'true' }, storage);

      const result = await widgetStateEntityHandler.findByWidget({ widget: 'Button' }, storage);
      expect(result.variant).toBe('ok');
      const states = JSON.parse(result.states as string);
      expect(states).toHaveLength(2);
    });
  });

  // ----------------------------------------------------------
  // reachableFrom
  // ----------------------------------------------------------

  describe('reachableFrom', () => {
    it('computes reachable states via BFS', async () => {
      const idle = await registerStateWithTransitions('Button', 'idle', 'true', [
        { target: 'hover', event: 'mouseenter' },
      ]);
      await registerStateWithTransitions('Button', 'hover', 'false', [
        { target: 'pressed', event: 'mousedown' },
      ]);
      await registerStateWithTransitions('Button', 'pressed', 'false', []);
      await registerStateWithTransitions('Button', 'disconnected', 'false', []);

      const result = await widgetStateEntityHandler.reachableFrom(
        { widgetState: idle.widgetState },
        storage,
      );
      expect(result.variant).toBe('ok');
      const reachable = JSON.parse(result.reachable as string);
      expect(reachable).toContain('hover');
      expect(reachable).toContain('pressed');
      expect(reachable).not.toContain('disconnected');
      expect(reachable).not.toContain('idle');
    });

    it('returns empty for state with no transitions', async () => {
      const state = await registerStateWithTransitions('Button', 'dead', 'false', []);

      const result = await widgetStateEntityHandler.reachableFrom(
        { widgetState: state.widgetState },
        storage,
      );
      expect(result.variant).toBe('ok');
      const reachable = JSON.parse(result.reachable as string);
      expect(reachable).toHaveLength(0);
    });

    it('returns empty for nonexistent state', async () => {
      const result = await widgetStateEntityHandler.reachableFrom(
        { widgetState: 'nope' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.reachable).toBe('[]');
    });
  });

  // ----------------------------------------------------------
  // unreachableStates
  // ----------------------------------------------------------

  describe('unreachableStates', () => {
    it('identifies states unreachable from the initial state', async () => {
      await registerStateWithTransitions('Button', 'idle', 'true', [
        { target: 'hover', event: 'mouseenter' },
      ]);
      await registerStateWithTransitions('Button', 'hover', 'false', [
        { target: 'idle', event: 'mouseleave' },
      ]);
      await registerStateWithTransitions('Button', 'orphan', 'false', []);

      const result = await widgetStateEntityHandler.unreachableStates({ widget: 'Button' }, storage);
      expect(result.variant).toBe('ok');
      const unreachable = JSON.parse(result.unreachable as string);
      expect(unreachable).toContain('orphan');
      expect(unreachable).not.toContain('idle');
      expect(unreachable).not.toContain('hover');
    });

    it('returns all states as unreachable when no initial state exists', async () => {
      await widgetStateEntityHandler.register(
        { widget: 'Button', name: 'a', initial: 'false' },
        storage,
      );
      await widgetStateEntityHandler.register(
        { widget: 'Button', name: 'b', initial: 'false' },
        storage,
      );

      const result = await widgetStateEntityHandler.unreachableStates({ widget: 'Button' }, storage);
      expect(result.variant).toBe('ok');
      const unreachable = JSON.parse(result.unreachable as string);
      expect(unreachable).toHaveLength(2);
    });

    it('returns empty for widget with no states', async () => {
      const result = await widgetStateEntityHandler.unreachableStates({ widget: 'Empty' }, storage);
      expect(result.variant).toBe('ok');
      expect(JSON.parse(result.unreachable as string)).toHaveLength(0);
    });
  });

  // ----------------------------------------------------------
  // traceEvent
  // ----------------------------------------------------------

  describe('traceEvent', () => {
    it('traces an event across all states of a widget', async () => {
      await registerStateWithTransitions('Button', 'idle', 'true', [
        { target: 'hover', event: 'mouseenter' },
      ]);
      await registerStateWithTransitions('Button', 'hover', 'false', [
        { target: 'idle', event: 'mouseleave' },
        { target: 'pressed', event: 'mousedown' },
      ]);
      await registerStateWithTransitions('Button', 'pressed', 'false', []);

      const result = await widgetStateEntityHandler.traceEvent(
        { widget: 'Button', event: 'mouseenter' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const paths = JSON.parse(result.paths as string);
      expect(paths).toHaveLength(1);
      expect(paths[0].from).toBe('idle');
      expect(paths[0].to).toBe('hover');
    });

    it('returns unhandled when no state handles the event', async () => {
      await registerStateWithTransitions('Button', 'idle', 'true', []);
      await registerStateWithTransitions('Button', 'hover', 'false', []);

      const result = await widgetStateEntityHandler.traceEvent(
        { widget: 'Button', event: 'click' },
        storage,
      );
      expect(result.variant).toBe('unhandled');
      const inStates = JSON.parse(result.inStates as string);
      expect(inStates).toHaveLength(2);
    });

    it('returns unhandled for widget with no states', async () => {
      const result = await widgetStateEntityHandler.traceEvent(
        { widget: 'Empty', event: 'click' },
        storage,
      );
      expect(result.variant).toBe('unhandled');
    });
  });
});
