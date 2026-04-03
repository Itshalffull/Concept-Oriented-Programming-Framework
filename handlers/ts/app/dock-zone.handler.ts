// @clef-handler style=functional
// DockZone Concept Implementation
// Manages named drop targets where panes can be docked, enforcing rules
// about which content types and how many tabs each zone accepts.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram,
  get,
  find,
  put,
  putFrom,
  branch,
  complete,
  completeFrom,
  mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_EDGES = new Set(['left', 'right', 'top', 'bottom', 'center']);

const _handler: FunctionalConceptHandler = {
  register(input: Record<string, unknown>) {
    const zone = input.zone as string;
    const name = (input.name as string | undefined) ?? '';
    const edge = (input.edge as string | undefined) ?? '';
    const label = (input.label as string | null | undefined) ?? null;

    // Input validation — guard clauses before storage operations
    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!edge || !VALID_EDGES.has(edge)) {
      return complete(createProgram(), 'invalid', { message: 'edge must be one of: left, right, top, bottom, center' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    // Check for duplicate name
    p = find(p, 'zone', { name }, 'existing');
    p = mapBindings(p, (b) => Array.isArray(b.existing) && (b.existing as unknown[]).length > 0, '_isDuplicate');
    return branch(p,
      '_isDuplicate',
      complete(createProgram(), 'duplicate', { message: `A zone with name '${name}' is already registered` }),
      (() => {
        let sub = createProgram();
        sub = put(sub, 'zone', zone, {
          zone,
          name,
          edge,
          label: label ?? null,
          allowedSchemas: null,
          maxTabs: null,
          autoHide: false,
          defaultCollapsed: false,
          contentRef: null,
        });
        return complete(sub, 'ok', { zone });
      })(),
    ) as StorageProgram<Result>;
  },

  dock(input: Record<string, unknown>) {
    const zone = input.zone as string;
    const paneId = (input.paneId as string | undefined) ?? '';

    // Input validation
    if (!paneId || paneId.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'paneId is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'zone', zone, '_zoneRecord');
    p = mapBindings(p, (b) => !b._zoneRecord, '_zoneNotFound');
    p = mapBindings(p, (b) => {
      const r = b._zoneRecord as Record<string, unknown> | null;
      if (!r) return false;
      const maxTabs = r.maxTabs as number | null | undefined;
      const contentRef = r.contentRef as string | null | undefined;
      if (contentRef === paneId) return true; // already docked
      if (maxTabs !== null && maxTabs !== undefined) {
        const currentTabs = contentRef ? 1 : 0;
        if (currentTabs >= maxTabs) return true;
      }
      return false;
    }, '_dockInvalid');
    p = mapBindings(p, (b) => {
      const r = b._zoneRecord as Record<string, unknown> | null;
      if (!r) return '';
      const maxTabs = r.maxTabs as number | null | undefined;
      const contentRef = r.contentRef as string | null | undefined;
      if (contentRef === paneId) return `Pane '${paneId}' is already docked in this zone`;
      if (maxTabs !== null && maxTabs !== undefined) {
        const currentTabs = contentRef ? 1 : 0;
        if (currentTabs >= maxTabs) return `Zone has reached its maxTabs limit of ${maxTabs}`;
      }
      return '';
    }, '_invalidMessage');

    return branch(p,
      '_zoneNotFound',
      complete(createProgram(), 'notfound', { message: `No zone exists with identifier '${zone}'` }),
      branch(createProgram(),
        '_dockInvalid',
        completeFrom(createProgram(), 'invalid', (b) => ({ message: b._invalidMessage as string })),
        (() => {
          let sub = createProgram();
          sub = putFrom(sub, 'zone', zone, (b) => {
            const r = b._zoneRecord as Record<string, unknown>;
            return { ...r, contentRef: paneId };
          });
          return complete(sub, 'ok', { zone });
        })(),
      ),
    ) as StorageProgram<Result>;
  },

  undock(input: Record<string, unknown>) {
    const zone = input.zone as string;
    const paneId = (input.paneId as string | undefined) ?? '';

    let p = createProgram();
    p = get(p, 'zone', zone, '_zoneRecord');
    p = mapBindings(p, (b) => !b._zoneRecord, '_zoneNotFound');
    p = mapBindings(p, (b) => {
      const r = b._zoneRecord as Record<string, unknown> | null;
      if (!r) return false;
      return (r.contentRef as string | null) !== paneId;
    }, '_paneNotDocked');

    return branch(p,
      '_zoneNotFound',
      complete(createProgram(), 'notfound', { message: `No zone exists with identifier '${zone}'` }),
      branch(createProgram(),
        '_paneNotDocked',
        complete(createProgram(), 'notfound', { message: `Pane '${paneId}' is not currently docked in zone '${zone}'` }),
        (() => {
          let sub = createProgram();
          sub = putFrom(sub, 'zone', zone, (b) => {
            const r = b._zoneRecord as Record<string, unknown>;
            return { ...r, contentRef: null };
          });
          return complete(sub, 'ok', { zone });
        })(),
      ),
    ) as StorageProgram<Result>;
  },

  moveTo(input: Record<string, unknown>) {
    const fromZone = input.fromZone as string;
    const toZone = input.toZone as string;
    const paneId = (input.paneId as string | undefined) ?? '';

    let p = createProgram();
    p = get(p, 'zone', fromZone, '_fromRecord');
    p = get(p, 'zone', toZone, '_toRecord');
    p = mapBindings(p, (b) => !b._fromRecord, '_fromNotFound');
    p = mapBindings(p, (b) => !b._toRecord, '_toNotFound');
    p = mapBindings(p, (b) => {
      const fr = b._fromRecord as Record<string, unknown> | null;
      if (!fr) return false;
      return (fr.contentRef as string | null) !== paneId;
    }, '_paneNotInSource');
    p = mapBindings(p, (b) => {
      const tr = b._toRecord as Record<string, unknown> | null;
      if (!tr) return false;
      const maxTabs = tr.maxTabs as number | null | undefined;
      if (maxTabs !== null && maxTabs !== undefined) {
        const currentTabs = tr.contentRef ? 1 : 0;
        if (currentTabs >= maxTabs) return true;
      }
      return false;
    }, '_destInvalid');

    return branch(p,
      '_fromNotFound',
      complete(createProgram(), 'notfound', { message: `Source zone '${fromZone}' does not exist` }),
      branch(createProgram(),
        '_toNotFound',
        complete(createProgram(), 'notfound', { message: `Destination zone '${toZone}' does not exist` }),
        branch(createProgram(),
          '_paneNotInSource',
          complete(createProgram(), 'notfound', { message: `Pane '${paneId}' is not docked in zone '${fromZone}'` }),
          branch(createProgram(),
            '_destInvalid',
            completeFrom(createProgram(), 'invalid', (b) => {
              const tr = b._toRecord as Record<string, unknown>;
              return { message: `Destination zone has reached its maxTabs limit of ${tr.maxTabs}` };
            }),
            (() => {
              let sub = createProgram();
              sub = putFrom(sub, 'zone', fromZone, (b) => {
                const fr = b._fromRecord as Record<string, unknown>;
                return { ...fr, contentRef: null };
              });
              sub = putFrom(sub, 'zone', toZone, (b) => {
                const tr = b._toRecord as Record<string, unknown>;
                return { ...tr, contentRef: paneId };
              });
              return complete(sub, 'ok', { fromZone, toZone });
            })(),
          ),
        ),
      ),
    ) as StorageProgram<Result>;
  },

  setRules(input: Record<string, unknown>) {
    const zone = input.zone as string;
    const allowedSchemasRaw = input.allowedSchemas;
    const maxTabs = input.maxTabs as number | null | undefined;

    // Validate maxTabs: must be > 0 if provided
    if (maxTabs !== null && maxTabs !== undefined && (maxTabs as number) <= 0) {
      return complete(createProgram(), 'invalid', { message: 'maxTabs must be greater than zero' }) as StorageProgram<Result>;
    }

    // Parse allowedSchemas
    let allowedSchemas: string[] | null = null;
    if (allowedSchemasRaw !== null && allowedSchemasRaw !== undefined) {
      if (typeof allowedSchemasRaw === 'string') {
        try {
          const parsed = JSON.parse(allowedSchemasRaw);
          allowedSchemas = Array.isArray(parsed) ? parsed : null;
        } catch {
          allowedSchemas = null;
        }
      } else if (Array.isArray(allowedSchemasRaw)) {
        allowedSchemas = allowedSchemasRaw as string[];
      }
    }

    const resolvedAllowedSchemas = allowedSchemas;

    let p = createProgram();
    p = get(p, 'zone', zone, '_zoneRecord');
    p = mapBindings(p, (b) => !b._zoneRecord, '_notFound');

    return branch(p,
      '_notFound',
      complete(createProgram(), 'notfound', { message: `No zone exists with identifier '${zone}'` }),
      (() => {
        let sub = createProgram();
        sub = putFrom(sub, 'zone', zone, (b) => {
          const r = b._zoneRecord as Record<string, unknown>;
          return {
            ...r,
            allowedSchemas: resolvedAllowedSchemas,
            maxTabs: maxTabs !== undefined ? (maxTabs ?? null) : (r.maxTabs ?? null),
          };
        });
        return complete(sub, 'ok', { zone });
      })(),
    ) as StorageProgram<Result>;
  },

  toggleAutoHide(input: Record<string, unknown>) {
    const zone = input.zone as string;

    let p = createProgram();
    p = get(p, 'zone', zone, '_zoneRecord');
    p = mapBindings(p, (b) => !b._zoneRecord, '_notFound');
    p = mapBindings(p, (b) => {
      const r = b._zoneRecord as Record<string, unknown> | null;
      return r ? !(r.autoHide as boolean) : false;
    }, '_newAutoHide');

    return branch(p,
      '_notFound',
      complete(createProgram(), 'notfound', { message: `No zone exists with identifier '${zone}'` }),
      (() => {
        let sub = createProgram();
        sub = putFrom(sub, 'zone', zone, (b) => {
          const r = b._zoneRecord as Record<string, unknown>;
          return { ...r, autoHide: b._newAutoHide as boolean };
        });
        sub = completeFrom(sub, 'ok', (b) => ({ zone, autoHide: b._newAutoHide as boolean }));
        return sub;
      })(),
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const zone = input.zone as string;

    let p = createProgram();
    p = get(p, 'zone', zone, '_record');
    p = mapBindings(p, (b) => !b._record, '_notFound');

    return branch(p,
      '_notFound',
      complete(createProgram(), 'notfound', { message: `No zone exists with identifier '${zone}'` }),
      completeFrom(createProgram(), 'ok', (b) => {
        const r = b._record as Record<string, unknown>;
        return {
          zone: r.zone as string,
          name: r.name as string,
          edge: r.edge as string,
          label: (r.label as string | null) ?? null,
          allowedSchemas: (r.allowedSchemas as string[] | null) ?? null,
          maxTabs: (r.maxTabs as number | null) ?? null,
          autoHide: (r.autoHide as boolean) ?? false,
          defaultCollapsed: (r.defaultCollapsed as boolean) ?? false,
          contentRef: (r.contentRef as string | null) ?? null,
        };
      }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'zone', {}, '_allZones');
    return completeFrom(p, 'ok', (b) => {
      const zones = (b._allZones as Array<Record<string, unknown>>) || [];
      return {
        zones: zones.map(r => ({
          zone: r.zone as string,
          name: r.name as string,
          edge: r.edge as string,
          label: (r.label as string | null) ?? null,
          autoHide: (r.autoHide as boolean) ?? false,
          defaultCollapsed: (r.defaultCollapsed as boolean) ?? false,
          contentRef: (r.contentRef as string | null) ?? null,
        })),
      };
    }) as StorageProgram<Result>;
  },

  register_concept(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { name: 'DockZone' }) as StorageProgram<Result>;
  },
};

export const dockZoneHandler = autoInterpret(_handler);
