// Frame concept handler tests -- create, resize, addItem, removeItem, and setBackground actions.

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { frameHandler, resetFrameCounter } from '../handlers/ts/frame.handler.js';

describe('Frame', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetFrameCounter();
  });

  describe('create', () => {
    it('creates a frame with bounds', async () => {
      const result = await frameHandler.create({ width: 200, height: 100, x: 10, y: 20 }, storage);
      expect(result.variant).toBe('ok');
      expect(result.frame).toBe('frame-1');

      const record = await storage.get('frame', 'frame-1');
      expect(record!.width).toBe(200);
      expect(record!.height).toBe(100);
      expect(record!.x).toBe(10);
      expect(record!.y).toBe(20);
    });

    it('defaults x and y to 0', async () => {
      const result = await frameHandler.create({ width: 100, height: 50 }, storage);
      expect(result.variant).toBe('ok');

      const record = await storage.get('frame', result.frame as string);
      expect(record!.x).toBe(0);
      expect(record!.y).toBe(0);
    });

    it('initializes empty items list', async () => {
      const result = await frameHandler.create({ width: 100, height: 50 }, storage);
      const items = await storage.get('frame_items', result.frame as string);
      expect(items!.items).toEqual([]);
    });

    it('assigns unique IDs', async () => {
      const r1 = await frameHandler.create({ width: 100, height: 50 }, storage);
      const r2 = await frameHandler.create({ width: 200, height: 100 }, storage);
      expect(r1.frame).not.toBe(r2.frame);
    });

    it('stores label when provided', async () => {
      const result = await frameHandler.create({ width: 100, height: 50, label: 'My Frame' }, storage);
      const record = await storage.get('frame', result.frame as string);
      expect(record!.label).toBe('My Frame');
    });
  });

  describe('resize', () => {
    it('updates width and height', async () => {
      const created = await frameHandler.create({ width: 100, height: 50 }, storage);
      const id = created.frame as string;

      const result = await frameHandler.resize({ frame: id, width: 300, height: 200 }, storage);
      expect(result.variant).toBe('ok');

      const record = await storage.get('frame', id);
      expect(record!.width).toBe(300);
      expect(record!.height).toBe(200);
    });

    it('returns notFound for non-existent frame', async () => {
      const result = await frameHandler.resize({ frame: 'nonexistent', width: 100, height: 50 }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('addItem', () => {
    it('adds an item to the frame', async () => {
      const created = await frameHandler.create({ width: 100, height: 50 }, storage);
      const id = created.frame as string;

      const result = await frameHandler.addItem({ frame: id, item: 'shape-1' }, storage);
      expect(result.variant).toBe('ok');

      const items = await storage.get('frame_items', id);
      expect(items!.items).toEqual(['shape-1']);
    });

    it('adds multiple items', async () => {
      const created = await frameHandler.create({ width: 100, height: 50 }, storage);
      const id = created.frame as string;

      await frameHandler.addItem({ frame: id, item: 'shape-1' }, storage);
      await frameHandler.addItem({ frame: id, item: 'shape-2' }, storage);

      const items = await storage.get('frame_items', id);
      expect(items!.items).toEqual(['shape-1', 'shape-2']);
    });

    it('returns already_present for duplicate item', async () => {
      const created = await frameHandler.create({ width: 100, height: 50 }, storage);
      const id = created.frame as string;

      await frameHandler.addItem({ frame: id, item: 'shape-1' }, storage);
      const result = await frameHandler.addItem({ frame: id, item: 'shape-1' }, storage);
      expect(result.variant).toBe('already_present');
    });

    it('returns notFound for non-existent frame', async () => {
      const result = await frameHandler.addItem({ frame: 'nonexistent', item: 'shape-1' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('removeItem', () => {
    it('removes an item from the frame', async () => {
      const created = await frameHandler.create({ width: 100, height: 50 }, storage);
      const id = created.frame as string;

      await frameHandler.addItem({ frame: id, item: 'shape-1' }, storage);
      await frameHandler.addItem({ frame: id, item: 'shape-2' }, storage);

      const result = await frameHandler.removeItem({ frame: id, item: 'shape-1' }, storage);
      expect(result.variant).toBe('ok');

      const items = await storage.get('frame_items', id);
      expect(items!.items).toEqual(['shape-2']);
    });

    it('returns not_present if item is not in the frame', async () => {
      const created = await frameHandler.create({ width: 100, height: 50 }, storage);
      const id = created.frame as string;

      const result = await frameHandler.removeItem({ frame: id, item: 'shape-1' }, storage);
      expect(result.variant).toBe('not_present');
    });

    it('returns notFound for non-existent frame', async () => {
      const result = await frameHandler.removeItem({ frame: 'nonexistent', item: 'shape-1' }, storage);
      expect(result.variant).toBe('notFound');
    });
  });

  describe('setBackground', () => {
    it('sets the background color', async () => {
      const created = await frameHandler.create({ width: 100, height: 50 }, storage);
      const id = created.frame as string;

      const result = await frameHandler.setBackground({ frame: id, color: '#ff0000' }, storage);
      expect(result.variant).toBe('ok');

      const record = await storage.get('frame', id);
      expect(record!.background).toBe('#ff0000');
    });

    it('returns notFound for non-existent frame', async () => {
      const result = await frameHandler.setBackground({ frame: 'nonexistent', color: '#ff0000' }, storage);
      expect(result.variant).toBe('notFound');
    });

    it('background starts as null', async () => {
      const created = await frameHandler.create({ width: 100, height: 50 }, storage);
      const record = await storage.get('frame', created.frame as string);
      expect(record!.background).toBeNull();
    });
  });

  describe('multi-step sequences', () => {
    it('create -> addItem -> removeItem -> verify empty', async () => {
      const created = await frameHandler.create({ width: 100, height: 50 }, storage);
      const id = created.frame as string;

      await frameHandler.addItem({ frame: id, item: 'item-1' }, storage);
      await frameHandler.removeItem({ frame: id, item: 'item-1' }, storage);

      const items = await storage.get('frame_items', id);
      expect(items!.items).toEqual([]);
    });

    it('create -> resize -> setBackground', async () => {
      const created = await frameHandler.create({ width: 100, height: 50 }, storage);
      const id = created.frame as string;

      await frameHandler.resize({ frame: id, width: 500, height: 300 }, storage);
      await frameHandler.setBackground({ frame: id, color: 'blue' }, storage);

      const record = await storage.get('frame', id);
      expect(record!.width).toBe(500);
      expect(record!.height).toBe(300);
      expect(record!.background).toBe('blue');
    });
  });
});
