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
  del,
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

    // Input validation
    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!edge || !VALID_EDGES.has(edge)) {
      return complete(createProgram(), 'invalid', { message: `edge must be one of: left, right, top, bottom, center` }) as StorageProgram<Result>;
    }

    let p = createProgram();
    // Check for duplicate name
    p = find(p, 'zone', { name }, 'existing');
    return branch(p,
      (b) => Array.isArray(b.existing) && (b.existing as unknown[]).length > 0,
      (b) => complete(b, 'duplicate', { message: `A zone with name '${name}' is already registered` }),
      (b) => {
        let b2 = put(b, 'zone', zone, {
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
        return complete(b2, 'ok', { zone });
      },
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
    p = get(p, 'zone', zone, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `No zone exists with identifier '${zone}'` }),
      (b) => {
        const record = (b.existing as Record<string, unknown>);
        const maxTabs = record.maxTabs as number | null;
        const contentRef = record.contentRef as string | null;

        // Check if pane is already docked
        if (contentRef === paneId) {
          return complete(b, 'invalid', { message: `Pane '${paneId}' is already docked in this zone` });
        }

        // Check maxTabs (simple single-pane model: if contentRef exists, zone is full when maxTabs=1)
        if (maxTabs !== null && maxTabs !== undefined) {
          // Count current tabs: contentRef represents a single pane; for simplicity treat it as 1 tab
          const currentTabs = contentRef ? 1 : 0;
          if (currentTabs >= maxTabs) {
            return complete(b, 'invalid', { message: `Zone has reached its maxTabs limit of ${maxTabs}` });
          }
        }

        let b2 = put(b, 'zone', zone, {
          ...(record as Record<string, unknown>),
          contentRef: paneId,
        });
        return complete(b2, 'ok', { zone });
      },
    ) as StorageProgram<Result>;
  },

  undock(input: Record<string, unknown>) {
    const zone = input.zone as string;
    const paneId = (input.paneId as string | undefined) ?? '';

    let p = createProgram();
    p = get(p, 'zone', zone, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `No zone exists with identifier '${zone}'` }),
      (b) => {
        const record = b.existing as Record<string, unknown>;
        const contentRef = record.contentRef as string | null;

        if (contentRef !== paneId) {
          return complete(b, 'notfound', { message: `Pane '${paneId}' is not currently docked in zone '${zone}'` });
        }

        let b2 = put(b, 'zone', zone, {
          ...(record as Record<string, unknown>),
          contentRef: null,
        });
        return complete(b2, 'ok', { zone });
      },
    ) as StorageProgram<Result>;
  },

  moveTo(input: Record<string, unknown>) {
    const fromZone = input.fromZone as string;
    const toZone = input.toZone as string;
    const paneId = (input.paneId as string | undefined) ?? '';

    let p = createProgram();
    p = get(p, 'zone', fromZone, 'fromRecord');
    p = get(p, 'zone', toZone, 'toRecord');

    return branch(p,
      (b) => !b.fromRecord,
      (b) => complete(b, 'notfound', { message: `Source zone '${fromZone}' does not exist` }),
      (b) => branch(b,
        (b2) => !b2.toRecord,
        (b2) => complete(b2, 'notfound', { message: `Destination zone '${toZone}' does not exist` }),
        (b2) => {
          const fromRecord = b2.fromRecord as Record<string, unknown>;
          const toRecord = b2.toRecord as Record<string, unknown>;
          const contentRef = fromRecord.contentRef as string | null;

          if (contentRef !== paneId) {
            return complete(b2, 'notfound', { message: `Pane '${paneId}' is not docked in zone '${fromZone}'` });
          }

          // Check destination maxTabs
          const maxTabs = toRecord.maxTabs as number | null;
          if (maxTabs !== null && maxTabs !== undefined) {
            const currentTabs = toRecord.contentRef ? 1 : 0;
            if (currentTabs >= maxTabs) {
              return complete(b2, 'invalid', { message: `Destination zone has reached its maxTabs limit of ${maxTabs}` });
            }
          }

          let b3 = put(b2, 'zone', fromZone, {
            ...(fromRecord as Record<string, unknown>),
            contentRef: null,
          });
          b3 = put(b3, 'zone', toZone, {
            ...(toRecord as Record<string, unknown>),
            contentRef: paneId,
          });
          return complete(b3, 'ok', { fromZone, toZone });
        },
      ),
    ) as StorageProgram<Result>;
  },

  setRules(input: Record<string, unknown>) {
    const zone = input.zone as string;
    const allowedSchemasRaw = input.allowedSchemas;
    const maxTabs = input.maxTabs as number | null | undefined;

    // Validate maxTabs: must be > 0 if provided
    if (maxTabs !== null && maxTabs !== undefined && maxTabs <= 0) {
      return complete(createProgram(), 'invalid', { message: 'maxTabs must be greater than zero' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'zone', zone, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `No zone exists with identifier '${zone}'` }),
      (b) => {
        const record = b.existing as Record<string, unknown>;

        // Parse allowedSchemas: accept null/none or a JSON array string
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

        let b2 = put(b, 'zone', zone, {
          ...(record as Record<string, unknown>),
          allowedSchemas: allowedSchemas ?? null,
          maxTabs: maxTabs !== undefined ? maxTabs : (record.maxTabs ?? null),
        });
        return complete(b2, 'ok', { zone });
      },
    ) as StorageProgram<Result>;
  },

  toggleAutoHide(input: Record<string, unknown>) {
    const zone = input.zone as string;

    let p = createProgram();
    p = get(p, 'zone', zone, 'existing');
    return branch(p,
      (b) => !b.existing,
      (b) => complete(b, 'notfound', { message: `No zone exists with identifier '${zone}'` }),
      (b) => {
        const record = b.existing as Record<string, unknown>;
        const newAutoHide = !(record.autoHide as boolean);
        let b2 = put(b, 'zone', zone, {
          ...(record as Record<string, unknown>),
          autoHide: newAutoHide,
        });
        return complete(b2, 'ok', { zone, autoHide: newAutoHide });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const zone = input.zone as string;

    let p = createProgram();
    p = get(p, 'zone', zone, 'record');
    return branch(p,
      (b) => !b.record,
      (b) => complete(b, 'notfound', { message: `No zone exists with identifier '${zone}'` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const r = bindings.record as Record<string, unknown>;
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
    p = find(p, 'zone', {}, 'allZones');
    return completeFrom(p, 'ok', (bindings) => {
      const zones = (bindings.allZones as Array<Record<string, unknown>>) || [];
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
