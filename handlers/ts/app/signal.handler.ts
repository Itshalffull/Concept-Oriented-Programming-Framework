// Signal Concept Implementation [G]
// Reactive signals with state, computed, and effect kinds for fine-grained reactivity.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const VALID_KINDS = ['state', 'computed', 'effect'];

export const signalHandler: ConceptHandler = {
  async create(input, storage) {
    const signal = input.signal as string;
    const kind = input.kind as string;
    const initialValue = input.initialValue as string;

    if (!VALID_KINDS.includes(kind)) {
      return { variant: 'invalid', message: `Invalid signal kind "${kind}". Valid kinds: ${VALID_KINDS.join(', ')}` };
    }

    const id = signal || nextId('G');

    await storage.put('signal', id, {
      value: initialValue ?? '',
      kind,
      dependencies: JSON.stringify([]),
      subscribers: JSON.stringify([]),
      version: 1,
    });

    return { variant: 'ok', signal: id };
  },

  async read(input, storage) {
    const signal = input.signal as string;

    const existing = await storage.get('signal', signal);
    if (!existing) {
      return { variant: 'notfound', message: `Signal "${signal}" not found` };
    }

    return {
      variant: 'ok',
      value: existing.value as string,
      version: existing.version as number,
    };
  },

  async write(input, storage) {
    const signal = input.signal as string;
    const value = input.value as string;

    const existing = await storage.get('signal', signal);
    if (!existing) {
      return { variant: 'notfound', message: `Signal "${signal}" not found` };
    }

    const kind = existing.kind as string;
    if (kind === 'computed') {
      return { variant: 'readonly', message: 'Cannot write to a computed signal' };
    }

    if (kind === 'effect') {
      return { variant: 'readonly', message: 'Cannot write to an effect signal' };
    }

    const newVersion = (existing.version as number) + 1;

    await storage.put('signal', signal, {
      ...existing,
      value,
      version: newVersion,
    });

    return { variant: 'ok', version: newVersion };
  },

  async batch(input, storage) {
    const signals = input.signals as string;

    let updates: Array<{ signal: string; value: string }>;
    try {
      updates = JSON.parse(signals);
    } catch {
      return { variant: 'partial', message: 'Invalid signals batch format', count: 0 };
    }

    let successCount = 0;
    const failures: string[] = [];

    for (const update of updates) {
      const existing = await storage.get('signal', update.signal);
      if (!existing) {
        failures.push(update.signal);
        continue;
      }

      const kind = existing.kind as string;
      if (kind !== 'state') {
        failures.push(update.signal);
        continue;
      }

      const newVersion = (existing.version as number) + 1;
      await storage.put('signal', update.signal, {
        ...existing,
        value: update.value,
        version: newVersion,
      });
      successCount++;
    }

    if (failures.length > 0) {
      return { variant: 'partial', count: successCount, failures: JSON.stringify(failures) };
    }

    return { variant: 'ok', count: successCount };
  },

  async dispose(input, storage) {
    const signal = input.signal as string;

    const existing = await storage.get('signal', signal);
    if (!existing) {
      return { variant: 'notfound', message: `Signal "${signal}" not found` };
    }

    await storage.put('signal', signal, {
      ...existing,
      value: '',
      dependencies: JSON.stringify([]),
      subscribers: JSON.stringify([]),
      _disposed: true,
    });

    return { variant: 'ok' };
  },
};
