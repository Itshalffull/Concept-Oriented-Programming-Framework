// Reference Concept Implementation
import type { ConceptHandler, ConceptStorage } from '../../../runtime/types.js';

export const referenceHandler: ConceptHandler = {
  async addRef(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;
    const target = input.target as string;

    const existing = await storage.get('reference', source);
    const refs: string[] = existing
      ? JSON.parse(existing.refs as string)
      : [];

    if (refs.includes(target)) {
      return { variant: 'exists', source, target };
    }

    refs.push(target);

    await storage.put('reference', source, {
      source,
      refs: JSON.stringify(refs),
    });

    return { variant: 'ok', source, target };
  },

  async removeRef(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;
    const target = input.target as string;

    const existing = await storage.get('reference', source);
    if (!existing) {
      return { variant: 'notfound', source, target };
    }

    const refs: string[] = JSON.parse(existing.refs as string);

    if (!refs.includes(target)) {
      return { variant: 'notfound', source, target };
    }

    const updated = refs.filter(r => r !== target);

    await storage.put('reference', source, {
      source,
      refs: JSON.stringify(updated),
    });

    return { variant: 'ok', source, target };
  },

  async getRefs(input: Record<string, unknown>, storage: ConceptStorage) {
    const source = input.source as string;

    const existing = await storage.get('reference', source);
    if (!existing) {
      return { variant: 'notfound', source };
    }

    const refs: string[] = JSON.parse(existing.refs as string);

    // Return single ref as plain string, multiple as comma-separated
    const targets = refs.length === 1 ? refs[0] : refs.join(',');
    return { variant: 'ok', targets };
  },

  async resolveTarget(input: Record<string, unknown>, storage: ConceptStorage) {
    const target = input.target as string;

    const allRefs = await storage.find('reference');
    let exists = false;

    for (const record of allRefs) {
      const refs: string[] = JSON.parse(record.refs as string);
      if (refs.includes(target)) {
        exists = true;
        break;
      }
    }

    return { variant: 'ok', exists };
  },
};
