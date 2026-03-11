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

  async adapt(input, storage) {
    const shell = input.shell as string;
    const config = input.config as string;

    const existing = await storage.get('shell', shell);
    if (!existing) {
      return { variant: 'notfound', message: `Shell "${shell}" not found` };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(config);
    } catch {
      return { variant: 'invalid', message: 'Shell config must be valid JSON' };
    }

    let zoneDefs: Array<{ name: string; role?: string }> = [];
    if (Array.isArray(parsed)) {
      zoneDefs = parsed.map((name) => ({ name: String(name) }));
    } else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { zones?: unknown[] }).zones)) {
      zoneDefs = ((parsed as { zones: unknown[] }).zones).map((zone) => {
        if (typeof zone === 'string') {
          return { name: zone };
        }
        const value = zone as { name?: unknown; role?: unknown };
        return { name: String(value.name ?? ''), role: value.role ? String(value.role) : undefined };
      });
    } else {
      return { variant: 'invalid', message: 'Shell config must provide a zones array' };
    }

    if (zoneDefs.length === 0 || zoneDefs.some((zone) => !zone.name)) {
      return { variant: 'invalid', message: 'Shell config must include at least one named zone' };
    }

    const currentZones: Record<string, string> = JSON.parse(existing.zones as string);
    const zoneMap: Record<string, string> = {};
    const zoneRole: Record<string, string> = {};

    for (const zone of zoneDefs) {
      zoneMap[zone.name] = currentZones[zone.name] ?? '';
      zoneRole[zone.name] = zone.role ?? 'content';
    }

    await storage.put('shell', shell, {
      ...existing,
      zones: JSON.stringify(zoneMap),
      zoneRole: JSON.stringify(zoneRole),
      status: 'adapted',
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
