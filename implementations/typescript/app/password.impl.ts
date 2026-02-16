// Password Concept Implementation
import { createHash, randomBytes } from 'crypto';
import type { ConceptHandler } from '@copf/kernel';

export const passwordHandler: ConceptHandler = {
  async set(input, storage) {
    const user = input.user as string;
    const password = input.password as string;

    if (password.length < 8) {
      return { variant: 'invalid', message: 'Password must be at least 8 characters' };
    }

    const salt = randomBytes(16);
    const hash = createHash('sha256').update(password).update(salt).digest();

    await storage.put('password', user, {
      user,
      hash: hash.toString('base64'),
      salt: salt.toString('base64'),
    });

    return { variant: 'ok', user };
  },

  async check(input, storage) {
    const user = input.user as string;
    const password = input.password as string;

    const record = await storage.get('password', user);
    if (!record) {
      return { variant: 'notfound', message: 'No credentials for user' };
    }

    const salt = Buffer.from(record.salt as string, 'base64');
    const hash = createHash('sha256').update(password).update(salt).digest();
    const storedHash = Buffer.from(record.hash as string, 'base64');

    return { variant: 'ok', valid: hash.equals(storedHash) };
  },

  async validate(input, _storage) {
    const password = input.password as string;
    return { variant: 'ok', valid: password.length >= 8 };
  },
};
