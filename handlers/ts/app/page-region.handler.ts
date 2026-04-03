// @clef-handler style=functional
// PageRegion Concept Implementation
// Explicit composition unit for the fourth layout region of an entity page.
// Manages sections, tabs, sidebars, and control regions that compose into
// a four-zone page layout alongside the three structural entity zones.
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, del, branch, complete,
  completeFrom, mergeFrom,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

const VALID_KINDS = ['section', 'tabs', 'sidebar', 'controls'];
const VALID_PLACEMENTS = ['top-right', 'bottom-left', 'inline', 'toolbar'];

const _pageRegionHandler: FunctionalConceptHandler = {
  define(input: Record<string, unknown>) {
    const label = input.label as string;
    const kind = input.kind as string;
    const region = input.region as string;
    const order = input.order as number ?? 0;

    if (!label || label.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'label is required' }) as StorageProgram<Result>;
    }

    if (!VALID_KINDS.includes(kind)) {
      return complete(createProgram(), 'invalid', {
        message: `Invalid kind "${kind}". Must be one of: ${VALID_KINDS.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'pageRegion', region, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'duplicate', { region }),
      (b) => {
        let b2 = put(b, 'pageRegion', region, {
          region,
          label,
          kind,
          order,
          visible: true,
          slots: null,
          tab_labels: null,
          sidebar_width: null,
          control_refs: null,
          control_placement: null,
          createdAt: new Date().toISOString(),
        });
        return complete(b2, 'ok', { region });
      },
    );

    return p as StorageProgram<Result>;
  },

  configure(input: Record<string, unknown>) {
    const region = input.region as string;
    const slots = input.slots as string | null | undefined;
    const tab_labels = input.tab_labels as string | null | undefined;
    const sidebar_width = input.sidebar_width as string | null | undefined;

    // Validate JSON fields before storage
    if (slots && slots !== 'none' && slots !== null) {
      try {
        JSON.parse(slots);
      } catch {
        return complete(createProgram(), 'invalid', { message: 'slots must be valid JSON' }) as StorageProgram<Result>;
      }
    }

    if (tab_labels && tab_labels !== 'none' && tab_labels !== null) {
      try {
        JSON.parse(tab_labels);
      } catch {
        return complete(createProgram(), 'invalid', { message: 'tab_labels must be valid JSON' }) as StorageProgram<Result>;
      }
    }

    let p = createProgram();
    p = spGet(p, 'pageRegion', region, 'record');
    p = branch(p, 'record',
      (b) => {
        const updates: Record<string, unknown> = {};
        if (slots !== undefined) updates.slots = slots === 'none' ? null : slots;
        if (tab_labels !== undefined) updates.tab_labels = tab_labels === 'none' ? null : tab_labels;
        if (sidebar_width !== undefined) updates.sidebar_width = sidebar_width === 'none' ? null : sidebar_width;

        let b2 = mergeFrom(b, 'pageRegion', region, () => updates);
        return complete(b2, 'ok', { region });
      },
      (b) => complete(b, 'notfound', { message: `Page region not found: ${region}` }),
    );

    return p as StorageProgram<Result>;
  },

  attachControls(input: Record<string, unknown>) {
    const region = input.region as string;
    const control_refs = input.control_refs as string;
    const placement = input.placement as string;

    if (!VALID_PLACEMENTS.includes(placement)) {
      return complete(createProgram(), 'invalid', {
        message: `Invalid placement "${placement}". Must be one of: ${VALID_PLACEMENTS.join(', ')}`,
      }) as StorageProgram<Result>;
    }

    try {
      JSON.parse(control_refs);
    } catch {
      return complete(createProgram(), 'invalid', { message: 'control_refs must be valid JSON' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = spGet(p, 'pageRegion', region, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = mergeFrom(b, 'pageRegion', region, () => ({
          control_refs,
          control_placement: placement,
        }));
        return complete(b2, 'ok', { region });
      },
      (b) => complete(b, 'notfound', { message: `Page region not found: ${region}` }),
    );

    return p as StorageProgram<Result>;
  },

  setOrder(input: Record<string, unknown>) {
    const region = input.region as string;
    const order = input.order as number;

    let p = createProgram();
    p = spGet(p, 'pageRegion', region, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = mergeFrom(b, 'pageRegion', region, () => ({ order }));
        return complete(b2, 'ok', { region });
      },
      (b) => complete(b, 'notfound', { message: `Page region not found: ${region}` }),
    );

    return p as StorageProgram<Result>;
  },

  setVisible(input: Record<string, unknown>) {
    const region = input.region as string;
    const visible = input.visible as boolean;

    let p = createProgram();
    p = spGet(p, 'pageRegion', region, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = mergeFrom(b, 'pageRegion', region, () => ({ visible }));
        return complete(b2, 'ok', { region });
      },
      (b) => complete(b, 'notfound', { message: `Page region not found: ${region}` }),
    );

    return p as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const region = input.region as string;

    let p = createProgram();
    p = spGet(p, 'pageRegion', region, 'record');
    p = branch(p, 'record',
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.record as Record<string, unknown>;
        return {
          region,
          label: rec.label ?? '',
          kind: rec.kind ?? '',
          order: rec.order ?? 0,
          visible: rec.visible ?? true,
          slots: rec.slots ?? null,
          tab_labels: rec.tab_labels ?? null,
          sidebar_width: rec.sidebar_width ?? null,
          control_refs: rec.control_refs ?? null,
          control_placement: rec.control_placement ?? null,
        };
      }),
      (b) => complete(b, 'notfound', { message: `Page region not found: ${region}` }),
    );

    return p as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'pageRegion', {}, 'items');
    return completeFrom(p, 'ok', (bindings) => {
      const items = bindings.items as Record<string, unknown>[];
      const sorted = (items || []).slice().sort((a, b) =>
        ((a.order as number) ?? 0) - ((b.order as number) ?? 0)
      );
      return { items: JSON.stringify(sorted) };
    }) as StorageProgram<Result>;
  },

  remove(input: Record<string, unknown>) {
    const region = input.region as string;

    let p = createProgram();
    p = spGet(p, 'pageRegion', region, 'record');
    p = branch(p, 'record',
      (b) => {
        let b2 = del(b, 'pageRegion', region);
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: `Page region not found: ${region}` }),
    );

    return p as StorageProgram<Result>;
  },

  register(_input: Record<string, unknown>) {
    return complete(createProgram(), 'ok', { name: 'PageRegion' }) as StorageProgram<Result>;
  },
};

export const pageRegionHandler = autoInterpret(_pageRegionHandler);
