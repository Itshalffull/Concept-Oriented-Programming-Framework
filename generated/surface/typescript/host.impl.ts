// Host Concept Implementation
// Widget tree lifecycle orchestrator — implements surface.auto().
import type { ConceptHandler } from '../../../runtime/types.js';

const RELATION = 'host';

const VALID_STATUSES = ['created', 'loading', 'hydrating', 'interactive', 'error', 'unmounted'] as const;

export const hostHandler: ConceptHandler = {
  /**
   * mount(host, config)
   *   -> ok(host) | error(message)
   */
  async mount(input, storage) {
    const host = input.host as string;
    const config = input.config as string;

    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(config) as Record<string, unknown>;
    } catch {
      return { variant: 'error', message: 'Config is not valid JSON' };
    }

    const concept = (parsedConfig.concept as string) ?? '';
    const view = (parsedConfig.view as string) ?? 'default';
    const zone = (parsedConfig.zone as string) ?? null;

    if (!concept) {
      return { variant: 'error', message: 'Config must include a "concept" URN' };
    }

    await storage.put(RELATION, host, {
      host,
      concept,
      view,
      zone,
      status: 'loading',
      binding: null,
      machines: '[]',
      errorInfo: null,
      config,
    });

    return { variant: 'ok', host };
  },

  /**
   * unmount(host)
   *   -> ok(host) | notfound(message)
   */
  async unmount(input, storage) {
    const host = input.host as string;

    const record = await storage.get(RELATION, host);
    if (!record) {
      return { variant: 'notfound', message: `Host "${host}" does not exist` };
    }

    await storage.put(RELATION, host, {
      ...record,
      status: 'unmounted',
      machines: '[]',
      binding: null,
    });

    return { variant: 'ok', host };
  },

  /**
   * refresh(host)
   *   -> ok(host) | error(message)
   */
  async refresh(input, storage) {
    const host = input.host as string;

    const record = await storage.get(RELATION, host);
    if (!record) {
      return { variant: 'error', message: `Host "${host}" does not exist` };
    }

    if (record.status === 'unmounted' || record.status === 'error') {
      return {
        variant: 'error',
        message: `Cannot refresh host in "${record.status}" state`,
      };
    }

    // In a real runtime, this triggers Transport/fetch → Signal/batch.
    // For the concept implementation, we just confirm the refresh.
    return { variant: 'ok', host };
  },

  /**
   * setError(host, errorInfo)
   *   -> ok(host) | notfound(message)
   */
  async setError(input, storage) {
    const host = input.host as string;
    const errorInfo = input.errorInfo as string;

    const record = await storage.get(RELATION, host);
    if (!record) {
      return { variant: 'notfound', message: `Host "${host}" does not exist` };
    }

    await storage.put(RELATION, host, {
      ...record,
      status: 'error',
      errorInfo,
    });

    return { variant: 'ok', host };
  },

  /**
   * updateConfig(host, config)
   *   -> ok(host) | notfound(message)
   */
  async updateConfig(input, storage) {
    const host = input.host as string;
    const config = input.config as string;

    const record = await storage.get(RELATION, host);
    if (!record) {
      return { variant: 'notfound', message: `Host "${host}" does not exist` };
    }

    // Handle addMachine shorthand from HostTracksMachines sync
    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(config) as Record<string, unknown>;
    } catch {
      parsedConfig = {};
    }

    let machines: string[];
    try {
      machines = JSON.parse(record.machines as string) as string[];
    } catch {
      machines = [];
    }

    if (parsedConfig.addMachine) {
      machines.push(parsedConfig.addMachine as string);
      await storage.put(RELATION, host, {
        ...record,
        machines: JSON.stringify(machines),
      });
    } else {
      // General config update
      const concept = (parsedConfig.concept as string) ?? record.concept;
      const view = (parsedConfig.view as string) ?? record.view;

      await storage.put(RELATION, host, {
        ...record,
        concept,
        view,
        config,
      });
    }

    return { variant: 'ok', host };
  },
};
