// @clef-handler style=functional
// @migrated dsl-constructs 2026-03-18
// Tag Concept Implementation (Classification Kit)
import type { FunctionalConceptHandler } from '../../../runtime/functional-handler.ts';
import {
  createProgram, get as spGet, find, put, putFrom, branch, complete, completeFrom, mapBindings,
  type StorageProgram,
} from '../../../runtime/storage-program.ts';
import { autoInterpret } from '../../../runtime/functional-compat.ts';

const _tagHandler: FunctionalConceptHandler = {
  add(input: Record<string, unknown>) {
    const tag = input.tag as string;
    const article = input.article as string;
    let p = createProgram();
    p = spGet(p, 'tag', tag, 'existing');
    p = putFrom(p, 'tag', tag, (bindings) => {
      const existing = bindings.existing as Record<string, unknown> | null;
      const articles: string[] = existing ? (existing.articles as string[]) || [] : [];
      if (!articles.includes(article)) articles.push(article);
      return { tag, articles };
    });
    return complete(p, 'ok', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  remove(input: Record<string, unknown>) {
    const tag = input.tag as string;
    const article = input.article as string;
    let p = createProgram();
    p = spGet(p, 'tag', tag, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'tag', tag, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const articles: string[] = (existing.articles as string[]) || [];
          return { tag, articles: articles.filter(a => a !== article) };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Tag does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  list(_input: Record<string, unknown>) {
    let p = createProgram();
    p = find(p, 'tag', {}, 'allTags');
    p = completeFrom(p, 'ok', (bindings) => {
      const allTags = (bindings.allTags as Array<Record<string, unknown>>) || [];
      return { tags: JSON.stringify(allTags.map(record => record.tag as string)) };
    });
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  addTag(input: Record<string, unknown>) {
    if (!input.entity || (typeof input.entity === 'string' && (input.entity as string).trim() === '')) {
      return complete(createProgram(), 'notfound', { message: 'entity is required' }) as StorageProgram<Result>;
    }
    const entity = input.entity as string;
    const tag = input.tag as string;
    let p = createProgram();
    p = spGet(p, 'tag', tag, 'existing');
    p = putFrom(p, 'tag', tag, (bindings) => {
      const existing = (bindings.existing as Record<string, unknown>) || { tag, tagIndex: '[]', articles: [] };
      const tagIndex: string[] = existing.tagIndex ? JSON.parse(existing.tagIndex as string) : [];
      if (!tagIndex.includes(entity)) tagIndex.push(entity);
      return { ...existing, tagIndex: JSON.stringify(tagIndex) };
    });
    return complete(p, 'ok', {}) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  removeTag(input: Record<string, unknown>) {
    const entity = input.entity as string;
    const tag = input.tag as string;
    let p = createProgram();
    p = spGet(p, 'tag', tag, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'tag', tag, (bindings) => {
          const existing = bindings.existing as Record<string, unknown>;
          const tagIndex: string[] = JSON.parse(existing.tagIndex as string);
          return { ...existing, tagIndex: JSON.stringify(tagIndex.filter(e => e !== entity)) };
        });
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Tag does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getByTag(input: Record<string, unknown>) {
    if (!input.tag || (typeof input.tag === 'string' && (input.tag as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'tag is required' }) as StorageProgram<Result>;
    }
    const tag = input.tag as string;
    let p = createProgram();
    p = spGet(p, 'tag', tag, 'existing');
    p = mapBindings(p, (bindings) => {
      const existing = bindings.existing as Record<string, unknown> | null;
      const entities: string[] = existing && existing.tagIndex ? JSON.parse(existing.tagIndex as string) : [];
      return entities.length === 1 ? entities[0] : entities.join(',');
    }, 'entitiesValue');
    return completeFrom(p, 'ok', (bindings) => ({ entities: bindings.entitiesValue as string })) as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  getChildren(input: Record<string, unknown>) {
    if (!input.tag || (typeof input.tag === 'string' && (input.tag as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'tag is required' }) as StorageProgram<Result>;
    }
    const tag = input.tag as string;
    let p = createProgram();
    p = spGet(p, 'tag', tag, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = find(b, 'tag', {}, 'allTags');
        b2 = mapBindings(b2, (bindings) => {
          const allTags = (bindings.allTags as Array<Record<string, unknown>>) || [];
          return JSON.stringify(allTags.filter(r => r.parent === tag).map(r => r.tag as string));
        }, 'childrenJson');
        return completeFrom(b2, 'ok', (bindings) => ({ children: bindings.childrenJson as string }));
      },
      (b) => complete(b, 'ok', { children: '[]' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },

  rename(input: Record<string, unknown>) {
    if (!input.tag || (typeof input.tag === 'string' && (input.tag as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'tag is required' }) as StorageProgram<Result>;
    }
    if (!input.name || (typeof input.name === 'string' && (input.name as string).trim() === '')) {
      return complete(createProgram(), 'error', { message: 'name is required' }) as StorageProgram<Result>;
    }
    const tag = input.tag as string;
    const name = input.name as string;
    let p = createProgram();
    p = spGet(p, 'tag', tag, 'existing');
    p = branch(p, 'existing',
      (b) => {
        let b2 = putFrom(b, 'tag', tag, (bindings) => ({ ...(bindings.existing as Record<string, unknown>), name }));
        return complete(b2, 'ok', {});
      },
      (b) => complete(b, 'notfound', { message: 'Tag does not exist' }),
    );
    return p as StorageProgram<{ variant: string; [key: string]: unknown }>;
  },
};

export const tagHandler = autoInterpret(_tagHandler);

