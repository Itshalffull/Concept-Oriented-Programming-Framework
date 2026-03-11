import type { ConceptHandler, ConceptStorage } from '../../runtime/types';

const ACCOUNT_URL = process.env.CLEF_ACCOUNT_URL ?? 'http://localhost:4001';

export const accountProxyHandler: ConceptHandler = {
  async authenticate(input: Record<string, unknown>, _storage: ConceptStorage) {
    const token = input.token as string;

    try {
      const res = await globalThis.fetch(`${ACCOUNT_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });

      if (!res.ok) {
        return { variant: 'invalid', message: 'Authentication failed' };
      }

      const data = (await res.json()) as { user: unknown };
      return { variant: 'ok', user: data.user };
    } catch (err) {
      return { variant: 'unavailable', message: String(err) };
    }
  },

  async checkPermission(input: Record<string, unknown>, _storage: ConceptStorage) {
    const user = input.user as string;
    const permission = input.permission as string;

    try {
      const res = await globalThis.fetch(`${ACCOUNT_URL}/api/authz/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, permission }),
      });

      if (!res.ok) {
        return { variant: 'denied' };
      }

      const data = (await res.json()) as { outcome: string };
      return { variant: data.outcome === 'allowed' ? 'allowed' : 'denied' };
    } catch (err) {
      return { variant: 'unavailable', message: String(err) };
    }
  },
};
