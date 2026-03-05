import type { ConceptHandler, ConceptStorage } from '../../runtime/types';
import { createHash, randomUUID } from 'crypto';

export const authenticationHandler: ConceptHandler = {
  async register(input: Record<string, unknown>, storage: ConceptStorage) {
    const user = input.user as string;
    const provider = input.provider as string;
    const credentials = input.credentials as string;

    const existing = await storage.get('account', user);
    if (existing) {
      return { variant: 'exists', message: 'Account already exists' };
    }

    const hashed = createHash('sha256').update(credentials).digest('hex');
    await storage.put('account', user, { user, provider, credentials: hashed });

    return { variant: 'ok', user };
  },

  async login(input: Record<string, unknown>, storage: ConceptStorage) {
    const user = input.user as string;
    const credentials = input.credentials as string;

    const account = await storage.get('account', user);
    if (!account) {
      return { variant: 'invalid', message: 'Account not found' };
    }

    const hashed = createHash('sha256').update(credentials).digest('hex');
    if (account.credentials !== hashed) {
      return { variant: 'invalid', message: 'Invalid credentials' };
    }

    const token = randomUUID();
    await storage.put('token', token, { token, user });

    return { variant: 'ok', token };
  },

  async logout(input: Record<string, unknown>, storage: ConceptStorage) {
    const user = input.user as string;

    const tokens = await storage.find('token', { user });
    if (tokens.length === 0) {
      return { variant: 'notfound', message: 'No active session' };
    }

    for (const t of tokens) {
      await storage.del('token', t.token as string);
    }

    return { variant: 'ok', user };
  },

  async authenticate(input: Record<string, unknown>, storage: ConceptStorage) {
    const token = input.token as string;

    const record = await storage.get('token', token);
    if (!record) {
      return { variant: 'invalid', message: 'Invalid or expired token' };
    }

    return { variant: 'ok', user: record.user };
  },

  async resetPassword(input: Record<string, unknown>, storage: ConceptStorage) {
    const user = input.user as string;
    const newCredentials = input.newCredentials as string;

    const account = await storage.get('account', user);
    if (!account) {
      return { variant: 'notfound', message: 'Account not found' };
    }

    const hashed = createHash('sha256').update(newCredentials).digest('hex');
    await storage.put('account', user, { ...account, credentials: hashed });

    // Invalidate all tokens
    const tokens = await storage.find('token', { user });
    for (const t of tokens) {
      await storage.del('token', t.token as string);
    }

    return { variant: 'ok', user };
  },
};
