// WinUIAdapter — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { winUIAdapterHandler } from './handler.js';
import type { WinUIAdapterStorage } from './types.js';

const createTestStorage = (): WinUIAdapterStorage => {
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

const createFailingStorage = (): WinUIAdapterStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = winUIAdapterHandler;

describe('WinUIAdapter handler', () => {
  describe('normalize', () => {
    it('should return error variant for invalid JSON props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'winui/Button', props: 'not-json' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should return error variant for non-object JSON', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'winui/Button', props: '[1,2]' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('error');
      }
    });

    it('should normalize valid props with WinUI platform metadata', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'winui/Button', props: '{"content":"Click me"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          const normalized = JSON.parse(result.right.normalized);
          expect(normalized.platform).toBe('winui');
          expect(normalized.runtime).toBe('windows');
          expect(normalized.control).toBe('Button');
          expect(normalized.xamlNamespace).toBe('Microsoft.UI.Xaml.Controls');
          expect(normalized.designSystem).toBe('fluent');
        }
      }
    });

    it('should resolve known WinUI panels', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'winui/Grid', props: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.control).toBe('Grid');
        expect(normalized.isPanel).toBe(true);
      }
    });

    it('should resolve known WinUI controls', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'winui/TextBlock', props: '{"text":"Hello"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.control).toBe('TextBlock');
        expect(normalized.isPanel).toBe(false);
      }
    });

    it('should default to StackPanel for unknown controls', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'winui/UnknownControl', props: '{}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.control).toBe('StackPanel');
      }
    });

    it('should map CSS-like props to XAML properties', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'winui/TextBlock', props: '{"color":"red","fontSize":14,"opacity":0.8}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.properties.Foreground).toBe('red');
        expect(normalized.properties.FontSize).toBe(14);
        expect(normalized.properties.Opacity).toBe(0.8);
      }
    });

    it('should invert disabled prop to IsEnabled', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'winui/Button', props: '{"disabled":true}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.properties.IsEnabled).toBe(false);
      }
    });

    it('should handle Grid attached properties', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'winui/Button', props: '{"row":1,"col":2,"rowSpan":2}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.attachedProperties['Grid.Row']).toBe(1);
        expect(normalized.attachedProperties['Grid.Column']).toBe(2);
        expect(normalized.attachedProperties['Grid.RowSpan']).toBe(2);
      }
    });

    it('should map flex-direction to Orientation', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'winui/StackPanel', props: '{"flexDirection":"row"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.properties.Orientation).toBe('Horizontal');
      }
    });

    it('should handle alignment props', async () => {
      const storage = createTestStorage();
      const result = await handler.normalize(
        { adapter: 'winui/Button', props: '{"horizontalAlignment":"center","verticalAlignment":"top"}' },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result) && result.right.variant === 'ok') {
        const normalized = JSON.parse(result.right.normalized);
        expect(normalized.properties.HorizontalAlignment).toBe('Center');
        expect(normalized.properties.VerticalAlignment).toBe('Top');
      }
    });

    it('should persist normalized output to storage', async () => {
      const storage = createTestStorage();
      await handler.normalize(
        { adapter: 'winui/Button', props: '{"content":"Hi"}' },
        storage,
      )();
      const record = await storage.get('winuiadapter', 'winui/Button');
      expect(record).not.toBeNull();
      expect(record!['adapter']).toBe('winui/Button');
    });

    it('should return left on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.normalize(
        { adapter: 'winui/Button', props: '{"content":"Hi"}' },
        storage,
      )();
      expect(E.isLeft(result)).toBe(true);
    });
  });
});
