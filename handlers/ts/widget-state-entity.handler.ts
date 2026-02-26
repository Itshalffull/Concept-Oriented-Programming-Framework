// ============================================================
// WidgetStateEntity Handler
//
// A state in a widget's finite state machine, with transitions,
// entry/exit actions, and guards. Enables static analysis of
// widget behavior -- reachability, dead states, unhandled events.
// ============================================================

import type { ConceptHandler, ConceptStorage } from '../../kernel/src/types.js';

let idCounter = 0;
function nextId(): string {
  return `widget-state-entity-${++idCounter}`;
}

export const widgetStateEntityHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const widget = input.widget as string;
    const name = input.name as string;
    const initial = input.initial as string;

    const id = nextId();
    const symbol = `clef/widget-state/${widget}/${name}`;

    await storage.put('widget-state-entity', id, {
      id,
      widget,
      name,
      symbol,
      initial,
      transitions: '[]',
      entryActions: '[]',
      exitActions: '[]',
      transitionCount: 0,
    });

    return { variant: 'ok', widgetState: id };
  },

  async findByWidget(input: Record<string, unknown>, storage: ConceptStorage) {
    const widget = input.widget as string;

    const results = await storage.find('widget-state-entity', { widget });

    return { variant: 'ok', states: JSON.stringify(results) };
  },

  async reachableFrom(input: Record<string, unknown>, storage: ConceptStorage) {
    const widgetState = input.widgetState as string;

    const record = await storage.get('widget-state-entity', widgetState);
    if (!record) {
      return { variant: 'ok', reachable: '[]', via: '[]' };
    }

    const widget = record.widget as string;
    const allStates = await storage.find('widget-state-entity', { widget });

    // Build transition graph and compute reachability via BFS
    const transitionMap = new Map<string, Array<{ target: string; event: string }>>();
    for (const s of allStates) {
      try {
        const transitions = JSON.parse(s.transitions as string || '[]') as Array<Record<string, unknown>>;
        const edges = transitions.map((t) => ({
          target: (t.target || t.to) as string,
          event: (t.event || t.on) as string,
        }));
        transitionMap.set(s.name as string, edges);
      } catch {
        transitionMap.set(s.name as string, []);
      }
    }

    const startName = record.name as string;
    const visited = new Set<string>();
    const via: Array<Record<string, unknown>> = [];
    const queue = [startName];
    visited.add(startName);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const edges = transitionMap.get(current) || [];
      for (const edge of edges) {
        if (!visited.has(edge.target)) {
          visited.add(edge.target);
          queue.push(edge.target);
          via.push({ from: current, to: edge.target, event: edge.event });
        }
      }
    }

    // Remove start state from reachable set
    visited.delete(startName);

    return {
      variant: 'ok',
      reachable: JSON.stringify([...visited]),
      via: JSON.stringify(via),
    };
  },

  async unreachableStates(input: Record<string, unknown>, storage: ConceptStorage) {
    const widget = input.widget as string;

    const allStates = await storage.find('widget-state-entity', { widget });
    if (allStates.length === 0) {
      return { variant: 'ok', unreachable: '[]' };
    }

    // Find the initial state
    const initialState = allStates.find((s) => s.initial === 'true');
    if (!initialState) {
      // No initial state; all states are potentially unreachable
      return { variant: 'ok', unreachable: JSON.stringify(allStates.map((s) => s.name)) };
    }

    // Build the transition graph
    const allTargets = new Set<string>();
    allTargets.add(initialState.name as string);

    for (const s of allStates) {
      try {
        const transitions = JSON.parse(s.transitions as string || '[]') as Array<Record<string, unknown>>;
        for (const t of transitions) {
          allTargets.add((t.target || t.to) as string);
        }
      } catch {
        // skip
      }
    }

    // BFS from initial
    const visited = new Set<string>();
    const queue = [initialState.name as string];
    visited.add(initialState.name as string);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const stateRecord = allStates.find((s) => s.name === current);
      if (!stateRecord) continue;

      try {
        const transitions = JSON.parse(stateRecord.transitions as string || '[]') as Array<Record<string, unknown>>;
        for (const t of transitions) {
          const target = (t.target || t.to) as string;
          if (!visited.has(target)) {
            visited.add(target);
            queue.push(target);
          }
        }
      } catch {
        // skip
      }
    }

    const unreachable = allStates
      .filter((s) => !visited.has(s.name as string))
      .map((s) => s.name);

    return { variant: 'ok', unreachable: JSON.stringify(unreachable) };
  },

  async traceEvent(input: Record<string, unknown>, storage: ConceptStorage) {
    const widget = input.widget as string;
    const event = input.event as string;

    const allStates = await storage.find('widget-state-entity', { widget });
    if (allStates.length === 0) {
      return { variant: 'unhandled', inStates: '[]' };
    }

    const paths: Array<Record<string, unknown>> = [];
    const unhandledIn: string[] = [];

    for (const s of allStates) {
      try {
        const transitions = JSON.parse(s.transitions as string || '[]') as Array<Record<string, unknown>>;
        const matching = transitions.filter(
          (t) => (t.event || t.on) === event,
        );

        if (matching.length > 0) {
          for (const t of matching) {
            paths.push({
              from: s.name,
              to: t.target || t.to,
              guard: t.guard || null,
            });
          }
        } else {
          unhandledIn.push(s.name as string);
        }
      } catch {
        unhandledIn.push(s.name as string);
      }
    }

    if (paths.length === 0) {
      return { variant: 'unhandled', inStates: JSON.stringify(unhandledIn) };
    }

    if (unhandledIn.length > 0) {
      // Some states handle it, some do not -- return paths but also note unhandled
      return { variant: 'ok', paths: JSON.stringify(paths) };
    }

    return { variant: 'ok', paths: JSON.stringify(paths) };
  },

  async get(input: Record<string, unknown>, storage: ConceptStorage) {
    const widgetState = input.widgetState as string;

    const record = await storage.get('widget-state-entity', widgetState);
    if (!record) {
      return { variant: 'notfound' };
    }

    let transitionCount = 0;
    try {
      const transitions = JSON.parse(record.transitions as string || '[]');
      transitionCount = Array.isArray(transitions) ? transitions.length : 0;
    } catch {
      transitionCount = 0;
    }

    return {
      variant: 'ok',
      widgetState: record.id as string,
      widget: record.widget as string,
      name: record.name as string,
      initial: record.initial as string,
      transitionCount,
    };
  },
};

/** Reset the ID counter. Useful for testing. */
export function resetWidgetStateEntityCounter(): void {
  idCounter = 0;
}
