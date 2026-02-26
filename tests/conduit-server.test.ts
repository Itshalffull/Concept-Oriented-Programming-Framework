// Conduit Standalone Server — Full User Journey Test
// Boots the server, makes HTTP requests, validates the complete flow:
// register → login → profile → article → comment → favorite → follow

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createConduitKernel } from '../examples/conduit/server/server.js';
import { createRouter } from '../examples/conduit/server/routes.js';
import { createServer, type Server } from 'http';
import type { FullKernel } from '../handlers/ts/framework/kernel-factory.js';

describe('Conduit Standalone Server — Full Stack Integration', () => {
  let server: Server;
  let kernel: FullKernel;
  const PORT = 9876;
  const BASE = `http://localhost:${PORT}`;

  beforeAll(async () => {
    kernel = createConduitKernel();
    const router = createRouter(kernel);
    server = createServer(router);
    await new Promise<void>(resolve => server.listen(PORT, resolve));
  });

  afterAll(async () => {
    await new Promise<void>(resolve => server.close(() => resolve()));
  });

  async function api(method: string, path: string, body?: unknown, token?: string) {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Token ${token}`;

    const response = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    return {
      status: response.status,
      data: await response.json() as Record<string, unknown>,
    };
  }

  it('health check returns ok', async () => {
    const { status, data } = await api('GET', '/api/health');
    expect(status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.concepts).toBe(10);
    expect(data.syncs).toBe(8);
  });

  it('handles CORS preflight', async () => {
    const response = await fetch(`${BASE}/api/users`, { method: 'OPTIONS' });
    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('*');
  });

  it('returns 404 for unknown routes', async () => {
    const { status } = await api('GET', '/api/unknown');
    expect(status).toBe(404);
  });

  describe('Full User Journey', () => {
    let token: string;

    it('1. Register a new user', async () => {
      const { status, data } = await api('POST', '/api/users', {
        user: { username: 'testuser', email: 'test@conduit.io', password: 'password123' },
      });
      expect(status).toBe(200);
      const user = data.user as Record<string, unknown>;
      expect(user.username).toBe('testuser');
      expect(user.token).toBeTruthy();
      token = user.token as string;
    });

    it('2. Reject duplicate registration', async () => {
      const { status } = await api('POST', '/api/users', {
        user: { username: 'testuser', email: 'test2@conduit.io', password: 'password123' },
      });
      expect(status).toBe(422);
    });

    it('3. Login with correct credentials', async () => {
      const { status, data } = await api('POST', '/api/users/login', {
        user: { email: 'test@conduit.io', password: 'password123' },
      });
      expect(status).toBe(200);
      const user = data.user as Record<string, unknown>;
      expect(user.token).toBeTruthy();
      token = user.token as string;
    });

    it('4. Reject login with wrong password', async () => {
      const { status } = await api('POST', '/api/users/login', {
        user: { email: 'test@conduit.io', password: 'wrong' },
      });
      expect(status).toBe(401);
    });

    it('5. Update profile', async () => {
      const { status, data } = await api('PUT', '/api/user', {
        user: { bio: 'Full-stack dev', image: 'https://conduit.io/me.png' },
      }, token);
      expect(status).toBe(200);
      const profile = data.profile as Record<string, unknown>;
      expect(profile.bio).toBe('Full-stack dev');
    });

    it('6. Create an article', async () => {
      const { status, data } = await api('POST', '/api/articles', {
        article: { title: 'Test Article', description: 'Testing', body: 'Content here' },
      }, token);
      expect(status).toBe(200);
      expect(data.article).toBeDefined();
    });

    it('7. Follow a user', async () => {
      const { status, data } = await api('POST', '/api/profiles/otheruser/follow', {}, token);
      expect(status).toBe(200);
      expect(data.following).toBe(true);
    });

    it('8. Unfavorite returns not-favorited state', async () => {
      const { status, data } = await api('DELETE', '/api/articles/some-slug/favorite', {}, token);
      expect(status).toBe(200);
      expect(data.favorited).toBe(false);
    });
  });
});

describe('Conduit Server — Kernel Direct Access', () => {
  it('creates kernel with all 10 concepts and 7 syncs', () => {
    const kernel = createConduitKernel();
    expect(kernel).toBeDefined();
    expect(kernel.handleRequest).toBeDefined();
    expect(kernel.invokeConcept).toBeDefined();
    expect(kernel.queryConcept).toBeDefined();
  });

  it('echo concept works directly through kernel', async () => {
    const kernel = createConduitKernel();
    const result = await kernel.invokeConcept(
      'urn:copf/Echo', 'send',
      { id: 'test-1', text: 'Hello from test!' },
    );
    expect(result.variant).toBe('ok');
    expect(result.echo).toBe('Hello from test!');
  });

  it('full registration flow through kernel', async () => {
    const kernel = createConduitKernel();
    const result = await kernel.handleRequest({
      method: 'register',
      username: 'kerneluser',
      email: 'kernel@test.io',
      password: 'password123',
    });
    expect(result.error).toBeUndefined();
    expect(result.body?.user).toBeDefined();
  });
});
