// Collection Concept Implementation
// Organize content into queryable sets: concrete (manually curated) or virtual (computed from a query).
import type { ConceptHandler } from '@copf/kernel';

export const collectionHandler: ConceptHandler = {
  async create(input, storage) {
    const collection = input.collection as string;
    const type = input.type as string;
    const schema = input.schema as string;

    const existing = await storage.get('collection', collection);
    if (existing) {
      return { variant: 'exists' };
    }

    const now = new Date().toISOString();

    await storage.put('collection', collection, {
      collection,
      type,
      schema,
      members: JSON.stringify([]),
      query: '',
      templates: '',
      createdAt: now,
      updatedAt: now,
    });

    return { variant: 'ok' };
  },

  async addMember(input, storage) {
    const collection = input.collection as string;
    const member = input.member as string;

    const existing = await storage.get('collection', collection);
    if (!existing) {
      return { variant: 'notfound' };
    }

    const members: string[] = JSON.parse(existing.members as string);
    if (!members.includes(member)) {
      members.push(member);
    }

    await storage.put('collection', collection, {
      ...existing,
      members: JSON.stringify(members),
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async removeMember(input, storage) {
    const collection = input.collection as string;
    const member = input.member as string;

    const existing = await storage.get('collection', collection);
    if (!existing) {
      return { variant: 'notfound' };
    }

    const members: string[] = JSON.parse(existing.members as string);
    const filtered = members.filter(m => m !== member);

    await storage.put('collection', collection, {
      ...existing,
      members: JSON.stringify(filtered),
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async getMembers(input, storage) {
    const collection = input.collection as string;

    const existing = await storage.get('collection', collection);
    if (!existing) {
      return { variant: 'notfound' };
    }

    const members: string[] = JSON.parse(existing.members as string);

    return { variant: 'ok', members: JSON.stringify(members) };
  },

  async setSchema(input, storage) {
    const collection = input.collection as string;
    const schema = input.schema as string;

    const existing = await storage.get('collection', collection);
    if (!existing) {
      return { variant: 'notfound' };
    }

    await storage.put('collection', collection, {
      ...existing,
      schema,
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok' };
  },

  async createVirtual(input, storage) {
    const collection = input.collection as string;
    const query = input.query as string;

    const existing = await storage.get('collection', collection);
    if (existing) {
      return { variant: 'exists' };
    }

    const now = new Date().toISOString();

    await storage.put('collection', collection, {
      collection,
      type: 'virtual',
      schema: '',
      members: JSON.stringify([]),
      query,
      templates: '',
      createdAt: now,
      updatedAt: now,
    });

    return { variant: 'ok' };
  },

  async materialize(input, storage) {
    const collection = input.collection as string;

    const existing = await storage.get('collection', collection);
    if (!existing) {
      return { variant: 'notfound' };
    }

    // For virtual collections, materialize by evaluating the stored query.
    // In a real system this would execute the query against a data source.
    // Here we return the current members as the materialized result.
    const members: string[] = JSON.parse(existing.members as string);

    // Mark the collection as materialized
    await storage.put('collection', collection, {
      ...existing,
      type: 'materialized',
      updatedAt: new Date().toISOString(),
    });

    return { variant: 'ok', members: JSON.stringify(members) };
  },
};
