// User Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const userHandler: ConceptHandler = {
  async register(input, storage) {
    const user = input.user as string;
    const name = input.name as string;
    const email = input.email as string;

    // Check for duplicate name
    const existingByName = await storage.find('user', { name });
    if (existingByName.length > 0) {
      return { variant: 'error', message: 'name already taken' };
    }

    // Check for duplicate email
    const existingByEmail = await storage.find('user', { email });
    if (existingByEmail.length > 0) {
      return { variant: 'error', message: 'email already taken' };
    }

    await storage.put('user', user, { user, name, email });

    return { variant: 'ok', user };
  },
};
