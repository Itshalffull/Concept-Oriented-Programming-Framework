// Route provider handler tests -- orthogonal-route, bezier-route, polyline-route register and route actions.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { orthogonalRouteHandler } from '../handlers/ts/orthogonal-route.handler.js';
import { bezierRouteHandler } from '../handlers/ts/bezier-route.handler.js';
import { polylineRouteHandler } from '../handlers/ts/polyline-route.handler.js';

describe('Route Providers', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  describe('OrthogonalRoute', () => {
    describe('register', () => {
      it('returns ok with name and category', async () => {
        const result = await orthogonalRouteHandler.register({}, storage);
        expect(result.variant).toBe('ok');
        expect(result.name).toBe('orthogonal-route');
        expect(result.category).toBe('routing');
      });

      it('is idempotent', async () => {
        const r1 = await orthogonalRouteHandler.register({}, storage);
        const r2 = await orthogonalRouteHandler.register({}, storage);
        expect(r1.variant).toBe('ok');
        expect(r2.variant).toBe('ok');
        expect(r1.name).toBe(r2.name);
      });
    });

    describe('route', () => {
      it('returns an L-shaped path between source and target', async () => {
        const result = await orthogonalRouteHandler.route(
          { source: 'item-a', target: 'item-b' },
          storage,
        );
        expect(result.variant).toBe('ok');
        expect(result.path).toHaveLength(4);

        // Orthogonal paths have right-angle segments
        const path = result.path as { x: number; y: number }[];
        expect(path[0]).toEqual({ x: 0, y: 0 });
        expect(path[3]).toEqual({ x: 200, y: 100 });
      });
    });
  });

  describe('BezierRoute', () => {
    describe('register', () => {
      it('returns ok with name and category', async () => {
        const result = await bezierRouteHandler.register({}, storage);
        expect(result.variant).toBe('ok');
        expect(result.name).toBe('bezier-route');
        expect(result.category).toBe('routing');
      });

      it('is idempotent', async () => {
        const r1 = await bezierRouteHandler.register({}, storage);
        const r2 = await bezierRouteHandler.register({}, storage);
        expect(r1.name).toBe(r2.name);
      });
    });

    describe('route', () => {
      it('returns a cubic bezier path with 4 control points', async () => {
        const result = await bezierRouteHandler.route(
          { source: 'item-a', target: 'item-b' },
          storage,
        );
        expect(result.variant).toBe('ok');
        expect(result.path).toHaveLength(4);

        const path = result.path as { x: number; y: number }[];
        // P0 = source, P3 = target
        expect(path[0]).toEqual({ x: 0, y: 0 });
        expect(path[3]).toEqual({ x: 200, y: 100 });
      });
    });
  });

  describe('PolylineRoute', () => {
    describe('register', () => {
      it('returns ok with name and category', async () => {
        const result = await polylineRouteHandler.register({}, storage);
        expect(result.variant).toBe('ok');
        expect(result.name).toBe('polyline-route');
        expect(result.category).toBe('routing');
      });

      it('is idempotent', async () => {
        const r1 = await polylineRouteHandler.register({}, storage);
        const r2 = await polylineRouteHandler.register({}, storage);
        expect(r1.name).toBe(r2.name);
      });
    });

    describe('route', () => {
      it('returns a direct path between source and target', async () => {
        const result = await polylineRouteHandler.route(
          { source: 'item-a', target: 'item-b' },
          storage,
        );
        expect(result.variant).toBe('ok');
        expect(result.path).toHaveLength(2);

        const path = result.path as { x: number; y: number }[];
        expect(path[0]).toEqual({ x: 0, y: 0 });
        expect(path[1]).toEqual({ x: 200, y: 100 });
      });
    });
  });
});
