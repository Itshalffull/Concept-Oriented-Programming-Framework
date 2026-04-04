// @clef-handler style=functional concept=Origin
// Origin Concept Implementation — Functional (StorageProgram) style
//
// Qualifies where an entity reference comes from — local base, a version-space
// overlay, a remote kernel, or an external system. Provides registration,
// cross-boundary resolution, freshness tracking, and provenance display.
// Actual dispatch to VersionSpace/Connection/ExternalHandler happens via syncs.
// See architecture doc Section 10.2 (foundation layer, provenance and routing).

import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get, find, put, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

/** Valid kind values declared in the spec invariant "kind is valid". */
const VALID_KINDS = new Set(['local', 'space', 'kernel', 'external']);

// ─── Handler ───────────────────────────────────────────────────────────────
//
// The concept spec declares an action named "register" that takes
// (origin, kind, qualifier, displayName, resolverConfig). The plugin-registry
// convention also calls register() with an empty input to retrieve the
// concept name. We serve both: when input is empty we return the metadata
// response; when input contains "kind" we run the concept-action logic.

const _handler: FunctionalConceptHandler = {

  register(input: Record<string, unknown>) {
    // Plugin-registry probe — called with no arguments to discover concept name.
    if (!input || Object.keys(input).length === 0) {
      return complete(createProgram(), 'ok', { name: 'Origin' }) as StorageProgram<Result>;
    }

    const origin = input.origin as string;
    const kind = input.kind as string;
    const qualifier = input.qualifier as string;
    const displayName = input.displayName as string;
    const resolverConfig = input.resolverConfig as string;

    // --- Input validation (error fixtures: register_empty_kind) ---
    if (!kind || kind.trim() === '') {
      return complete(createProgram(), 'error', { message: 'kind is required' }) as StorageProgram<Result>;
    }
    if (!VALID_KINDS.has(kind)) {
      return complete(createProgram(), 'error', { message: 'kind must be one of: local, space, kernel, external' }) as StorageProgram<Result>;
    }
    if (!qualifier || qualifier.trim() === '') {
      return complete(createProgram(), 'error', { message: 'qualifier is required' }) as StorageProgram<Result>;
    }
    if (!displayName || displayName.trim() === '') {
      return complete(createProgram(), 'error', { message: 'displayName is required' }) as StorageProgram<Result>;
    }
    if (resolverConfig === undefined || resolverConfig === null || String(resolverConfig).trim() === '') {
      return complete(createProgram(), 'error', { message: 'resolverConfig is required' }) as StorageProgram<Result>;
    }
    // resolverConfig must be valid JSON (spec: "resolverConfig is not valid JSON" -> error)
    try {
      if (typeof resolverConfig === 'string') JSON.parse(resolverConfig);
    } catch {
      return complete(createProgram(), 'error', { message: 'resolverConfig is not valid JSON' }) as StorageProgram<Result>;
    }

    // --- Duplicate check (duplicate fixture: register_duplicate) ---
    let p = createProgram();
    p = get(p, 'origin', origin, 'existing');

    return branch(p,
      (b) => b.existing != null,
      (b) => complete(b, 'duplicate', { origin }),
      (b) => {
        const b2 = put(b, 'origin', origin, {
          origin,
          kind,
          qualifier,
          displayName,
          icon: null,
          status: 'connected',
          resolverConfig,
        });
        return complete(b2, 'ok', { origin });
      },
    ) as StorageProgram<Result>;
  },

  // action resolve(origin, entityId)
  // Look up origin; dispatch is a placeholder — actual resolution via syncs.
  resolve(input: Record<string, unknown>) {
    const origin = input.origin as string;
    const entityId = input.entityId as string;

    let p = createProgram();
    p = get(p, 'origin', origin, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { entityId }),
      (b) => {
        // Placeholder: return fields derived from the stored resolverConfig.
        // Real cross-boundary resolution happens through VersionSpace/Connection
        // syncs wired to this concept's resolve completion.
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const fields = JSON.stringify({ entityId, origin: rec.origin, kind: rec.kind });
          return { fields, origin };
        });
      },
    ) as StorageProgram<Result>;
  },

  // action checkStatus(origin)
  // Returns the currently stored status as the completion variant.
  // Actual probing is triggered via syncs after this completes.
  checkStatus(input: Record<string, unknown>) {
    const origin = input.origin as string;

    let p = createProgram();
    p = get(p, 'origin', origin, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No origin registered with id "${origin}"` }),
      (b) => {
        // Derive status string then branch to the correct variant.
        const b2 = mapBindings(b, (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          return rec.status as string;
        }, '_status');
        return branch(b2,
          (bb) => (bb._status as string) === 'stale',
          (bb) => complete(bb, 'stale', { origin, lastSeen: '' }),
          (bb) => branch(bb,
            (bbb) => (bbb._status as string) === 'unreachable',
            (bbb) => complete(bbb, 'unreachable', { origin, message: 'Origin is unreachable' }),
            (bbb) => complete(bbb, 'connected', { origin }),
          ),
        );
      },
    ) as StorageProgram<Result>;
  },

  // action batchResolve(origin, entityIds)
  // Parses entityIds JSON array, resolves each via the same placeholder logic,
  // returns results as JSON array. Real dispatch happens via syncs.
  batchResolve(input: Record<string, unknown>) {
    const origin = input.origin as string;
    const entityIdsRaw = input.entityIds as string;

    // Parse the entityIds JSON array before touching storage.
    let entityIds: string[];
    try {
      const parsed = typeof entityIdsRaw === 'string' ? JSON.parse(entityIdsRaw) : entityIdsRaw;
      if (!Array.isArray(parsed)) {
        return complete(createProgram(), 'notfound', { message: 'entityIds must be a JSON array' }) as StorageProgram<Result>;
      }
      entityIds = parsed as string[];
    } catch {
      return complete(createProgram(), 'notfound', { message: 'entityIds is not valid JSON' }) as StorageProgram<Result>;
    }

    let p = createProgram();
    p = get(p, 'origin', origin, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No origin registered with id "${origin}"` }),
      (b) => {
        return completeFrom(b, 'ok', (bindings) => {
          const rec = bindings.existing as Record<string, unknown>;
          const results = entityIds.map((entityId) => ({
            entityId,
            fields: JSON.stringify({ entityId, origin: rec.origin, kind: rec.kind }),
          }));
          return { results: JSON.stringify(results) };
        });
      },
    ) as StorageProgram<Result>;
  },

  // action get(origin) — standard reader
  get(input: Record<string, unknown>) {
    const origin = input.origin as string;

    let p = createProgram();
    p = get(p, 'origin', origin, 'existing');

    return branch(p,
      (b) => b.existing == null,
      (b) => complete(b, 'notfound', { message: `No origin registered with id "${origin}"` }),
      (b) => completeFrom(b, 'ok', (bindings) => {
        const rec = bindings.existing as Record<string, unknown>;
        return {
          origin: rec.origin as string,
          kind: rec.kind as string,
          qualifier: rec.qualifier as string,
          displayName: rec.displayName as string,
          status: rec.status as string,
          resolverConfig: rec.resolverConfig as string,
        };
      }),
    ) as StorageProgram<Result>;
  },

  // action list() — return all origins as JSON
  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'origin', {}, 'allOrigins');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allOrigins ?? []) as Array<Record<string, unknown>>;
      const origins = all.map((r) => ({
        id: r.origin,
        kind: r.kind,
        qualifier: r.qualifier,
        displayName: r.displayName,
        icon: r.icon ?? null,
        status: r.status,
        resolverConfig: r.resolverConfig,
      }));
      return { origins: JSON.stringify(origins) };
    }) as StorageProgram<Result>;
  },

  // action listByKind(kind) — filter by kind
  listByKind(input: Record<string, unknown>) {
    const kind = input.kind as string;

    let p = createProgram();
    p = find(p, 'origin', {}, 'allOrigins');
    return completeFrom(p, 'ok', (bindings) => {
      const all = (bindings.allOrigins ?? []) as Array<Record<string, unknown>>;
      const origins = all
        .filter((r) => r.kind === kind)
        .map((r) => ({
          id: r.origin,
          kind: r.kind,
          qualifier: r.qualifier,
          displayName: r.displayName,
          icon: r.icon ?? null,
          status: r.status,
          resolverConfig: r.resolverConfig,
        }));
      return { origins: JSON.stringify(origins) };
    }) as StorageProgram<Result>;
  },

};

export const originHandler = autoInterpret(_handler);
