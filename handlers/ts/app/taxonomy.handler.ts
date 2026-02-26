// Taxonomy Concept Implementation
import type { ConceptHandler } from '@clef/runtime';

export const taxonomyHandler: ConceptHandler = {
  async createVocabulary(input, storage) {
    const vocab = input.vocab as string;
    const name = input.name as string;

    const existing = await storage.get('taxonomy', vocab);
    if (existing) {
      return { variant: 'exists', message: 'Vocabulary already exists' };
    }

    await storage.put('taxonomy', vocab, {
      vocab,
      name,
      terms: JSON.stringify([]),
      termParents: JSON.stringify({}),
      termIndex: JSON.stringify({}),
      createdAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async addTerm(input, storage) {
    const vocab = input.vocab as string;
    const term = input.term as string;
    const parent = input.parent as string | undefined;

    const existing = await storage.get('taxonomy', vocab);
    if (!existing) {
      return { variant: 'notfound', message: 'Vocabulary not found' };
    }

    const terms: string[] = JSON.parse(existing.terms as string);
    const termParents: Record<string, string> = JSON.parse(existing.termParents as string);
    const termIndex: Record<string, string[]> = JSON.parse(existing.termIndex as string);

    if (parent && !terms.includes(parent)) {
      return { variant: 'notfound', message: 'Parent term not found' };
    }

    if (!terms.includes(term)) {
      terms.push(term);
    }

    if (parent) {
      termParents[term] = parent;
    }

    if (!termIndex[term]) {
      termIndex[term] = [];
    }

    await storage.put('taxonomy', vocab, {
      ...existing,
      terms: JSON.stringify(terms),
      termParents: JSON.stringify(termParents),
      termIndex: JSON.stringify(termIndex),
    });

    return { variant: 'ok' };
  },

  async setParent(input, storage) {
    const vocab = input.vocab as string;
    const term = input.term as string;
    const parent = input.parent as string;

    const existing = await storage.get('taxonomy', vocab);
    if (!existing) {
      return { variant: 'notfound', message: 'Vocabulary not found' };
    }

    const terms: string[] = JSON.parse(existing.terms as string);

    if (!terms.includes(term)) {
      return { variant: 'notfound', message: 'Term not found' };
    }

    if (!terms.includes(parent)) {
      return { variant: 'notfound', message: 'Parent term not found' };
    }

    const termParents: Record<string, string> = JSON.parse(existing.termParents as string);
    termParents[term] = parent;

    await storage.put('taxonomy', vocab, {
      ...existing,
      termParents: JSON.stringify(termParents),
    });

    return { variant: 'ok' };
  },

  async tagEntity(input, storage) {
    const entity = input.entity as string;
    const vocab = input.vocab as string;
    const term = input.term as string;

    const existing = await storage.get('taxonomy', vocab);
    if (!existing) {
      return { variant: 'notfound', message: 'Vocabulary not found' };
    }

    const terms: string[] = JSON.parse(existing.terms as string);
    if (!terms.includes(term)) {
      return { variant: 'notfound', message: 'Term not found' };
    }

    const termIndex: Record<string, string[]> = JSON.parse(existing.termIndex as string);

    if (!termIndex[term]) {
      termIndex[term] = [];
    }

    if (!termIndex[term].includes(entity)) {
      termIndex[term].push(entity);
    }

    await storage.put('taxonomy', vocab, {
      ...existing,
      termIndex: JSON.stringify(termIndex),
    });

    return { variant: 'ok' };
  },

  async untagEntity(input, storage) {
    const entity = input.entity as string;
    const vocab = input.vocab as string;
    const term = input.term as string;

    const existing = await storage.get('taxonomy', vocab);
    if (!existing) {
      return { variant: 'notfound', message: 'Vocabulary not found' };
    }

    const terms: string[] = JSON.parse(existing.terms as string);
    if (!terms.includes(term)) {
      return { variant: 'notfound', message: 'Term not found' };
    }

    const termIndex: Record<string, string[]> = JSON.parse(existing.termIndex as string);

    if (!termIndex[term] || !termIndex[term].includes(entity)) {
      return { variant: 'notfound', message: 'Entity is not associated with this term' };
    }

    termIndex[term] = termIndex[term].filter(e => e !== entity);

    await storage.put('taxonomy', vocab, {
      ...existing,
      termIndex: JSON.stringify(termIndex),
    });

    return { variant: 'ok' };
  },
};
