// Navigator Concept Implementation [N]
// Client-side navigation with route registration, history stack, guards, and programmatic navigation.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

export const navigatorHandler: ConceptHandler = {
  async register(input, storage) {
    const nav = input.nav as string;
    const name = input.name as string;
    const targetConcept = input.targetConcept as string;
    const targetView = input.targetView as string;
    const paramsSchema = input.paramsSchema as string;
    const meta = input.meta as string;

    const id = nav || nextId('N');

    const existing = await storage.get('navigator', id);
    if (existing) {
      // Check for duplicate destination name
      const destinations: Array<Record<string, unknown>> = JSON.parse((existing.destinations as string) || '[]');
      if (destinations.some(d => d.name === name)) {
        return { variant: 'duplicate', message: `Destination "${name}" already registered` };
      }

      destinations.push({
        name,
        targetConcept,
        targetView,
        paramsSchema: paramsSchema || '',
        meta: meta || '',
      });

      await storage.put('navigator', id, {
        ...existing,
        destinations: JSON.stringify(destinations),
      });
    } else {
      await storage.put('navigator', id, {
        destinations: JSON.stringify([{
          name,
          targetConcept,
          targetView,
          paramsSchema: paramsSchema || '',
          meta: meta || '',
        }]),
        name,
        targetConcept,
        targetView,
        paramsSchema: paramsSchema || '',
        meta: meta || '',
        current: '',
        history: JSON.stringify([]),
        forwardStack: JSON.stringify([]),
        guards: JSON.stringify([]),
      });
    }

    return { variant: 'ok', nav: id };
  },

  async go(input, storage) {
    const nav = input.nav as string;
    const params = input.params as string;

    const existing = await storage.get('navigator', nav);
    if (!existing) {
      return { variant: 'notfound', message: `Navigator "${nav}" not found` };
    }

    let parsedParams: Record<string, unknown>;
    try {
      parsedParams = JSON.parse(params);
    } catch {
      parsedParams = { destination: params };
    }

    const destinationName = parsedParams.destination as string;
    const destinations: Array<Record<string, unknown>> = JSON.parse((existing.destinations as string) || '[]');

    if (destinationName && !destinations.some(d => d.name === destinationName)) {
      return { variant: 'notfound', message: `Destination "${destinationName}" not found` };
    }

    // Check guards
    const guards: string[] = JSON.parse((existing.guards as string) || '[]');
    for (const guard of guards) {
      // Guards block navigation if they match certain patterns
      if (guard === 'block-all') {
        return { variant: 'blocked', message: `Navigation blocked by guard "${guard}"` };
      }
    }

    const previous = existing.current as string;
    const history: string[] = JSON.parse((existing.history as string) || '[]');
    if (previous) {
      history.push(previous);
    }

    await storage.put('navigator', nav, {
      ...existing,
      current: params,
      history: JSON.stringify(history),
      forwardStack: JSON.stringify([]), // Clear forward stack on new navigation
    });

    return { variant: 'ok', previous };
  },

  async back(input, storage) {
    const nav = input.nav as string;

    const existing = await storage.get('navigator', nav);
    if (!existing) {
      return { variant: 'empty', message: `Navigator "${nav}" not found` };
    }

    const history: string[] = JSON.parse((existing.history as string) || '[]');
    if (history.length === 0) {
      return { variant: 'empty', message: 'No history to go back to' };
    }

    const previous = existing.current as string;
    const destination = history.pop()!;

    const forwardStack: string[] = JSON.parse((existing.forwardStack as string) || '[]');
    if (previous) {
      forwardStack.push(previous);
    }

    await storage.put('navigator', nav, {
      ...existing,
      current: destination,
      history: JSON.stringify(history),
      forwardStack: JSON.stringify(forwardStack),
    });

    return { variant: 'ok', previous };
  },

  async forward(input, storage) {
    const nav = input.nav as string;

    const existing = await storage.get('navigator', nav);
    if (!existing) {
      return { variant: 'empty', message: `Navigator "${nav}" not found` };
    }

    const forwardStack: string[] = JSON.parse((existing.forwardStack as string) || '[]');
    if (forwardStack.length === 0) {
      return { variant: 'empty', message: 'No forward history' };
    }

    const previous = existing.current as string;
    const destination = forwardStack.pop()!;

    const history: string[] = JSON.parse((existing.history as string) || '[]');
    if (previous) {
      history.push(previous);
    }

    await storage.put('navigator', nav, {
      ...existing,
      current: destination,
      history: JSON.stringify(history),
      forwardStack: JSON.stringify(forwardStack),
    });

    return { variant: 'ok', previous };
  },

  async replace(input, storage) {
    const nav = input.nav as string;
    const params = input.params as string;

    const existing = await storage.get('navigator', nav);
    if (!existing) {
      return { variant: 'notfound', message: `Navigator "${nav}" not found` };
    }

    const previous = existing.current as string;

    // Replace current entry without adding to history
    await storage.put('navigator', nav, {
      ...existing,
      current: params,
    });

    return { variant: 'ok', previous };
  },

  async addGuard(input, storage) {
    const nav = input.nav as string;
    const guard = input.guard as string;

    const existing = await storage.get('navigator', nav);
    if (!existing) {
      return { variant: 'invalid', message: `Navigator "${nav}" not found` };
    }

    if (!guard) {
      return { variant: 'invalid', message: 'Guard identifier is required' };
    }

    const guards: string[] = JSON.parse((existing.guards as string) || '[]');
    if (!guards.includes(guard)) {
      guards.push(guard);
    }

    await storage.put('navigator', nav, {
      ...existing,
      guards: JSON.stringify(guards),
    });

    return { variant: 'ok' };
  },

  async removeGuard(input, storage) {
    const nav = input.nav as string;
    const guard = input.guard as string;

    const existing = await storage.get('navigator', nav);
    if (!existing) {
      return { variant: 'notfound', message: `Navigator "${nav}" not found` };
    }

    const guards: string[] = JSON.parse((existing.guards as string) || '[]');
    if (!guards.includes(guard)) {
      return { variant: 'notfound', message: `Guard "${guard}" not found` };
    }

    const updated = guards.filter(g => g !== guard);

    await storage.put('navigator', nav, {
      ...existing,
      guards: JSON.stringify(updated),
    });

    return { variant: 'ok' };
  },
};
