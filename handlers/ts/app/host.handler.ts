// Host Concept Implementation [W]
// Mounts concepts into UI views with lifecycle management, zone placement, and resource tracking.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const VALID_STATUSES = ['idle', 'mounting', 'mounted', 'ready', 'error', 'unmounted'];

export const hostHandler: ConceptHandler = {
  async mount(input, storage) {
    const host = input.host as string;
    const concept = input.concept as string;
    const view = input.view as string;
    const level = input.level as string;
    const zone = input.zone as string;

    if (!concept || !view) {
      return { variant: 'invalid', message: 'Both concept and view are required for mounting' };
    }

    const id = host || nextId('W');

    await storage.put('host', id, {
      concept,
      view,
      level: level || 'page',
      zone: zone || 'main',
      status: 'mounted',
      binding: '',
      machines: JSON.stringify([]),
      errorInfo: JSON.stringify(null),
    });

    return { variant: 'ok', host: id };
  },

  async ready(input, storage) {
    const host = input.host as string;

    const existing = await storage.get('host', host);
    if (!existing) {
      return { variant: 'invalid', message: `Host "${host}" not found` };
    }

    const status = existing.status as string;
    if (status !== 'mounted') {
      return { variant: 'invalid', message: `Host must be in "mounted" status to become ready, currently "${status}"` };
    }

    await storage.put('host', host, {
      ...existing,
      status: 'ready',
    });

    return { variant: 'ok' };
  },

  async trackResource(input, storage) {
    const host = input.host as string;
    const kind = input.kind as string;
    const ref = input.ref as string;

    const existing = await storage.get('host', host);
    if (!existing) {
      return { variant: 'notfound', message: `Host "${host}" not found` };
    }

    const machines: Array<{ kind: string; ref: string }> = JSON.parse((existing.machines as string) || '[]');
    machines.push({ kind, ref });

    await storage.put('host', host, {
      ...existing,
      machines: JSON.stringify(machines),
    });

    return { variant: 'ok' };
  },

  async unmount(input, storage) {
    const host = input.host as string;

    const existing = await storage.get('host', host);
    if (!existing) {
      return { variant: 'notfound', message: `Host "${host}" not found` };
    }

    const machines = existing.machines as string;
    const binding = existing.binding as string;

    await storage.put('host', host, {
      ...existing,
      status: 'unmounted',
      binding: '',
      machines: JSON.stringify([]),
      errorInfo: JSON.stringify(null),
    });

    return {
      variant: 'ok',
      machines,
      binding,
    };
  },

  async refresh(input, storage) {
    const host = input.host as string;

    const existing = await storage.get('host', host);
    if (!existing) {
      return { variant: 'notfound', message: `Host "${host}" not found` };
    }

    const status = existing.status as string;
    if (status !== 'ready' && status !== 'mounted') {
      return { variant: 'invalid', message: `Cannot refresh host in "${status}" status` };
    }

    await storage.put('host', host, {
      ...existing,
      status: 'mounted',
    });

    return { variant: 'ok' };
  },

  async setError(input, storage) {
    const host = input.host as string;
    const errorInfo = input.errorInfo as string;

    const existing = await storage.get('host', host);
    if (!existing) {
      return { variant: 'notfound', message: `Host "${host}" not found` };
    }

    await storage.put('host', host, {
      ...existing,
      status: 'error',
      errorInfo: typeof errorInfo === 'string' ? errorInfo : JSON.stringify(errorInfo),
    });

    return { variant: 'ok' };
  },
};
