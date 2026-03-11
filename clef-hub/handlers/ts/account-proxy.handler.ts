import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

const ACCOUNT_URL = process.env.CLEF_ACCOUNT_URL ?? 'http://localhost:4001';

export const accountProxyHandler: ConceptHandler = {
  async login(input: Record<string, unknown>, _storage: ConceptStorage) {
    const { user, credentials } = input;
    try {
      const res = await globalThis.fetch(`${ACCOUNT_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, credentials }),
      });
      if (!res.ok) {
        return { variant: 'invalid', message: 'Login failed' };
      }
      const data = await res.json();
      return { variant: 'ok', token: data.token };
    } catch (err) {
      return { variant: 'unavailable', message: String(err) };
    }
  },

  async authenticate(input: Record<string, unknown>, _storage: ConceptStorage) {
    const { token } = input;
    try {
      const res = await globalThis.fetch(`${ACCOUNT_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        return { variant: 'invalid', message: 'Authentication failed' };
      }
      const data = await res.json();
      return { variant: 'ok', user: data.user };
    } catch (err) {
      return { variant: 'unavailable', message: String(err) };
    }
  },

  async logout(input: Record<string, unknown>, _storage: ConceptStorage) {
    const { user } = input;
    try {
      await globalThis.fetch(`${ACCOUNT_URL}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user }),
      });
      return { variant: 'ok' };
    } catch (err) {
      return { variant: 'unavailable', message: String(err) };
    }
  },
};
