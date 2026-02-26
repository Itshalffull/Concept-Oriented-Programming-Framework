// ============================================================
// DevServer Handler Tests
//
// Local development server lifecycle: start, stop, and status.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  devServerHandler,
  resetDevServerCounter,
} from '../implementations/typescript/dev-server.impl.js';

describe('DevServer', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetDevServerCounter();
  });

  describe('start', () => {
    it('starts a dev server on a given port', async () => {
      const result = await devServerHandler.start!(
        { port: 3000, watchDirs: ['./src', './kits'] },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.session).toBe('dev-server-1');
      expect(result.port).toBe(3000);
      expect(result.url).toBe('http://localhost:3000');
    });

    it('returns portInUse when port is already taken', async () => {
      await devServerHandler.start!(
        { port: 3000, watchDirs: ['./src'] },
        storage,
      );
      const result = await devServerHandler.start!(
        { port: 3000, watchDirs: ['./src'] },
        storage,
      );
      expect(result.variant).toBe('portInUse');
      expect(result.port).toBe(3000);
    });

    it('allows starting on different ports', async () => {
      const first = await devServerHandler.start!(
        { port: 3000, watchDirs: ['./src'] },
        storage,
      );
      const second = await devServerHandler.start!(
        { port: 3001, watchDirs: ['./src'] },
        storage,
      );
      expect(first.variant).toBe('ok');
      expect(second.variant).toBe('ok');
      expect(first.session).not.toBe(second.session);
    });

    it('stores server session in storage', async () => {
      await devServerHandler.start!(
        { port: 8080, watchDirs: ['./src'] },
        storage,
      );
      const stored = await storage.get('dev-server', 'dev-server-1');
      expect(stored).not.toBeNull();
      expect(stored!.status).toBe('running');
      expect(stored!.port).toBe(8080);
    });
  });

  describe('stop', () => {
    it('stops a running dev server', async () => {
      await devServerHandler.start!(
        { port: 3000, watchDirs: ['./src'] },
        storage,
      );
      const result = await devServerHandler.stop!(
        { session: 'dev-server-1' },
        storage,
      );
      expect(result.variant).toBe('ok');

      const stored = await storage.get('dev-server', 'dev-server-1');
      expect(stored!.status).toBe('stopped');
    });

    it('handles stopping non-existent session gracefully', async () => {
      const result = await devServerHandler.stop!(
        { session: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('ok');
    });

    it('allows restarting on same port after stop', async () => {
      await devServerHandler.start!(
        { port: 3000, watchDirs: ['./src'] },
        storage,
      );
      await devServerHandler.stop!(
        { session: 'dev-server-1' },
        storage,
      );
      const result = await devServerHandler.start!(
        { port: 3000, watchDirs: ['./src'] },
        storage,
      );
      expect(result.variant).toBe('ok');
    });
  });

  describe('status', () => {
    it('returns running status with uptime for active server', async () => {
      await devServerHandler.start!(
        { port: 3000, watchDirs: ['./src'] },
        storage,
      );
      const result = await devServerHandler.status!(
        { session: 'dev-server-1' },
        storage,
      );
      expect(result.variant).toBe('running');
      expect(result.port).toBe(3000);
      expect(result.uptime).toBeGreaterThanOrEqual(0);
    });

    it('returns stopped for non-existent session', async () => {
      const result = await devServerHandler.status!(
        { session: 'nonexistent' },
        storage,
      );
      expect(result.variant).toBe('stopped');
    });

    it('returns stopped after server is stopped', async () => {
      await devServerHandler.start!(
        { port: 3000, watchDirs: ['./src'] },
        storage,
      );
      await devServerHandler.stop!(
        { session: 'dev-server-1' },
        storage,
      );
      const result = await devServerHandler.status!(
        { session: 'dev-server-1' },
        storage,
      );
      expect(result.variant).toBe('stopped');
    });
  });
});
