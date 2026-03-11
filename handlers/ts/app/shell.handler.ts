// Shell Concept Implementation [S]
// Application shell with named zones, role assignment, and overlay stack management.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

export const shellHandler: ConceptHandler = {
  async initialize(input, storage) {
    const shell = input.shell as string;
    const zones = input.zones as string;

    let parsedZones: unknown;
    try {
      parsedZones = JSON.parse(zones);
    } catch {
      return { variant: 'invalid', message: 'Zones must be valid JSON' };
    }

    const zoneEntries = Array.isArray(parsedZones)
      ? parsedZones
      : (typeof parsedZones === 'object' &&
          parsedZones !== null &&
          Array.isArray((parsedZones as { zones?: unknown[] }).zones))
        ? (parsedZones as { zones: unknown[] }).zones
        : null;

    if (!zoneEntries || zoneEntries.length === 0) {
      return { variant: 'invalid', message: 'At least one zone must be defined' };
    }

    const id = shell || nextId('S');

    // Initialize zones with empty refs
    const zoneMap: Record<string, string> = {};
    const zoneRole: Record<string, string> = {};
    for (const entry of zoneEntries) {
      const zone =
        typeof entry === 'string'
          ? { name: entry, role: 'content' }
          : entry;
      const name = typeof zone === 'object' && zone !== null ? String((zone as { name?: unknown }).name ?? '') : '';
      const role = typeof zone === 'object' && zone !== null ? String((zone as { role?: unknown }).role ?? 'content') : 'content';

      if (!name) {
        return { variant: 'invalid', message: 'Each zone must have a name' };
      }

      zoneMap[name] = '';
      zoneRole[name] = role;
    }

    await storage.put('shell', id, {
      zones: JSON.stringify(zoneMap),
      zoneRole: JSON.stringify(zoneRole),
      activeOverlays: JSON.stringify([]),
      status: 'ready',
    });

    return { variant: 'ok', shell: id };
  },

  async assignToZone(input, storage) {
    const shell = input.shell as string;
    const zone = input.zone as string;
    const ref = input.ref as string;

    const existing = await storage.get('shell', shell);
    if (!existing) {
      return { variant: 'notfound', message: `Shell "${shell}" not found` };
    }

    const zones: Record<string, string> = JSON.parse(existing.zones as string);
    if (!(zone in zones)) {
      return { variant: 'notfound', message: `Zone "${zone}" not found in shell` };
    }

    zones[zone] = ref;

    await storage.put('shell', shell, {
      ...existing,
      zones: JSON.stringify(zones),
    });

    return { variant: 'ok' };
  },

  async clearZone(input, storage) {
    const shell = input.shell as string;
    const zone = input.zone as string;

    const existing = await storage.get('shell', shell);
    if (!existing) {
      return { variant: 'notfound', message: `Shell "${shell}" not found` };
    }

    const zones: Record<string, string> = JSON.parse(existing.zones as string);
    if (!(zone in zones)) {
      return { variant: 'notfound', message: `Zone "${zone}" not found in shell` };
    }

    const previous = zones[zone];
    zones[zone] = '';

    await storage.put('shell', shell, {
      ...existing,
      zones: JSON.stringify(zones),
    });

    return { variant: 'ok', previous };
  },

  async pushOverlay(input, storage) {
    const shell = input.shell as string;
    const ref = input.ref as string;

    const existing = await storage.get('shell', shell);
    if (!existing) {
      return { variant: 'invalid', message: `Shell "${shell}" not found` };
    }

    if (!ref) {
      return { variant: 'invalid', message: 'Overlay ref is required' };
    }

    const overlays: string[] = JSON.parse((existing.activeOverlays as string) || '[]');
    overlays.push(ref);

    await storage.put('shell', shell, {
      ...existing,
      activeOverlays: JSON.stringify(overlays),
    });

    return { variant: 'ok' };
  },

  async popOverlay(input, storage) {
    const shell = input.shell as string;

    const existing = await storage.get('shell', shell);
    if (!existing) {
      return { variant: 'empty', message: `Shell "${shell}" not found` };
    }

    const overlays: string[] = JSON.parse((existing.activeOverlays as string) || '[]');
    if (overlays.length === 0) {
      return { variant: 'empty', message: 'No active overlays to pop' };
    }

    const overlay = overlays.pop()!;

    await storage.put('shell', shell, {
      ...existing,
      activeOverlays: JSON.stringify(overlays),
    });

    return { variant: 'ok', overlay };
  },
};
