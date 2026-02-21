// Authentication Concept Implementation
// Verify user identity via pluggable providers, token-based session auth, and credential reset flows.
import { createHash, randomBytes } from 'crypto';
import type { ConceptHandler } from '@copf/kernel';

export const authenticationHandler: ConceptHandler = {
  async register(input, storage) {
    const user = input.user as string;
    const provider = input.provider as string;
    const credentials = input.credentials as string;

    // Uniqueness check: user must not already have an account
    const existing = await storage.get('account', user);
    if (existing) {
      return { variant: 'exists', message: 'User already has a registered account' };
    }

    // Hash credentials with SHA-256 + salt
    const salt = randomBytes(16).toString('hex');
    const hash = createHash('sha256').update(credentials).update(salt).digest('hex');

    await storage.put('account', user, {
      user,
      provider,
      hash,
      salt,
      tokens: JSON.stringify([]),
    });

    return { variant: 'ok', user };
  },

  async login(input, storage) {
    const user = input.user as string;
    const credentials = input.credentials as string;

    const account = await storage.get('account', user);
    if (!account) {
      return { variant: 'invalid', message: 'Invalid credentials' };
    }

    // Verify credentials by re-hashing with stored salt
    const storedHash = account.hash as string;
    const storedSalt = account.salt as string;
    const hash = createHash('sha256').update(credentials).update(storedSalt).digest('hex');

    if (hash !== storedHash) {
      return { variant: 'invalid', message: 'Credentials do not match' };
    }

    // Generate an opaque authentication token
    const token = randomBytes(32).toString('hex');

    // Store the active token for later validation
    const existingTokens: string[] = JSON.parse((account.tokens as string) || '[]');
    existingTokens.push(token);

    await storage.put('account', user, {
      ...account,
      tokens: JSON.stringify(existingTokens),
    });

    // Store a reverse mapping from token to user for authenticate()
    await storage.put('token', token, { token, user });

    return { variant: 'ok', token };
  },

  async logout(input, storage) {
    const user = input.user as string;

    const account = await storage.get('account', user);
    if (!account) {
      return { variant: 'notfound', message: 'No active session exists for this user' };
    }

    const tokens: string[] = JSON.parse((account.tokens as string) || '[]');
    if (tokens.length === 0) {
      return { variant: 'notfound', message: 'No active session exists for this user' };
    }

    // Remove all token-to-user reverse mappings
    for (const t of tokens) {
      await storage.delete('token', t);
    }

    // Clear all tokens from the account
    await storage.put('account', user, {
      ...account,
      tokens: JSON.stringify([]),
    });

    return { variant: 'ok', user };
  },

  async authenticate(input, storage) {
    const token = input.token as string;

    // Look up the token in the reverse mapping
    const tokenRecord = await storage.get('token', token);
    if (!tokenRecord) {
      return { variant: 'invalid', message: 'Token is expired, malformed, or has been revoked' };
    }

    const user = tokenRecord.user as string;
    return { variant: 'ok', user };
  },

  async resetPassword(input, storage) {
    const user = input.user as string;
    const newCredentials = input.newCredentials as string;

    const account = await storage.get('account', user);
    if (!account) {
      return { variant: 'notfound', message: 'No account exists for this user' };
    }

    // Hash the new credentials
    const salt = randomBytes(16).toString('hex');
    const hash = createHash('sha256').update(newCredentials).update(salt).digest('hex');

    // Invalidate all existing tokens
    const tokens: string[] = JSON.parse((account.tokens as string) || '[]');
    for (const t of tokens) {
      await storage.delete('token', t);
    }

    await storage.put('account', user, {
      ...account,
      hash,
      salt,
      tokens: JSON.stringify([]),
    });

    return { variant: 'ok', user };
  },
};
