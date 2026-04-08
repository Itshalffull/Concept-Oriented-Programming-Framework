// @clef-handler style=functional concept=ViewShell
// ViewShell Concept Implementation — Functional (StorageProgram) style
//
// Manages the user-facing identity and configuration reference set for a named
// view shell. Stores the stable name, title, description, data source, and all
// subordinate spec references (filter, sort, group, projection, presentation,
// interaction). The resolve action assembles a JSON ViewConfig from the stored
// references without performing hydration — use resolveHydrated for fully
// hydrated child spec data.
//
// resolveHydrated is an imperative override that delegates cross-concept reads
// to the kernel via a wired kernel reference (same pattern as EntityReflector).
// Call setViewShellKernel(kernel) after boot to wire it. Without the kernel
// reference, resolveHydrated falls back to the same ref-name response as resolve.
// See architecture doc Section 10.1 (ConceptManifest IR) for concept patterns.

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

// ─── Handler ───────────────────────────────────────────────────────────────

const _handler: FunctionalConceptHandler = {

  create(input: Record<string, unknown>) {
    const name        = input.name        as string;
    const title       = input.title       as string;
    const description = input.description as string;
    const dataSource  = input.dataSource  as string;
    const filter      = input.filter      as string;
    const sort        = input.sort        as string;
    const group       = input.group       as string;
    const projection  = input.projection  as string;
    const presentation = input.presentation as string;
    const interaction = input.interaction as string;
    const featuresRaw = (input.features as string) ?? '';
    const pagination  = (input.pagination as string) ?? '';

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }

    // Resolve the enabled feature set — default to all features when not specified.
    const ALL_FEATURES = ['filter', 'sort', 'group', 'projection', 'interaction', 'pagination'];
    let enabledFeatures: string[];
    if (!featuresRaw || featuresRaw.trim() === '') {
      enabledFeatures = ALL_FEATURES;
    } else {
      try {
        enabledFeatures = JSON.parse(featuresRaw) as string[];
      } catch {
        return complete(createProgram(), 'error', { message: 'features must be a valid JSON array' }) as StorageProgram<Result>;
      }
    }

    // Validate: non-empty child spec refs for disabled features are rejected.
    const featureRefMap: Array<{ feature: string; ref: string }> = [
      { feature: 'filter',      ref: filter      ?? '' },
      { feature: 'sort',        ref: sort         ?? '' },
      { feature: 'group',       ref: group        ?? '' },
      { feature: 'projection',  ref: projection   ?? '' },
      { feature: 'interaction', ref: interaction  ?? '' },
      { feature: 'pagination',  ref: pagination   ?? '' },
    ];
    for (const { feature, ref } of featureRefMap) {
      if (ref && ref.trim() !== '' && !enabledFeatures.includes(feature)) {
        return complete(createProgram(), 'feature_disabled', {
          message: `Feature "${feature}" is disabled but a non-empty ref was provided`,
        }) as StorageProgram<Result>;
      }
    }

    // Check for duplicates before validating optional title — duplicate wins
    let p = createProgram();
    p = get(p, 'view', name, 'existing');
    return branch(p,
      (b) => b.existing != null,
      (b) => completeFrom(b, 'duplicate', (bindings) => ({
        view: (bindings.existing as Record<string, unknown>).name as string,
      })),
      (b) => {
        if (!title || (typeof title === 'string' && title.trim() === '')) {
          return complete(b, 'error', { message: 'title is required' });
        }
        const features = JSON.stringify(enabledFeatures);
        const b2 = put(b, 'view', name, {
          name,
          title,
          description,
          dataSource,
          filter:      enabledFeatures.includes('filter')      ? (filter ?? '')      : '',
          sort:        enabledFeatures.includes('sort')         ? (sort ?? '')        : '',
          group:       enabledFeatures.includes('group')        ? (group ?? '')       : '',
          projection:  enabledFeatures.includes('projection')   ? (projection ?? '')  : '',
          presentation,
          interaction: enabledFeatures.includes('interaction')  ? (interaction ?? '') : '',
          pagination:  enabledFeatures.includes('pagination')   ? (pagination ?? '')  : '',
          features,
          legacyConfig: null,
        });
        return complete(b2, 'ok', { view: name });
      },
    ) as StorageProgram<Result>;
  },

  get(input: Record<string, unknown>) {
    const name = input.name as string;

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'name is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'view', name, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `View "${name}" not found` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          view:         rec.name         as string,
          title:        rec.title        as string,
          description:  rec.description  as string,
          dataSource:   rec.dataSource   as string,
          filter:       rec.filter       as string,
          sort:         rec.sort         as string,
          group:        rec.group        as string,
          projection:   rec.projection   as string,
          presentation: rec.presentation as string,
          interaction:  rec.interaction  as string,
        };
      }),
    ) as StorageProgram<Result>;
  },

  update(input: Record<string, unknown>) {
    const name        = input.name        as string;
    const title       = input.title       as string;
    const description = input.description as string;
    const dataSource  = input.dataSource  as string;
    const filter      = input.filter      as string;
    const sort        = input.sort        as string;
    const group       = input.group       as string;
    const projection  = input.projection  as string;
    const presentation = input.presentation as string;
    const interaction = input.interaction as string;
    const featuresRaw = (input.features as string) ?? '';
    const pagination  = (input.pagination as string) ?? '';

    if (title !== undefined && typeof title === 'string' && title.trim() === '') {
      return complete(createProgram(), 'error', { message: 'title is required' }) as StorageProgram<Result>;
    }

    // Resolve the enabled feature set — default to all features when not specified.
    const ALL_FEATURES = ['filter', 'sort', 'group', 'projection', 'interaction', 'pagination'];
    let enabledFeatures: string[];
    if (!featuresRaw || featuresRaw.trim() === '') {
      enabledFeatures = ALL_FEATURES;
    } else {
      try {
        enabledFeatures = JSON.parse(featuresRaw) as string[];
      } catch {
        return complete(createProgram(), 'error', { message: 'features must be a valid JSON array' }) as StorageProgram<Result>;
      }
    }

    // Validate: non-empty child spec refs for disabled features are rejected.
    const featureRefMap: Array<{ feature: string; ref: string }> = [
      { feature: 'filter',      ref: filter      ?? '' },
      { feature: 'sort',        ref: sort         ?? '' },
      { feature: 'group',       ref: group        ?? '' },
      { feature: 'projection',  ref: projection   ?? '' },
      { feature: 'interaction', ref: interaction  ?? '' },
      { feature: 'pagination',  ref: pagination   ?? '' },
    ];
    for (const { feature, ref } of featureRefMap) {
      if (ref && ref.trim() !== '' && !enabledFeatures.includes(feature)) {
        return complete(createProgram(), 'feature_disabled', {
          message: `Feature "${feature}" is disabled but a non-empty ref was provided`,
        }) as StorageProgram<Result>;
      }
    }

    let p = createProgram();
    p = get(p, 'view', name, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `View "${name}" not found` }),
      (b) => {
        const features = JSON.stringify(enabledFeatures);
        let b2 = put(b, 'view', name, {
          name,
          title,
          description,
          dataSource,
          filter:      enabledFeatures.includes('filter')      ? (filter ?? '')      : '',
          sort:        enabledFeatures.includes('sort')         ? (sort ?? '')        : '',
          group:       enabledFeatures.includes('group')        ? (group ?? '')       : '',
          projection:  enabledFeatures.includes('projection')   ? (projection ?? '')  : '',
          presentation,
          interaction: enabledFeatures.includes('interaction')  ? (interaction ?? '') : '',
          pagination:  enabledFeatures.includes('pagination')   ? (pagination ?? '')  : '',
          features,
          legacyConfig: null,
        });
        return complete(b2, 'ok', { view: name });
      },
    ) as StorageProgram<Result>;
  },

  resolve(input: Record<string, unknown>) {
    const name = input.name as string;

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'name is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'view', name, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `View "${name}" not found` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;

        // If legacy config is set and all child refs are empty, return it verbatim.
        const hasRefs = [
          rec.dataSource, rec.filter, rec.sort, rec.group,
          rec.projection, rec.presentation, rec.interaction,
        ].some(v => typeof v === 'string' && (v as string).trim() !== '');

        if (!hasRefs && rec.legacyConfig) {
          return {
            view:   rec.name as string,
            config: rec.legacyConfig as string,
          };
        }

        const config = JSON.stringify({
          view:         rec.name,
          title:        rec.title,
          description:  rec.description,
          dataSource:   rec.dataSource,
          filter:       rec.filter,
          sort:         rec.sort,
          group:        rec.group,
          projection:   rec.projection,
          presentation: rec.presentation,
          interaction:  rec.interaction,
        });

        return {
          view:   rec.name as string,
          config,
        };
      }),
    ) as StorageProgram<Result>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'view', {}, 'allViews');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allViews ?? []) as Array<Record<string, unknown>>;
      const views = all.map(v => ({
        name:         v.name,
        title:        v.title,
        description:  v.description,
        dataSource:   v.dataSource,
        filter:       v.filter,
        sort:         v.sort,
        group:        v.group,
        projection:   v.projection,
        presentation: v.presentation,
        interaction:  v.interaction,
      }));
      return { views: JSON.stringify(views) };
    }) as StorageProgram<Result>;
  },

  // resolveHydrated — functional base (returns ref names, same as resolve).
  // The exported handler overrides this with an imperative variant that dispatches
  // to child spec concepts via the kernel when a storage argument is provided.
  resolveHydrated(input: Record<string, unknown>) {
    const name = input.name as string;

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'name is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'view', name, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `View "${name}" not found` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          view:         rec.name          as string,
          title:        rec.title         as string,
          description:  (rec.description  as string) ?? '',
          dataSource:   (rec.dataSource   as string) ?? '',
          filter:       (rec.filter       as string) ?? '',
          sort:         (rec.sort         as string) ?? '',
          group:        (rec.group        as string) ?? '',
          projection:   (rec.projection   as string) ?? '',
          presentation: (rec.presentation as string) ?? '',
          interaction:  (rec.interaction  as string) ?? '',
          pagination:   (rec.pagination   as string) ?? '',
          features:     (rec.features     as string) ?? '',
        };
      }),
    ) as StorageProgram<Result>;
  },
};

