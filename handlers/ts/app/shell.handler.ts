// Shell Concept Implementation [S]
// Application shell with named zones, role assignment, and overlay stack management.
import type { ConceptHandler } from '@clef/runtime';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

export const shellHandler: ConceptHandler = {
  async initialize(input, storage) {
    const shell = input.shell as string;
    const zones = input.zones as string;

    let zoneList: string[];
    try {
      zoneList = JSON.parse(zones);
    } catch {
      return { variant: 'invalid', message: 'Zones must be a JSON array of zone names' };
    }

    if (!Array.isArray(zoneList) || zoneList.length === 0) {
      return { variant: 'invalid', message: 'At least one zone must be defined' };
    }

    const id = shell || nextId('S');

    // Initialize zones with empty refs
    const zoneMap: Record<string, string> = {};
    const zoneRole: Record<string, string> = {};
    for (const zone of zoneList) {
      zoneMap[zone] = '';
      zoneRole[zone] = 'content';
    }

    await storage.put('shell', id, {
      zones: JSON.stringify(zoneMap),
      zoneRole: JSON.stringify(zoneRole),
      activeOverlays: JSON.stringify([]),
      status: 'initialized',
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
