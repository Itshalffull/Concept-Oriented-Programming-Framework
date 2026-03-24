// @clef-handler style=functional
// ============================================================
// SemanticRouter Concept Implementation
//
// Routes user messages to appropriate processing pipelines based
// on semantic intent rather than keyword matching. Uses embedding
// similarity to match incoming messages against predefined route
// exemplars. Enables topic-specific handling, guardrail selection,
// and pipeline branching without explicit classification models.
// ============================================================

import type { FunctionalConceptHandler } from '../../../../runtime/functional-handler.ts';
import {
  createProgram, get, put, putFrom, find, branch, complete, completeFrom,
  mapBindings, type StorageProgram,
} from '../../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../../runtime/functional-compat.ts';

type Result = { variant: string; [key: string]: unknown };

let _routeCounter = 0;
function generateRouteId(): string {
  return `route-${Date.now()}-${++_routeCounter}`;
}

/**
 * Stub semantic similarity. Production would use actual embeddings
 * via the VectorIndex concept through syncs.
 */
function semanticSimilarity(text: string, exemplar: string): number {
  const tWords = new Set(text.toLowerCase().split(/\s+/));
  const eWords = new Set(exemplar.toLowerCase().split(/\s+/));
  let overlap = 0;
  for (const w of tWords) {
    if (eWords.has(w)) overlap++;
  }
  const union = new Set([...tWords, ...eWords]).size;
  return union === 0 ? 0 : overlap / union;
}

const _semanticRouterHandler: FunctionalConceptHandler = {
  define(input: Record<string, unknown>) {
    const name = input.name as string;
    const exemplars = input.exemplars as string[];
    const targetPipeline = input.target_pipeline as string;
    const threshold = input.threshold as number;

    if (!name || name.trim() === '') {
      return complete(createProgram(), 'invalid', { message: 'name is required' }) as StorageProgram<Result>;
    }
    if (!exemplars || exemplars.length === 0) {
      return complete(createProgram(), 'invalid', { message: 'Missing exemplars' }) as StorageProgram<Result>;
    }
    if (threshold < 0 || threshold > 1) {
      return complete(createProgram(), 'invalid', { message: 'Invalid threshold: must be 0.0-1.0' }) as StorageProgram<Result>;
    }

    const id = generateRouteId();
    let p = createProgram();
    p = put(p, 'routes', id, {
      id,
      name,
      exemplars: exemplars.map(text => ({ text, embedding: null })),
      target_pipeline: targetPipeline,
      threshold,
    });

    return complete(p, 'ok', { route: id }) as StorageProgram<Result>;
  },

  route(input: Record<string, unknown>) {
    const message = input.message as string;

    let p = createProgram();
    p = find(p, 'routes', {}, 'allRoutes');

    // Also check for fallback
    p = get(p, 'config', 'fallback', 'fallbackConfig');

    p = mapBindings(p, (bindings) => {
      const routes = bindings.allRoutes as Record<string, unknown>[];
      let bestRoute: Record<string, unknown> | null = null;
      let bestScore = -1;

      for (const route of routes) {
        const exemplars = route.exemplars as { text: string }[];
        const threshold = route.threshold as number;

        for (const exemplar of exemplars) {
          const score = semanticSimilarity(message, exemplar.text);
          if (score >= threshold && score > bestScore) {
            bestScore = score;
            bestRoute = route;
          }
        }
      }

      if (bestRoute) {
        return {
          matched: true,
          route: bestRoute.id,
          pipeline: bestRoute.target_pipeline,
          confidence: bestScore,
        };
      }
      return { matched: false };
    }, 'routeResult');

    return branch(p,
      (bindings) => (bindings.routeResult as Record<string, unknown>).matched === true,
      completeFrom(createProgram(), 'ok', (bindings) => {
        const result = bindings.routeResult as Record<string, unknown>;
        return {
          route: result.route as string,
          pipeline: result.pipeline as string,
          confidence: result.confidence as number,
        };
      }),
      (() => {
        // Check for fallback
        let fb = createProgram();
        fb = get(fb, 'config', 'fallback', 'fallbackConfig');
        return branch(fb,
          (bindings) => !!bindings.fallbackConfig,
          completeFrom(createProgram(), 'fallback', (bindings) => {
            const config = bindings.fallbackConfig as Record<string, unknown>;
            return { pipeline: config.pipeline as string };
          }),
          complete(createProgram(), 'no_match', { message: 'No route exceeds threshold' }),
        );
      })(),
    ) as StorageProgram<Result>;
  },

  addExemplar(input: Record<string, unknown>) {
    const routeId = input.route as string;
    const text = input.text as string;

    let p = createProgram();
    p = get(p, 'routes', routeId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Route not found' }),
      (() => {
        let b = createProgram();
        b = get(b, 'routes', routeId, 'existing');
        b = putFrom(b, 'routes', routeId, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const exemplars = [...(existing.exemplars as { text: string; embedding: unknown }[])];
          exemplars.push({ text, embedding: null });
          return { ...existing, exemplars };
        });
        return complete(b, 'ok', { route: routeId });
      })(),
    ) as StorageProgram<Result>;
  },

  setFallback(input: Record<string, unknown>) {
    const pipeline = input.pipeline as string;

    let p = createProgram();
    p = put(p, 'config', 'fallback', { pipeline });

    return complete(p, 'ok', {}) as StorageProgram<Result>;
  },

  getRoutes(input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'routes', {}, 'allRoutes');

    p = mapBindings(p, (bindings) => {
      const routes = bindings.allRoutes as Record<string, unknown>[];
      return routes.map(r => ({
        name: r.name as string,
        pipeline: r.target_pipeline as string,
        exemplar_count: (r.exemplars as unknown[]).length,
        threshold: r.threshold as number,
      }));
    }, 'routeList');

    return completeFrom(p, 'ok', (bindings) => ({
      routes: bindings.routeList as unknown[],
    })) as StorageProgram<Result>;
  },

  removeRoute(input: Record<string, unknown>) {
    const routeId = input.route as string;

    let p = createProgram();
    p = get(p, 'routes', routeId, 'existing');

    return branch(p,
      (bindings) => !bindings.existing,
      complete(createProgram(), 'notfound', { message: 'Route not found' }),
      (() => {
        let b = createProgram();
        b = put(b, 'routes', routeId, null as unknown as Record<string, unknown>);
        return complete(b, 'ok', {});
      })(),
    ) as StorageProgram<Result>;
  },
};

export const semanticRouterHandler = autoInterpret(_semanticRouterHandler);
