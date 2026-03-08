// Shape concept handler tests -- create, update, and delete actions.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { shapeHandler, resetShapeCounter } from '../handlers/ts/shape.handler.js';

describe('Shape', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetShapeCounter();
  });

  describe('create', () => {
    it('creates a shape with all properties', async () => {
      const result = await shapeHandler.create(
        { kind: 'rectangle', fill: '#ff0000', stroke: '#000000', text: 'Hello' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.shape).toBe('shape-1');

      const record = await storage.get('shape', 'shape-1');
      expect(record!.kind).toBe('rectangle');
      expect(record!.fill).toBe('#ff0000');
      expect(record!.stroke).toBe('#000000');
      expect(record!.text).toBe('Hello');
    });

    it('defaults fill, stroke, and text to null', async () => {
      const result = await shapeHandler.create({ kind: 'ellipse' }, storage);
      expect(result.variant).toBe('ok');

      const record = await storage.get('shape', result.shape as string);
      expect(record!.fill).toBeNull();
      expect(record!.stroke).toBeNull();
      expect(record!.text).toBeNull();
    });

    it('assigns unique IDs', async () => {
      const r1 = await shapeHandler.create({ kind: 'rectangle' }, storage);
      const r2 = await shapeHandler.create({ kind: 'ellipse' }, storage);
      expect(r1.shape).not.toBe(r2.shape);
    });
  });

  describe('update', () => {
    it('updates the fill color', async () => {
      const created = await shapeHandler.create({ kind: 'rectangle', fill: 'red' }, storage);
      const id = created.shape as string;

      const result = await shapeHandler.update({ shape: id, fill: 'blue' }, storage);
      expect(result.variant).toBe('ok');

      const record = await storage.get('shape', id);
      expect(record!.fill).toBe('blue');
      expect(record!.kind).toBe('rectangle');
    });

    it('updates the kind', async () => {
      const created = await shapeHandler.create({ kind: 'rectangle' }, storage);
      const id = created.shape as string;

      await shapeHandler.update({ shape: id, kind: 'ellipse' }, storage);

      const record = await storage.get('shape', id);
      expect(record!.kind).toBe('ellipse');
    });

    it('updates the text', async () => {
      const created = await shapeHandler.create({ kind: 'rectangle' }, storage);
      const id = created.shape as string;

      await shapeHandler.update({ shape: id, text: 'Updated' }, storage);

      const record = await storage.get('shape', id);
      expect(record!.text).toBe('Updated');
    });

    it('updates multiple properties at once', async () => {
      const created = await shapeHandler.create({ kind: 'rectangle' }, storage);
      const id = created.shape as string;

      await shapeHandler.update({ shape: id, fill: 'green', stroke: 'black', text: 'Box' }, storage);

      const record = await storage.get('shape', id);
      expect(record!.fill).toBe('green');
      expect(record!.stroke).toBe('black');
      expect(record!.text).toBe('Box');
    });

    it('returns notFound for non-existent shape', async () => {
      const result = await shapeHandler.update({ shape: 'nonexistent', fill: 'red' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('delete', () => {
    it('deletes an existing shape', async () => {
      const created = await shapeHandler.create({ kind: 'rectangle' }, storage);
      const id = created.shape as string;

      const result = await shapeHandler.delete({ shape: id }, storage);
      expect(result.variant).toBe('ok');

      const record = await storage.get('shape', id);
      expect(record).toBeNull();
    });

    it('returns notFound for non-existent shape', async () => {
      const result = await shapeHandler.delete({ shape: 'nonexistent' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('multi-step sequences', () => {
    it('create -> update -> delete lifecycle', async () => {
      const created = await shapeHandler.create({ kind: 'triangle', fill: 'yellow' }, storage);
      const id = created.shape as string;

      await shapeHandler.update({ shape: id, fill: 'orange', text: 'Warning' }, storage);
      const record = await storage.get('shape', id);
      expect(record!.fill).toBe('orange');
      expect(record!.text).toBe('Warning');

      await shapeHandler.delete({ shape: id }, storage);
      const deleted = await storage.get('shape', id);
      expect(deleted).toBeNull();
    });

    it('delete then update returns notFound', async () => {
      const created = await shapeHandler.create({ kind: 'rectangle' }, storage);
      const id = created.shape as string;

      await shapeHandler.delete({ shape: id }, storage);
      const result = await shapeHandler.update({ shape: id, fill: 'red' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });
});
