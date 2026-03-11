// UISchema Handler — Unit Tests
// Tests inspect, override, getSchema, getElements, getEntityElement, and markResolved.

import { describe, it, expect, beforeEach } from 'vitest';
import { uiSchemaHandler } from '../../handlers/ts/app/ui-schema.handler.js';

interface TestStorage {
  get: (relation: string, key: string) => Promise<Record<string, unknown> | null>;
  put: (relation: string, key: string, value: Record<string, unknown>) => Promise<void>;
  delete: (relation: string, key: string) => Promise<boolean>;
  find: (relation: string, prefix?: string) => Promise<Record<string, unknown>[]>;
}

function createTestStorage(): TestStorage {
  const store = new Map<string, Map<string, Record<string, unknown>>>();
  return {
    get: async (relation, key) => store.get(relation)?.get(key) ?? null,
    put: async (relation, key, value) => {
      if (!store.has(relation)) store.set(relation, new Map());
      store.get(relation)!.set(key, value);
    },
    delete: async (relation, key) => store.get(relation)?.delete(key) ?? false,
    find: async (relation) => [...(store.get(relation)?.values() ?? [])],
  };
}

const approvalSpec = JSON.stringify({
  name: 'Approval',
  suite: 'governance',
  fields: [
    { name: 'status', type: 'String' },
    { name: 'approver', type: 'String' },
    { name: 'reasoning', type: 'String' },
  ],
  actions: ['approve', 'reject', 'request_changes'],
  annotations: {
    surface: { preferredView: 'entity-detail', tags: ['stateful', 'approvable'] },
  },
});

const minimalSpec = JSON.stringify({
  name: 'Simple',
  fields: [{ name: 'title', type: 'String' }],
  actions: ['get'],
});

// ---------------------------------------------------------------------------
// inspect
// ---------------------------------------------------------------------------
describe('uiSchemaHandler.inspect', () => {
  let storage: TestStorage;
  beforeEach(() => { storage = createTestStorage(); });

  it('inspects a concept spec and returns ok with element count', async () => {
    const result = await uiSchemaHandler.inspect!(
      { schema: 'approval-schema', conceptSpec: approvalSpec },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.schema).toBe('approval-schema');
    expect(result.elementCount).toBe(3);
  });

  it('stores entity element with concept metadata', async () => {
    await uiSchemaHandler.inspect!(
      { schema: 'entity-test', conceptSpec: approvalSpec },
      storage,
    );
    const record = await storage.get('uiSchema', 'entity-test');
    expect(record).not.toBeNull();

    const entityElement = JSON.parse(record!.entityElement as string);
    expect(entityElement.kind).toBe('entity');
    expect(entityElement.concept).toBe('Approval');
    expect(entityElement.suite).toBe('governance');
    expect(entityElement.tags).toEqual(['stateful', 'approvable']);
    expect(entityElement.fields).toHaveLength(3);
    expect(entityElement.actions).toEqual(['approve', 'reject', 'request_changes']);
    expect(entityElement.annotations.preferredView).toBe('entity-detail');
  });

  it('stores field elements', async () => {
    await uiSchemaHandler.inspect!(
      { schema: 'field-test', conceptSpec: approvalSpec },
      storage,
    );
    const record = await storage.get('uiSchema', 'field-test');
    const elements = JSON.parse(record!.elements as string);
    expect(elements).toEqual(['status', 'approver', 'reasoning']);
  });

  it('initializes resolved to false', async () => {
    await uiSchemaHandler.inspect!(
      { schema: 'resolved-init', conceptSpec: minimalSpec },
      storage,
    );
    const record = await storage.get('uiSchema', 'resolved-init');
    expect(record!.resolved).toBe(false);
  });

  it('generates schema ID when none provided', async () => {
    const result = await uiSchemaHandler.inspect!(
      { schema: '', conceptSpec: minimalSpec },
      storage,
    );
    expect(result.variant).toBe('ok');
    // Schema ID should be auto-generated (starts with 'S-')
    expect((result.schema as string).length).toBeGreaterThan(0);
  });

  it('handles concept spec with string-only fields', async () => {
    const spec = JSON.stringify({
      name: 'StringFields',
      fields: ['title', 'body', 'author'],
      actions: [],
    });
    const result = await uiSchemaHandler.inspect!(
      { schema: 'string-fields', conceptSpec: spec },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.elementCount).toBe(3);
  });

  it('handles concept spec with no annotations', async () => {
    const result = await uiSchemaHandler.inspect!(
      { schema: 'no-annot', conceptSpec: minimalSpec },
      storage,
    );
    expect(result.variant).toBe('ok');

    const record = await storage.get('uiSchema', 'no-annot');
    const entityElement = JSON.parse(record!.entityElement as string);
    expect(entityElement.tags).toEqual([]);
    expect(entityElement.suite).toBeNull();
  });

  it('handles concept spec with no fields', async () => {
    const spec = JSON.stringify({ name: 'Empty', fields: [], actions: ['trigger'] });
    const result = await uiSchemaHandler.inspect!(
      { schema: 'no-fields', conceptSpec: spec },
      storage,
    );
    expect(result.variant).toBe('ok');
    expect(result.elementCount).toBe(0);
  });

  it('returns parseError for invalid JSON', async () => {
    const result = await uiSchemaHandler.inspect!(
      { schema: 'bad-json', conceptSpec: 'not json' },
      storage,
    );
    expect(result.variant).toBe('parseError');
  });

  it('handles action objects with name property', async () => {
    const spec = JSON.stringify({
      name: 'ActionObj',
      fields: [],
      actions: [{ name: 'submit' }, { name: 'cancel' }],
    });
    await uiSchemaHandler.inspect!(
      { schema: 'action-obj', conceptSpec: spec },
      storage,
    );
    const record = await storage.get('uiSchema', 'action-obj');
    const entityElement = JSON.parse(record!.entityElement as string);
    expect(entityElement.actions).toEqual(['submit', 'cancel']);
  });
});

