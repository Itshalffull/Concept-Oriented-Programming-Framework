// Navigator Concept Implementation
// Abstract navigation between destinations with guards and history.
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'navigator';

export const navigatorHandler: ConceptHandler = {
  /**
   * register(nav, destination, config)
   *   -> ok(nav) | conflict(message)
   */
  async register(input, storage) {
    const nav = input.nav as string;
    const destination = input.destination as string;
    const config = input.config as string;

    let record = await storage.get(RELATION, nav);
    if (!record) {
      // First registration — initialize navigator
      record = {
        nav,
        destinations: '{}',
        current: null,
        params: '{}',
        history: '[]',
        guards: '[]',
        graph: '"*"',
        depth: 0,
      };
    }

    let destinations: Record<string, string>;
    try {
      destinations = JSON.parse(record.destinations as string) as Record<string, string>;
    } catch {
      destinations = {};
    }

    if (destination in destinations) {
      return {
        variant: 'conflict',
        message: `Destination "${destination}" is already registered`,
      };
    }

    destinations[destination] = config;

    await storage.put(RELATION, nav, {
      ...record,
      destinations: JSON.stringify(destinations),
    });

    return { variant: 'ok', nav };
  },

  /**
   * go(nav, destination, params)
   *   -> ok(nav, resolved) | blocked(message) | notfound(message)
   */
  async go(input, storage) {
    const nav = input.nav as string;
    const destination = input.destination as string;
    const params = input.params as string;

    const record = await storage.get(RELATION, nav);
    if (!record) {
      return { variant: 'notfound', message: `Navigator "${nav}" not found` };
    }

    let destinations: Record<string, string>;
    try {
      destinations = JSON.parse(record.destinations as string) as Record<string, string>;
    } catch {
      destinations = {};
    }

    if (!(destination in destinations)) {
      return {
        variant: 'notfound',
        message: `Destination "${destination}" is not registered`,
      };
    }

    // Evaluate guards
    let guards: Array<{ destination?: string; condition?: string }>;
    try {
      guards = JSON.parse(record.guards as string) as Array<{ destination?: string; condition?: string }>;
    } catch {
      guards = [];
    }

    for (const guard of guards) {
      if (guard.destination === record.current || guard.destination === destination) {
        if (guard.condition === 'block') {
          return {
            variant: 'blocked',
            message: `Guard blocked transition to "${destination}"`,
          };
        }
      }
    }

    // Push current to history
    let history: string[];
    try {
      history = JSON.parse(record.history as string) as string[];
    } catch {
      history = [];
    }

    if (record.current) {
      history.push(record.current as string);
    }

    const resolved = JSON.stringify({
      destination,
      config: JSON.parse(destinations[destination]),
      params: JSON.parse(params),
    });

    await storage.put(RELATION, nav, {
      ...record,
      current: destination,
      params,
      history: JSON.stringify(history),
      depth: history.length,
    });

    return { variant: 'ok', nav, resolved };
  },

  /**
   * back(nav) -> ok(nav) | empty(message)
   */
  async back(input, storage) {
    const nav = input.nav as string;

    const record = await storage.get(RELATION, nav);
    if (!record) {
      return { variant: 'empty', message: `Navigator "${nav}" not found` };
    }

    let history: string[];
    try {
      history = JSON.parse(record.history as string) as string[];
    } catch {
      history = [];
    }

    if (history.length === 0) {
      return { variant: 'empty', message: 'History stack is empty' };
    }

    const previous = history.pop()!;

    await storage.put(RELATION, nav, {
      ...record,
      current: previous,
      history: JSON.stringify(history),
      depth: history.length,
    });

    return { variant: 'ok', nav };
  },

  /**
   * forward(nav) -> ok(nav) | empty(message)
   */
  async forward(input, storage) {
    const nav = input.nav as string;

    // Forward navigation requires a forward stack, which is not
    // maintained in this basic implementation. Return empty.
    return { variant: 'empty', message: 'No forward history' };
  },

  /**
   * replace(nav, destination, params)
   *   -> ok(nav) | notfound(message)
   */
  async replace(input, storage) {
    const nav = input.nav as string;
    const destination = input.destination as string;
    const params = input.params as string;

    const record = await storage.get(RELATION, nav);
    if (!record) {
      return { variant: 'notfound', message: `Navigator "${nav}" not found` };
    }

    let destinations: Record<string, string>;
    try {
      destinations = JSON.parse(record.destinations as string) as Record<string, string>;
    } catch {
      destinations = {};
    }

    if (!(destination in destinations)) {
      return {
        variant: 'notfound',
        message: `Destination "${destination}" is not registered`,
      };
    }

    // Replace current without pushing history
    await storage.put(RELATION, nav, {
      ...record,
      current: destination,
      params,
    });

    return { variant: 'ok', nav };
  },

  /**
   * reset(nav, destination, params)
   *   -> ok(nav) | notfound(message)
   */
  async reset(input, storage) {
    const nav = input.nav as string;
    const destination = input.destination as string;
    const params = input.params as string;

    const record = await storage.get(RELATION, nav);
    if (!record) {
      return { variant: 'notfound', message: `Navigator "${nav}" not found` };
    }

    let destinations: Record<string, string>;
    try {
      destinations = JSON.parse(record.destinations as string) as Record<string, string>;
    } catch {
      destinations = {};
    }

    if (!(destination in destinations)) {
      return {
        variant: 'notfound',
        message: `Destination "${destination}" is not registered`,
      };
    }

    // Clear history and navigate
    await storage.put(RELATION, nav, {
      ...record,
      current: destination,
      params,
      history: '[]',
      depth: 0,
    });

    return { variant: 'ok', nav };
  },

  /**
   * addGuard(nav, guard) -> ok(nav) | invalid(message)
   */
  async addGuard(input, storage) {
    const nav = input.nav as string;
    const guard = input.guard as string;

    const record = await storage.get(RELATION, nav);
    if (!record) {
      return { variant: 'invalid', message: `Navigator "${nav}" not found` };
    }

    let parsedGuard: Record<string, unknown>;
    try {
      parsedGuard = JSON.parse(guard) as Record<string, unknown>;
    } catch {
      return { variant: 'invalid', message: 'Guard spec is not valid JSON' };
    }

    let guards: Array<Record<string, unknown>>;
    try {
      guards = JSON.parse(record.guards as string) as Array<Record<string, unknown>>;
    } catch {
      guards = [];
    }

    guards.push(parsedGuard);

    await storage.put(RELATION, nav, {
      ...record,
      guards: JSON.stringify(guards),
    });

    return { variant: 'ok', nav };
  },

  /**
   * removeGuard(nav, guard) -> ok(nav) | notfound(message)
   */
  async removeGuard(input, storage) {
    const nav = input.nav as string;
    const guard = input.guard as string;

    const record = await storage.get(RELATION, nav);
    if (!record) {
      return { variant: 'notfound', message: `Navigator "${nav}" not found` };
    }

    let guards: Array<Record<string, unknown>>;
    try {
      guards = JSON.parse(record.guards as string) as Array<Record<string, unknown>>;
    } catch {
      guards = [];
    }

    const beforeLen = guards.length;
    guards = guards.filter(g => JSON.stringify(g) !== guard);

    if (guards.length === beforeLen) {
      return { variant: 'notfound', message: 'Guard not found' };
    }

    await storage.put(RELATION, nav, {
      ...record,
      guards: JSON.stringify(guards),
    });

    return { variant: 'ok', nav };
  },

  /**
   * canGo(nav, destination) -> ok(nav, allowed) | notfound(message)
   */
  async canGo(input, storage) {
    const nav = input.nav as string;
    const destination = input.destination as string;

    const record = await storage.get(RELATION, nav);
    if (!record) {
      return { variant: 'notfound', message: `Navigator "${nav}" not found` };
    }

    let destinations: Record<string, string>;
    try {
      destinations = JSON.parse(record.destinations as string) as Record<string, string>;
    } catch {
      destinations = {};
    }

    if (!(destination in destinations)) {
      return {
        variant: 'notfound',
        message: `Destination "${destination}" is not registered`,
      };
    }

    // Check guards
    let guards: Array<{ destination?: string; condition?: string }>;
    try {
      guards = JSON.parse(record.guards as string) as Array<{ destination?: string; condition?: string }>;
    } catch {
      guards = [];
    }

    for (const guard of guards) {
      if (guard.destination === destination && guard.condition === 'block') {
        return {
          variant: 'ok',
          nav,
          allowed: JSON.stringify({ allowed: false, reason: 'Guard blocked transition' }),
        };
      }
    }

    return {
      variant: 'ok',
      nav,
      allowed: JSON.stringify({ allowed: true, reason: '' }),
    };
  },
};
