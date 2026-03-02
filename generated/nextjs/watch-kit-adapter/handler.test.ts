// WatchKitAdapter — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { watchKitAdapterHandler } from './handler.js';
import type { WatchKitAdapterStorage } from './types.js';

const createTestStorage = (): WatchKitAdapterStorage => {
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
};

const createFailingStorage = (): WatchKitAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = watchKitAdapterHandler;

describe('WatchKitAdapter handler', () => {
  describe('normalize', () => {
    it('should return error variant for invalid JSON props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wk/WKInterfaceLabel', props: '{bad' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should normalize valid props with watchkit platform metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wk/WKInterfaceLabel', props: '{"text":"Hello"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.platform).toBe('watchkit');
          expect(normalized.runtime).toBe('watchos');
          expect(normalized.interfaceObject).toBe('WKInterfaceLabel');
        }
      }
    });

    it('should resolve known WK interface objects', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wk/WKInterfaceButton', props: '{"title":"Tap"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.interfaceObject).toBe('WKInterfaceButton');
      }
    });

    it('should default to WKInterfaceGroup for unknown interface objects', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wk/UnknownObject', props: '{"text":"hi"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.interfaceObject).toBe('WKInterfaceGroup');
      }
    });

    it('should map generic text-containing adapter to WKInterfaceLabel', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wk/MyLabel', props: '{"text":"hi"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.interfaceObject).toBe('WKInterfaceLabel');
      }
    });

    it('should transform generic props to WatchKit properties', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wk/WKInterfaceLabel', props: '{"color":"red","opacity":0.5}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.props.textColor).toBe('red');
        expect(normalized.props.alpha).toBe(0.5);
      }
    });

    it('should handle haptic feedback prop', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wk/WKInterfaceButton', props: '{"haptic":"success"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.props.hapticFeedback).toBe('success');
        expect(normalized.supportsHaptic).toBe(true);
      }
    });

    it('should handle complication family prop', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wk/WKInterfaceGroup', props: '{"complicationFamily":"graphicCircular"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.props.complicationFamily).toBe('graphicCircular');
        expect(normalized.supportsComplication).toBe(true);
      }
    });

    it('should resolve watch size from props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wk/WKInterfaceGroup', props: '{"watchSize":"38mm"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.display.width).toBe(136);
        expect(normalized.display.height).toBe(170);
      }
    });

    it('should handle alignment prop mapping', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'wk/WKInterfaceGroup', props: '{"alignment":"center"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.props.horizontalAlignment).toBe('center');
        expect(normalized.props.verticalAlignment).toBe('center');
      }
    });

    it('should persist normalized output to storage', async () => {
      const storage = createTestStorage();
      await handler.normalize(
        { adapter: 'wk/WKInterfaceLabel', props: '{"text":"Hello"}' },
        storage,
      )();
      const record = await storage.get('watchkitadapter', 'wk/WKInterfaceLabel');
      expect(record).not.toBeNull();
      expect(record!['adapter']).toBe('wk/WKInterfaceLabel');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.normalize(
        { adapter: 'wk/WKInterfaceLabel', props: '{"text":"hi"}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
