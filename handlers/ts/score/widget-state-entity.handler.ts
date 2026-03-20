// @clef-handler style=imperative
// ============================================================
// WidgetStateEntity Concept Implementation (Functional)
//
// A state in a widget's finite state machine, with transitions,
// entry/exit actions, and guards. Enables static analysis of
// widget behavior — reachability, dead states, unhandled events.
// Independent concept — only queries own storage.
// ============================================================

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.js';
import {
  createProgram, find, put, branch, complete, pureFrom, mapBindings,
} from '../../../runtime/storage-program.js';

export const widgetStateEntityHandler: FunctionalConceptHandler = {

  register(input) {
    const widget = input.widget as string;
    const name = input.name as string;
    const initial = input.initial as string;
    const id = crypto.randomUUID();
    const key = `state:${widget}/${name}`;

    let p = createProgram();
    return complete(
      put(p, 'widgetState', key, {
        id, widget, name,
        symbol: `clef/widget/${widget}/state/${name}`,
        initial: initial || 'false',
        transitions: '[]',
        entryActions: '[]',
        exitActions: '[]',
      }),
      'ok', { widgetState: id },
    );
  },

  findByWidget(input) {
    const widget = input.widget as string;

    let p = createProgram();
    p = find(p, 'widgetState', { widget }, 'matches');
    p = mapBindings(p, (b) => {
      const matches = b.matches as Array<Record<string, unknown>>;
      return JSON.stringify(matches.map(s => ({
        id: s.id, name: s.name, initial: s.initial,
      })));
    }, 'result');

    return pureFrom(p, (b) => ({ variant: 'ok', states: b.result }));
  },

  reachableFrom(input) {
    const widgetState = input.widgetState as string;

    let p = createProgram();
    p = find(p, 'widgetState', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      const entry = all.find(s => s.id === widgetState);
      if (!entry) return { reachable: [], via: [] };

      const widget = entry.widget as string;
      const widgetStates = all.filter(s => s.widget === widget);
      const reachable = new Set<string>();
      const via: Array<{ from: string; to: string; event: string }> = [];
      const queue = [entry.name as string];

      while (queue.length > 0) {
        const current = queue.shift()!;
        const state = widgetStates.find(s => s.name === current);
        if (!state) continue;

        const transitions: Array<{ to?: string; event?: string }> =
          JSON.parse(state.transitions as string || '[]');
        for (const t of transitions) {
          if (t.to && !reachable.has(t.to)) {
            reachable.add(t.to);
            via.push({ from: current, to: t.to, event: t.event || '' });
            queue.push(t.to);
          }
        }
      }

      return { reachable: Array.from(reachable), via };
    }, 'analysis');

    return pureFrom(p, (b) => {
      const a = b.analysis as Record<string, unknown>;
      return { variant: 'ok', reachable: JSON.stringify(a.reachable), via: JSON.stringify(a.via) };
    });
  },

  unreachableStates(input) {
    const widget = input.widget as string;

    let p = createProgram();
    p = find(p, 'widgetState', { widget }, 'widgetStates');
    p = mapBindings(p, (b) => {
      const states = b.widgetStates as Array<Record<string, unknown>>;
      const allNames = new Set(states.map(s => s.name as string));
      const reachable = new Set<string>();

      // Find initial state
      const initial = states.find(s => s.initial === 'true');
      if (initial) {
        const queue = [initial.name as string];
        reachable.add(initial.name as string);

        while (queue.length > 0) {
          const current = queue.shift()!;
          const state = states.find(s => s.name === current);
          if (!state) continue;

          const transitions: Array<{ to?: string }> =
            JSON.parse(state.transitions as string || '[]');
          for (const t of transitions) {
            if (t.to && !reachable.has(t.to)) {
              reachable.add(t.to);
              queue.push(t.to);
            }
          }
        }
      }

      const unreachable = Array.from(allNames).filter(n => !reachable.has(n));
      return JSON.stringify(unreachable);
    }, 'unreachable');

    return pureFrom(p, (b) => ({ variant: 'ok', unreachable: b.unreachable }));
  },

  traceEvent(input) {
    const widget = input.widget as string;
    const event = input.event as string;

    let p = createProgram();
    p = find(p, 'widgetState', { widget }, 'widgetStates');
    p = mapBindings(p, (b) => {
      const states = b.widgetStates as Array<Record<string, unknown>>;
      const paths: Array<{ from: string; to: string; guard: string }> = [];
      const unhandled: string[] = [];

      for (const state of states) {
        const transitions: Array<{ event?: string; to?: string; guard?: string }> =
          JSON.parse(state.transitions as string || '[]');
        const matching = transitions.filter(t => t.event === event);
        if (matching.length > 0) {
          for (const t of matching) {
            paths.push({ from: state.name as string, to: t.to || '', guard: t.guard || '' });
          }
        } else {
          unhandled.push(state.name as string);
        }
      }

      return { paths, unhandled };
    }, 'trace');

    return branch(p,
      (b) => (b.trace as Record<string, unknown>).paths != null &&
        ((b.trace as Record<string, unknown>).paths as unknown[]).length > 0,
      pureFrom(createProgram(), (b) => {
        const t = b.trace as Record<string, unknown>;
        return { variant: 'ok', paths: JSON.stringify(t.paths) };
      }),
      pureFrom(createProgram(), (b) => {
        const t = b.trace as Record<string, unknown>;
        return { variant: 'unhandled', inStates: JSON.stringify(t.unhandled) };
      }),
    );
  },

  get(input) {
    const widgetState = input.widgetState as string;

    let p = createProgram();
    p = find(p, 'widgetState', {}, 'all');
    p = mapBindings(p, (b) => {
      const all = b.all as Array<Record<string, unknown>>;
      return all.find(s => s.id === widgetState) || null;
    }, 'entry');

    return branch(p,
      (b) => b.entry != null,
      pureFrom(createProgram(), (b) => {
        const e = b.entry as Record<string, unknown>;
        const transitions: unknown[] = JSON.parse(e.transitions as string || '[]');
        return {
          variant: 'ok', widgetState: e.id, widget: e.widget,
          name: e.name, initial: e.initial, transitionCount: transitions.length,
        };
      }),
      complete(createProgram(), 'notfound', {}),
    );
  },
};
