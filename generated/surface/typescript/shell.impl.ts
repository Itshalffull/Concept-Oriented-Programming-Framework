// Shell Concept Implementation
// Root app composition with semantic zone roles and overlays.
import type { ConceptHandler } from '../../../kernel/src/types.js';

const RELATION = 'shell';

const VALID_GLOBAL_STATES = ['initializing', 'ready', 'locked', 'error'] as const;

export const shellHandler: ConceptHandler = {
  /**
   * initialize(shell, config)
   *   -> ok(shell) | error(message)
   */
  async initialize(input, storage) {
    const shell = input.shell as string;
    const config = input.config as string;

    let parsedConfig: Record<string, unknown>;
    try {
      parsedConfig = JSON.parse(config) as Record<string, unknown>;
    } catch {
      return { variant: 'error', message: 'Config is not valid JSON' };
    }

    const zones = parsedConfig.zones as Array<{ name: string; role: string }> | undefined;
    if (!zones || !Array.isArray(zones) || zones.length === 0) {
      return { variant: 'error', message: 'Config must include at least one zone' };
    }

    // Build zone definitions and empty zone-host map
    const zoneHosts: Record<string, string | null> = {};
    for (const zone of zones) {
      zoneHosts[zone.name] = null;
    }

    await storage.put(RELATION, shell, {
      shell,
      zones: JSON.stringify(zones),
      zoneHosts: JSON.stringify(zoneHosts),
      globalState: 'ready',
      overlays: '[]',
      platform: 'browser', // Default; PlatformAdapter overrides
      config,
    });

    return { variant: 'ok', shell };
  },

  /**
   * assignHost(shell, zone, host)
   *   -> ok(shell) | notfound(message) | occupied(message)
   */
  async assignHost(input, storage) {
    const shell = input.shell as string;
    const zone = input.zone as string;
    const host = input.host as string;

    const record = await storage.get(RELATION, shell);
    if (!record) {
      return { variant: 'notfound', message: `Shell "${shell}" does not exist` };
    }

    let zones: Array<{ name: string; role: string }>;
    try {
      zones = JSON.parse(record.zones as string) as Array<{ name: string; role: string }>;
    } catch {
      zones = [];
    }

    const zoneDef = zones.find(z => z.name === zone);
    if (!zoneDef) {
      return { variant: 'notfound', message: `Zone "${zone}" is not defined` };
    }

    let zoneHosts: Record<string, string | null>;
    try {
      zoneHosts = JSON.parse(record.zoneHosts as string) as Record<string, string | null>;
    } catch {
      zoneHosts = {};
    }

    // Persistent zones reject if occupied
    if (zoneDef.role === 'persistent' && zoneHosts[zone]) {
      return {
        variant: 'occupied',
        message: `Persistent zone "${zone}" already has host "${zoneHosts[zone]}"`,
      };
    }

    // Navigated zones replace the current host
    zoneHosts[zone] = host;

    await storage.put(RELATION, shell, {
      ...record,
      zoneHosts: JSON.stringify(zoneHosts),
    });

    return { variant: 'ok', shell };
  },

  /**
   * removeHost(shell, zone)
   *   -> ok(shell) | notfound(message)
   */
  async removeHost(input, storage) {
    const shell = input.shell as string;
    const zone = input.zone as string;

    const record = await storage.get(RELATION, shell);
    if (!record) {
      return { variant: 'notfound', message: `Shell "${shell}" does not exist` };
    }

    let zoneHosts: Record<string, string | null>;
    try {
      zoneHosts = JSON.parse(record.zoneHosts as string) as Record<string, string | null>;
    } catch {
      zoneHosts = {};
    }

    if (!(zone in zoneHosts) || !zoneHosts[zone]) {
      return {
        variant: 'notfound',
        message: `Zone "${zone}" is empty or not defined`,
      };
    }

    zoneHosts[zone] = null;

    await storage.put(RELATION, shell, {
      ...record,
      zoneHosts: JSON.stringify(zoneHosts),
    });

    return { variant: 'ok', shell };
  },

  /**
   * pushOverlay(shell, overlay, host)
   *   -> ok(shell) | error(message)
   */
  async pushOverlay(input, storage) {
    const shell = input.shell as string;
    const overlay = input.overlay as string;
    const host = input.host as string;

    const record = await storage.get(RELATION, shell);
    if (!record) {
      return { variant: 'error', message: `Shell "${shell}" does not exist` };
    }

    let overlays: string[];
    try {
      overlays = JSON.parse(record.overlays as string) as string[];
    } catch {
      overlays = [];
    }

    overlays.push(JSON.stringify({ overlay, host }));

    await storage.put(RELATION, shell, {
      ...record,
      overlays: JSON.stringify(overlays),
    });

    return { variant: 'ok', shell };
  },

  /**
   * popOverlay(shell)
   *   -> ok(shell, overlay) | empty(message)
   */
  async popOverlay(input, storage) {
    const shell = input.shell as string;

    const record = await storage.get(RELATION, shell);
    if (!record) {
      return { variant: 'empty', message: `Shell "${shell}" does not exist` };
    }

    let overlays: string[];
    try {
      overlays = JSON.parse(record.overlays as string) as string[];
    } catch {
      overlays = [];
    }

    if (overlays.length === 0) {
      return { variant: 'empty', message: 'No overlays active' };
    }

    const popped = overlays.pop()!;

    await storage.put(RELATION, shell, {
      ...record,
      overlays: JSON.stringify(overlays),
    });

    return { variant: 'ok', shell, overlay: popped };
  },

  /**
   * setGlobalState(shell, state)
   *   -> ok(shell) | invalid(message)
   */
  async setGlobalState(input, storage) {
    const shell = input.shell as string;
    const state = input.state as string;

    const record = await storage.get(RELATION, shell);
    if (!record) {
      return { variant: 'invalid', message: `Shell "${shell}" does not exist` };
    }

    if (!VALID_GLOBAL_STATES.includes(state as typeof VALID_GLOBAL_STATES[number])) {
      return {
        variant: 'invalid',
        message: `Invalid state "${state}". Valid states: ${VALID_GLOBAL_STATES.join(', ')}`,
      };
    }

    await storage.put(RELATION, shell, {
      ...record,
      globalState: state,
    });

    return { variant: 'ok', shell };
  },

  /**
   * destroy(shell)
   *   -> ok(shell) | notfound(message)
   */
  async destroy(input, storage) {
    const shell = input.shell as string;

    const record = await storage.get(RELATION, shell);
    if (!record) {
      return { variant: 'notfound', message: `Shell "${shell}" does not exist` };
    }

    await storage.del(RELATION, shell);

    return { variant: 'ok', shell };
  },
};