// ─── Base functional handler wrapped with autoInterpret ─────────────────────

const _base = autoInterpret(_handler);

// ─── Kernel reference for cross-concept hydration ───────────────────────────
//
// Set by calling setViewShellKernel(kernel) after boot, following the same
// pattern as setEntityReflectorKernel in entity-reflector.handler.ts.
// Without the kernel reference, resolveHydrated returns the same ref-name
// response as resolve (graceful degradation).

interface KernelLike {
  invokeConcept(
    uri: string,
    action: string,
    input: Record<string, unknown>,
  ): Promise<{ variant: string; [key: string]: unknown }>;
}

let _kernel: KernelLike | null = null;

/** Wire the kernel reference so resolveHydrated can dispatch cross-concept gets. */
export function setViewShellKernel(kernel: KernelLike): void {
  _kernel = kernel;
}

// ─── resolveHydrated — dual-mode override ───────────────────────────────────
//
// Called with (input) only → returns StorageProgram (functional mode, tests)
// Called with (input, storage) → performs imperative kernel dispatch (runtime mode)
//
// When called with storage and a kernel is wired, this dispatches cross-concept
// get actions to fully hydrate each child spec reference. When no kernel is
// wired (tests, isolated environments), returns ref names like the base resolve.

function resolveHydrated(
  input: Record<string, unknown>,
  storage?: import('../../../runtime/types.ts').ConceptStorage,
): unknown {
  // Functional mode — no storage passed. Return a StorageProgram from the
  // base functional implementation (reads ref names from ViewShell storage).
  if (storage === undefined) {
    return _handler.resolveHydrated(input);
  }

  // Imperative mode — storage provided. Perform async kernel dispatch.
  return (async (): Promise<Record<string, unknown>> => {
    const name = input.name as string;

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return { variant: 'notfound', message: 'name is required' };
    }

    // Read the ViewShell record from this handler's own storage.
    const shell = await storage.get('view', name);
    if (!shell) {
      return { variant: 'notfound', message: `View "${name}" not found` };
    }

    const rec = shell as Record<string, unknown>;

    // Resolve enabled features — default to all when not set (backward compatibility).
    const ALL_FEATURES = ['filter', 'sort', 'group', 'projection', 'interaction', 'pagination'];
    const featuresRaw = (rec.features as string) ?? '';
    let enabledFeatures: string[];
    if (!featuresRaw || featuresRaw.trim() === '') {
      enabledFeatures = ALL_FEATURES;
    } else {
      try {
        enabledFeatures = JSON.parse(featuresRaw) as string[];
      } catch {
        enabledFeatures = ALL_FEATURES;
      }
    }

    // If no kernel is wired, gracefully degrade to ref-name response (same as resolve).
    if (!_kernel) {
      return {
        variant: 'ok',
        view:         rec.name          as string,
        title:        rec.title         as string,
        description:  (rec.description  as string) ?? '',
        dataSource:   (rec.dataSource   as string) ?? '',
        filter:       enabledFeatures.includes('filter')      ? ((rec.filter      as string) ?? '') : '',
        sort:         enabledFeatures.includes('sort')         ? ((rec.sort        as string) ?? '') : '',
        group:        enabledFeatures.includes('group')        ? ((rec.group       as string) ?? '') : '',
        projection:   enabledFeatures.includes('projection')   ? ((rec.projection  as string) ?? '') : '',
        presentation: (rec.presentation  as string) ?? '',
        interaction:  enabledFeatures.includes('interaction')  ? ((rec.interaction as string) ?? '') : '',
        pagination:   enabledFeatures.includes('pagination')   ? ((rec.pagination  as string) ?? '') : '',
        features:     featuresRaw,
      };
    }

    // Helper: invoke a child spec's get action, returning the result or null.
    // Only dispatches when the ref is non-empty (avoids unnecessary kernel calls).
    async function fetchChild(
      conceptUri: string,
      refName: string | undefined,
    ): Promise<Record<string, unknown> | null> {
      if (!refName || refName.trim() === '') return null;
      const result = await _kernel!.invokeConcept(conceptUri, 'get', { name: refName });
      if (result.variant !== 'ok') return null;
      return result as Record<string, unknown>;
    }

    // Only fetch child specs whose feature is enabled. dataSource and presentation
    // are always-on (never gated by the features set).
    const [filterResult, sortResult, groupResult, projectionResult, sourceResult, presentationResult, interactionResult, paginationResult] =
      await Promise.all([
        enabledFeatures.includes('filter')
          ? fetchChild('urn:clef/FilterSpec',       rec.filter       as string)
          : Promise.resolve(null),
        enabledFeatures.includes('sort')
          ? fetchChild('urn:clef/SortSpec',         rec.sort         as string)
          : Promise.resolve(null),
        enabledFeatures.includes('group')
          ? fetchChild('urn:clef/GroupSpec',        rec.group        as string)
          : Promise.resolve(null),
        enabledFeatures.includes('projection')
          ? fetchChild('urn:clef/ProjectionSpec',   rec.projection   as string)
          : Promise.resolve(null),
        fetchChild('urn:clef/DataSourceSpec',   rec.dataSource   as string),
        fetchChild('urn:clef/PresentationSpec', rec.presentation as string),
        enabledFeatures.includes('interaction')
          ? fetchChild('urn:clef/InteractionSpec',  rec.interaction  as string)
          : Promise.resolve(null),
        enabledFeatures.includes('pagination')
          ? fetchChild('urn:clef/PaginationSpec',   rec.pagination   as string)
          : Promise.resolve(null),
      ]);

    return {
      variant: 'ok',
      view:         rec.name         as string,
      title:        rec.title        as string,
      description:  (rec.description as string) ?? '',
      features:     featuresRaw,

      // DataSource: { source, kind, config, parameters } — config is a JSON string
      dataSource: sourceResult
        ? JSON.stringify({
            name:       sourceResult.source,
            kind:       sourceResult.kind,
            config:     sourceResult.config,
            parameters: sourceResult.parameters ?? '[]',
          })
        : '',

      // Filter: { filter, tree, sourceType, fieldRefs, parameters }
      filter: filterResult
        ? JSON.stringify({
            name:       filterResult.filter,
            tree:       filterResult.tree,
            sourceType: filterResult.sourceType,
            fieldRefs:  filterResult.fieldRefs  ?? '[]',
            parameters: filterResult.parameters ?? '[]',
          })
        : '',

      // Sort: { sort, keys } — keys is a JSON string
      sort: sortResult
        ? JSON.stringify({
            name: sortResult.sort,
            keys: sortResult.keys,
          })
        : '',

      // Group: { group, grouping, aggregations, having }
      group: groupResult
        ? JSON.stringify({
            name:         groupResult.group,
            grouping:     groupResult.grouping,
            aggregations: groupResult.aggregations,
            having:       groupResult.having ?? '',
          })
        : '',

      // Projection: { projection, fields } — fields is a JSON string
      projection: projectionResult
        ? JSON.stringify({
            name:   projectionResult.projection,
            fields: projectionResult.fields,
          })
        : '',

      // Presentation: { presentation, displayType, hints, displayModePolicy, defaultDisplayMode }
      presentation: presentationResult
        ? JSON.stringify({
            name:               presentationResult.presentation,
            displayType:        presentationResult.displayType,
            hints:              presentationResult.hints,
            displayModePolicy:  presentationResult.displayModePolicy,
            defaultDisplayMode: presentationResult.defaultDisplayMode,
          })
        : '',

      // Interaction: { interaction, createForm, rowClick, rowActions, pickerMode }
      interaction: interactionResult
        ? JSON.stringify({
            name:        interactionResult.interaction,
            createForm:  interactionResult.createForm,
            rowClick:    interactionResult.rowClick,
            rowActions:  interactionResult.rowActions,
            pickerMode:  interactionResult.pickerMode,
          })
        : '',

      // Pagination: { name, mode, pageSize, maxSize, position, totalCount, hasMore }
      pagination: paginationResult
        ? JSON.stringify({
            name:       paginationResult.name,
            mode:       paginationResult.mode,
            pageSize:   paginationResult.pageSize,
            maxSize:    paginationResult.maxSize,
            position:   paginationResult.position,
            totalCount: paginationResult.totalCount,
            hasMore:    paginationResult.hasMore,
          })
        : '',
    };
  })();
}

// ─── Exported handler — functional base + dual-mode resolveHydrated ─────────
//
// Spreads _base (the autoInterpret-wrapped functional handler) and overrides
// resolveHydrated with the dual-mode implementation above.

export const viewShellHandler = {
  ..._base,
  resolveHydrated,
};
