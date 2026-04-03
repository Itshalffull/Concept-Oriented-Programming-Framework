// @clef-handler style=functional concept=ViewShell
// ViewShell Concept Implementation — Functional (StorageProgram) style
//
// Manages the user-facing identity and configuration reference set for a named
// view shell. Stores the stable name, title, description, data source, and all
// subordinate spec references (filter, sort, group, projection, presentation,
// interaction). The resolve action assembles a JSON ViewConfig from the stored
// references without performing hydration — that responsibility belongs to
// ViewRenderer.
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

    if (!name || (typeof name === 'string' && name.trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
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
        const b2 = put(b, 'view', name, {
          name,
          title,
          description,
          dataSource,
          filter,
          sort,
          group,
          projection,
          presentation,
          interaction,
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

    if (title !== undefined && typeof title === 'string' && title.trim() === '') {
      return complete(createProgram(), 'error', { message: 'title is required' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'view', name, 'existing');
    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `View "${name}" not found` }),
      (b) => {
        let b2 = put(b, 'view', name, {
          name,
          title,
          description,
          dataSource,
          filter,
          sort,
          group,
          projection,
          presentation,
          interaction,
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
};

export const viewShellHandler = autoInterpret(_handler);