// ---------------------------------------------------------------------------
// override
// ---------------------------------------------------------------------------
describe('uiSchemaHandler.override', () => {
  let storage: TestStorage;
  beforeEach(async () => {
    storage = createTestStorage();
    await uiSchemaHandler.inspect!(
      { schema: 'override-schema', conceptSpec: minimalSpec },
      storage,
    );
  });

  it('applies overrides to a schema', async () => {
    const result = await uiSchemaHandler.override!(
      { schema: 'override-schema', overrides: JSON.stringify({ layout: 'horizontal' }) },
      storage,
    );
    expect(result.variant).toBe('ok');
  });

  it('merges multiple overrides', async () => {
    await uiSchemaHandler.override!(
      { schema: 'override-schema', overrides: JSON.stringify({ layout: 'horizontal' }) },
      storage,
    );
    await uiSchemaHandler.override!(
      { schema: 'override-schema', overrides: JSON.stringify({ density: 'compact' }) },
      storage,
    );
    const record = await storage.get('uiSchema', 'override-schema');
    const overrides = JSON.parse(record!.overrides as string);
    expect(overrides.layout).toBe('horizontal');
    expect(overrides.density).toBe('compact');
  });

  it('returns notfound for missing schema', async () => {
    const result = await uiSchemaHandler.override!(
      { schema: 'ghost', overrides: '{}' },
      storage,
    );
    expect(result.variant).toBe('notfound');
  });

  it('returns invalid for bad JSON overrides', async () => {
    const result = await uiSchemaHandler.override!(
      { schema: 'override-schema', overrides: 'not json' },
      storage,
    );
    expect(result.variant).toBe('invalid');
  });
});

