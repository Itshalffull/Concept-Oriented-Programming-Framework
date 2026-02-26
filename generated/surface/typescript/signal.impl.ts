// Signal Concept Implementation
// Reactive state container with versioned reads and writes.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'signal';

const VALID_KINDS = ['state', 'computed', 'effect'] as const;

export const signalHandler: ConceptHandler = {
  /**
   * create(signal, kind, initialValue) -> ok(signal) | invalid(message)
   * Creates a new signal with an initial value after validating the kind.
   */
  async create(input, storage) {
    const signal = input.signal as string;
    const kind = input.kind as string;
    const initialValue = input.initialValue as string;

    if (!VALID_KINDS.includes(kind as typeof VALID_KINDS[number])) {
      return {
        variant: 'invalid',
        message: `Invalid signal kind "${kind}". Valid kinds: ${VALID_KINDS.join(', ')}`,
      };
    }

    await storage.put(RELATION, signal, {
      signal,
      value: initialValue,
      kind,
      dependencies: '[]',
      subscribers: '[]',
      version: 1,
    });

    return { variant: 'ok', signal };
  },

  /**
   * read(signal) -> ok(signal, value, version) | notfound(message)
   * Reads the current value and version of a signal.
   */
  async read(input, storage) {
    const signal = input.signal as string;

    const existing = await storage.get(RELATION, signal);
    if (!existing) {
      return { variant: 'notfound', message: `Signal "${signal}" does not exist` };
    }

    return {
      variant: 'ok',
      signal,
      value: existing.value as string,
      version: existing.version as number,
    };
  },

  /**
   * write(signal, value) -> ok(signal, version) | readonly(message) | notfound(message)
   * Updates the value of a signal and increments its version.
   * Computed signals are read-only and cannot be written to.
   */
  async write(input, storage) {
    const signal = input.signal as string;
    const value = input.value as string;

    const existing = await storage.get(RELATION, signal);
    if (!existing) {
      return { variant: 'notfound', message: `Signal "${signal}" does not exist` };
    }

    if (existing.kind === 'computed') {
      return {
        variant: 'readonly',
        message: `Signal "${signal}" is computed and cannot be written to directly`,
      };
    }

    const newVersion = (existing.version as number) + 1;

    await storage.put(RELATION, signal, {
      ...existing,
      value,
      version: newVersion,
    });

    return { variant: 'ok', signal, version: newVersion };
  },

  /**
   * batch(signals) -> ok(count) | partial(message, succeeded, failed)
   * Parses a JSON array of {signal, value} entries and applies updates in batch.
   * Reports partial success if some updates fail.
   */
  async batch(input, storage) {
    const signalsStr = input.signals as string;

    let entries: { signal: string; value: string }[];
    try {
      entries = JSON.parse(signalsStr);
    } catch {
      return {
        variant: 'partial',
        message: 'Failed to parse signals JSON. Expected array of {signal, value} objects.',
        succeeded: 0,
        failed: 1,
      };
    }

    if (!Array.isArray(entries)) {
      return {
        variant: 'partial',
        message: 'Signals input must be a JSON array.',
        succeeded: 0,
        failed: 1,
      };
    }

    let succeeded = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const entry of entries) {
      const sig = entry.signal;
      const val = entry.value;

      if (!sig || val === undefined) {
        failed++;
        errors.push('Entry missing signal or value field');
        continue;
      }

      const existing = await storage.get(RELATION, sig);
      if (!existing) {
        failed++;
        errors.push(`Signal "${sig}" not found`);
        continue;
      }

      if (existing.kind === 'computed') {
        failed++;
        errors.push(`Signal "${sig}" is computed and read-only`);
        continue;
      }

      const newVersion = (existing.version as number) + 1;
      await storage.put(RELATION, sig, {
        ...existing,
        value: val,
        version: newVersion,
      });
      succeeded++;
    }

    if (failed > 0) {
      return {
        variant: 'partial',
        message: `Batch partially applied: ${errors.join('; ')}`,
        succeeded,
        failed,
      };
    }

    return { variant: 'ok', count: succeeded };
  },

  /**
   * dispose(signal) -> ok(signal) | notfound(message)
   * Removes a signal and cleans up its storage entry.
   */
  async dispose(input, storage) {
    const signal = input.signal as string;

    const existing = await storage.get(RELATION, signal);
    if (!existing) {
      return { variant: 'notfound', message: `Signal "${signal}" does not exist` };
    }

    await storage.del(RELATION, signal);
    return { variant: 'ok', signal };
  },
};
