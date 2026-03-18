// @migrated dsl-constructs 2026-03-18
// Taxonomy Concept Implementation
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';

export const taxonomyHandler: FunctionalConceptHandler = {
  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'taxonomy', {}, 'items');
    p = mapBindings(p, (bindings) => JSON.stringify((bindings.items as Array<Record<string, unknown>>) || []), 'itemsJson');
    return complete(p, 'ok', { items: '' }) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  createVocabulary(input: Record<string, unknown>) {
    const vocab = input.vocab as string;
    const name = input.name as string;
    let p = createProgram();
    p = spGet(p, 'taxonomy', vocab, 'existing');
    p = branch(p, 'existing',
      (b) => complete(b, 'exists', { message: 'Vocabulary already exists' }),
      (b) => {
        let b2 = put(b, 'taxonomy', vocab, { vocab, name, terms: JSON.stringify([]), termParents: JSON.stringify({}), termIndex: JSON.stringify({}), createdAt: new Date().toISOString() });
        return complete(b2, 'ok', {});
      },
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  addTerm(input: Record<string, unknown>) {
    const vocab = input.vocab as string;
    const term = input.term as string;
    const parent = input.parent as string | undefined;
    let p = createProgram();
    p = spGet(p, 'taxonomy', vocab, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'taxonomy', vocab, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const terms: string[] = JSON.parse(existing.terms as string);
          const termParents: Record<string, string> = JSON.parse(existing.termParents as string);
          const termIndex: Record<string, string[]> = JSON.parse(existing.termIndex as string);
          if (!terms.includes(term)) terms.push(term);
          if (parent && terms.includes(parent)) termParents[term] = parent;
          if (!termIndex[term]) termIndex[term] = [];
          return { ...existing, terms: JSON.stringify(terms), termParents: JSON.stringify(termParents), termIndex: JSON.stringify(termIndex) };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Vocabulary not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  setParent(input: Record<string, unknown>) {
    const vocab = input.vocab as string;
    const term = input.term as string;
    const parent = input.parent as string;
    let p = createProgram();
    p = spGet(p, 'taxonomy', vocab, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'taxonomy', vocab, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const termParents: Record<string, string> = JSON.parse(existing.termParents as string);
          termParents[term] = parent;
          return { ...existing, termParents: JSON.stringify(termParents) };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Vocabulary not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  tagEntity(input: Record<string, unknown>) {
    const entity = input.entity as string;
    const vocab = input.vocab as string;
    const term = input.term as string;
    let p = createProgram();
    p = spGet(p, 'taxonomy', vocab, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'taxonomy', vocab, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const termIndex: Record<string, string[]> = JSON.parse(existing.termIndex as string);
          if (!termIndex[term]) termIndex[term] = [];
          if (!termIndex[term].includes(entity)) termIndex[term].push(entity);
          return { ...existing, termIndex: JSON.stringify(termIndex) };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Vocabulary not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  untagEntity(input: Record<string, unknown>) {
    const entity = input.entity as string;
    const vocab = input.vocab as string;
    const term = input.term as string;
    let p = createProgram();
    p = spGet(p, 'taxonomy', vocab, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'taxonomy', vocab, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const termIndex: Record<string, string[]> = JSON.parse(existing.termIndex as string);
          if (termIndex[term]) termIndex[term] = termIndex[term].filter(e => e !== entity);
          return { ...existing, termIndex: JSON.stringify(termIndex) };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Vocabulary not found' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};
