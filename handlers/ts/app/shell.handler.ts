// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Shell Concept Implementation [S]
// Application shell with named zones, role assignment, and overlay stack management.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, put, putFrom, branch, complete,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

let counter = 0;
function nextId(prefix: string) { return prefix + '-' + (++counter); }

const _shellHandler: FunctionalConceptHandler = {
  initialize(input: Record<string, unknown>) {
    if (!input.zones || (typeof input.zones === 'string' && (input.zones as string).trim() === '')) {
      return complete(createProgram(), 'invalid', { message: 'zones is required' }) as StorageProgram<Result>;
    }
    const shell = input.shell as string;
    const zones = input.zones as string;

    let parsedZones: unknown;
    try { parsedZones = JSON.parse(zones); } catch {
      let p = createProgram();
      return complete(p, 'invalid', { message: 'Zones must be valid JSON' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const zoneEntries = Array.isArray(parsedZones) ? parsedZones
      : (typeof parsedZones === 'object' && parsedZones !== null && Array.isArray((parsedZones as { zones?: unknown[] }).zones))
        ? (parsedZones as { zones: unknown[] }).zones : null;

    if (!zoneEntries || zoneEntries.length === 0) {
      let p = createProgram();
      return complete(p, 'invalid', { message: 'At least one zone must be defined' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    const id = shell || nextId('S');
    const zoneMap: Record<string, string> = {};
    const zoneRole: Record<string, string> = {};
    for (const entry of zoneEntries) {
      const zone = typeof entry === 'string' ? { name: entry, role: 'content' } : entry;
      const name = typeof zone === 'object' && zone !== null ? String((zone as { name?: unknown }).name ?? '') : '';
      const role = typeof zone === 'object' && zone !== null ? String((zone as { role?: unknown }).role ?? 'content') : 'content';
      if (!name) {
        let p = createProgram();
        return complete(p, 'invalid', { message: 'Each zone must have a name' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
      }
      zoneMap[name] = '';
      zoneRole[name] = role;
    }

    let p = createProgram();
    p = put(p, 'shell', id, { zones: JSON.stringify(zoneMap), zoneRole: JSON.stringify(zoneRole), activeOverlays: JSON.stringify([]), status: 'ready' });
    return complete(p, 'ok', { shell: id }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  assignToZone(input: Record<string, unknown>) {
    const shell = input.shell as string;
    const zone = input.zone as string;
    const ref = input.ref as string;

    let p = createProgram();
    p = spGet(p, 'shell', shell, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'shell', shell, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const zones: Record<string, string> = JSON.parse(existing.zones as string);
          if (!(zone in zones)) return existing; // zone not found handled below
          zones[zone] = ref;
          return { ...existing, zones: JSON.stringify(zones) };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Shell "${shell}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  adapt(input: Record<string, unknown>) {
    const shell = input.shell as string;
    const config = input.config as string;

    let p = createProgram();
    p = spGet(p, 'shell', shell, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let parsed: unknown;
        try { parsed = JSON.parse(config); } catch {
          return complete(b, 'invalid', { message: 'Shell config must be valid JSON' });
        }

        let zoneDefs: Array<{ name: string; role?: string }> = [];
        if (Array.isArray(parsed)) { zoneDefs = parsed.map((name) => ({ name: String(name) })); }
        else if (parsed && typeof parsed === 'object' && Array.isArray((parsed as { zones?: unknown[] }).zones)) {
          zoneDefs = ((parsed as { zones: unknown[] }).zones).map((zone) => {
            if (typeof zone === 'string') return { name: zone };
            const value = zone as { name?: unknown; role?: unknown };
            return { name: String(value.name ?? ''), role: value.role ? String(value.role) : undefined };
          });
        } else { return complete(b, 'invalid', { message: 'Shell config must provide a zones array' }); }

        if (zoneDefs.length === 0 || zoneDefs.some((zone) => !zone.name)) {
          return complete(b, 'invalid', { message: 'Shell config must include at least one named zone' });
        }

        let b2 = putFrom(b, 'shell', shell, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const currentZones: Record<string, string> = JSON.parse(existing.zones as string);
          const zoneMap: Record<string, string> = {};
          const zoneRole: Record<string, string> = {};
          for (const zone of zoneDefs) {
            zoneMap[zone.name] = currentZones[zone.name] ?? '';
            zoneRole[zone.name] = zone.role ?? 'content';
          }
          return { ...existing, zones: JSON.stringify(zoneMap), zoneRole: JSON.stringify(zoneRole), status: 'adapted' };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Shell "${shell}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  clearZone(input: Record<string, unknown>) {
    const shell = input.shell as string;
    const zone = input.zone as string;

    let p = createProgram();
    p = spGet(p, 'shell', shell, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'shell', shell, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const zones: Record<string, string> = JSON.parse(existing.zones as string);
          if (!(zone in zones)) return existing;
          zones[zone] = '';
          return { ...existing, zones: JSON.stringify(zones) };
        });
        return complete(b2, 'ok', { previous: '' });
      },
      (b) => complete(b, 'notfound', { message: `Shell "${shell}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  pushOverlay(input: Record<string, unknown>) {
    const shell = input.shell as string;
    const ref = input.ref as string;

    if (!ref) {
      let p = createProgram();
      return complete(p, 'invalid', { message: 'Overlay ref is required' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
    }

    let p = createProgram();
    p = spGet(p, 'shell', shell, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'shell', shell, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const overlays: string[] = JSON.parse((existing.activeOverlays as string) || '[]');
          overlays.push(ref);
          return { ...existing, activeOverlays: JSON.stringify(overlays) };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'invalid', { message: `Shell "${shell}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  popOverlay(input: Record<string, unknown>) {
    const shell = input.shell as string;

    let p = createProgram();
    p = spGet(p, 'shell', shell, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'shell', shell, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const overlays: string[] = JSON.parse((existing.activeOverlays as string) || '[]');
          if (overlays.length === 0) return existing;
          overlays.pop();
          return { ...existing, activeOverlays: JSON.stringify(overlays) };
        });
        return complete(b2, 'ok', { overlay: '' });
      },
      (b) => complete(b, 'empty', { message: `Shell "${shell}" not found` }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const shellHandler = autoInterpret(_shellHandler);