// ---------------------------------------------------------------------------
// getSchema
// ---------------------------------------------------------------------------
describe('uiSchemaHandler.getSchema', () => {
  let storage: TestStorage;
  beforeEach(async () => {
    storage = createTestStorage();
    await uiSchemaHandler.inspect!(
      { schema: 'get-schema', conceptSpec: approvalSpec },
      storage,
    );
  });

  it('returns the UI schema', async () => {
    const result = await uiSchemaHandler.getSchema!(
      { schema: 'get-schema' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const uiSchema = JSON.parse(result.uiSchema as string);
    expect(uiSchema.concept).toBe('Approval');
    expect(uiSchema.elements).toEqual(['status', 'approver', 'reasoning']);
  });

  it('returns notfound for missing schema', async () => {
    const result = await uiSchemaHandler.getSchema!(
      { schema: 'ghost' },
      storage,
    );
    expect(result.variant).toBe('notfound');
  });
});

// ---------------------------------------------------------------------------
// getElements
// ---------------------------------------------------------------------------
describe('uiSchemaHandler.getElements', () => {
  let storage: TestStorage;
  beforeEach(async () => {
    storage = createTestStorage();
    await uiSchemaHandler.inspect!(
      { schema: 'elem-schema', conceptSpec: approvalSpec },
      storage,
    );
  });

  it('returns field elements', async () => {
    const result = await uiSchemaHandler.getElements!(
      { schema: 'elem-schema' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const elements = JSON.parse(result.elements as string);
    expect(elements).toEqual(['status', 'approver', 'reasoning']);
  });

  it('returns resolved variant after markResolved', async () => {
    await uiSchemaHandler.markResolved!(
      { schema: 'elem-schema' },
      storage,
    );
    const result = await uiSchemaHandler.getElements!(
      { schema: 'elem-schema' },
      storage,
    );
    expect(result.variant).toBe('resolved');
    expect(result.message).toContain('entity level');
  });

  it('returns notfound for missing schema', async () => {
    const result = await uiSchemaHandler.getElements!(
      { schema: 'ghost' },
      storage,
    );
    expect(result.variant).toBe('notfound');
  });
});

// ---------------------------------------------------------------------------
// getEntityElement
// ---------------------------------------------------------------------------
describe('uiSchemaHandler.getEntityElement', () => {
  let storage: TestStorage;
  beforeEach(async () => {
    storage = createTestStorage();
    await uiSchemaHandler.inspect!(
      { schema: 'entity-elem', conceptSpec: approvalSpec },
      storage,
    );
  });

  it('returns the entity element', async () => {
    const result = await uiSchemaHandler.getEntityElement!(
      { schema: 'entity-elem' },
      storage,
    );
    expect(result.variant).toBe('ok');
    const entity = JSON.parse(result.entityElement as string);
    expect(entity.kind).toBe('entity');
    expect(entity.concept).toBe('Approval');
    expect(entity.suite).toBe('governance');
  });

  it('returns notfound for missing schema', async () => {
    const result = await uiSchemaHandler.getEntityElement!(
      { schema: 'ghost' },
      storage,
    );
    expect(result.variant).toBe('notfound');
  });
});

// ---------------------------------------------------------------------------
// markResolved
// ---------------------------------------------------------------------------
describe('uiSchemaHandler.markResolved', () => {
  let storage: TestStorage;
  beforeEach(async () => {
    storage = createTestStorage();
    await uiSchemaHandler.inspect!(
      { schema: 'mark-schema', conceptSpec: minimalSpec },
      storage,
    );
  });

  it('marks schema as resolved', async () => {
    const result = await uiSchemaHandler.markResolved!(
      { schema: 'mark-schema' },
      storage,
    );
    expect(result.variant).toBe('ok');

    const record = await storage.get('uiSchema', 'mark-schema');
    expect(record!.resolved).toBe(true);
  });

  it('returns notfound for missing schema', async () => {
    const result = await uiSchemaHandler.markResolved!(
      { schema: 'ghost' },
      storage,
    );
    expect(result.variant).toBe('notfound');
  });

  it('is idempotent', async () => {
    await uiSchemaHandler.markResolved!({ schema: 'mark-schema' }, storage);
    const result = await uiSchemaHandler.markResolved!({ schema: 'mark-schema' }, storage);
    expect(result.variant).toBe('ok');
  });
});
