// ============================================================
// WidgetImplementationEntity Handler Tests
//
// Tests for widget implementation registration, retrieval,
// file lookup, framework/widget queries, anatomy mapping,
// spec diffing, and render frame resolution.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../runtime/adapters/storage.js';
import { widgetImplementationEntityHandler } from '../handlers/ts/score/widget-implementation-entity.handler.js';

describe('WidgetImplementationEntity Handler', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
  });

  // ----------------------------------------------------------
  // register
  // ----------------------------------------------------------

  describe('register', () => {
    it('registers a new widget implementation', async () => {
      const result = await widgetImplementationEntityHandler.register(
        { widget: 'Button', framework: 'react', sourceFile: 'generated/Button.tsx', ast: '{}' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.impl).toBeDefined();
    });

    it('returns alreadyRegistered for duplicate widget+framework', async () => {
      await widgetImplementationEntityHandler.register(
        { widget: 'Button', framework: 'react', sourceFile: 'generated/Button.tsx', ast: '{}' },
        storage,
      );
      const result = await widgetImplementationEntityHandler.register(
        { widget: 'Button', framework: 'react', sourceFile: 'generated/Button2.tsx', ast: '{}' },
        storage,
      );
      expect(result.variant).toBe('alreadyRegistered');
    });

    it('registers same widget for different frameworks', async () => {
      const react = await widgetImplementationEntityHandler.register(
        { widget: 'Button', framework: 'react', sourceFile: 'generated/react/Button.tsx', ast: '{}' },
        storage,
      );
      const vue = await widgetImplementationEntityHandler.register(
        { widget: 'Button', framework: 'vue', sourceFile: 'generated/vue/Button.vue', ast: '{}' },
        storage,
      );
      expect(react.impl).not.toBe(vue.impl);
    });

    it('stores parsed AST metadata', async () => {
      const ast = JSON.stringify({
        componentName: 'MyButton',
        renderedParts: [{ name: 'root' }, { name: 'label' }],
        propsInterface: { disabled: 'boolean' },
        stateBindings: ['pressed'],
      });
      await widgetImplementationEntityHandler.register(
        { widget: 'Button', framework: 'react', sourceFile: 'generated/Button.tsx', ast },
        storage,
      );
      const entry = (await storage.find('widget-implementations'))[0];
      expect(entry.componentName).toBe('MyButton');
      expect(JSON.parse(entry.renderedParts as string)).toHaveLength(2);
    });
  });

  // ----------------------------------------------------------
  // get
  // ----------------------------------------------------------

  describe('get', () => {
    it('retrieves by widget and framework', async () => {
      const reg = await widgetImplementationEntityHandler.register(
        { widget: 'Button', framework: 'react', sourceFile: 'generated/Button.tsx', ast: '{}' },
        storage,
      );
      const result = await widgetImplementationEntityHandler.get(
        { widget: 'Button', framework: 'react' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.impl).toBe(reg.impl);
    });

    it('returns notfound for nonexistent', async () => {
      const result = await widgetImplementationEntityHandler.get(
        { widget: 'Nope', framework: 'react' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // getByFile
  // ----------------------------------------------------------

  describe('getByFile', () => {
    it('finds implementation by source file', async () => {
      const reg = await widgetImplementationEntityHandler.register(
        { widget: 'Button', framework: 'react', sourceFile: 'generated/Button.tsx', ast: '{}' },
        storage,
      );
      const result = await widgetImplementationEntityHandler.getByFile(
        { sourceFile: 'generated/Button.tsx' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.impl).toBe(reg.impl);
    });

    it('returns notfound for unknown file', async () => {
      const result = await widgetImplementationEntityHandler.getByFile(
        { sourceFile: 'unknown.tsx' },
        storage,
      );
      expect(result.variant).toBe('notfound');
    });
  });

  // ----------------------------------------------------------
  // findByWidget / findByFramework
  // ----------------------------------------------------------

  describe('findByWidget', () => {
    it('returns all implementations for a widget', async () => {
      await widgetImplementationEntityHandler.register(
        { widget: 'Button', framework: 'react', sourceFile: 'generated/react/Button.tsx', ast: '{}' },
        storage,
      );
      await widgetImplementationEntityHandler.register(
        { widget: 'Button', framework: 'vue', sourceFile: 'generated/vue/Button.vue', ast: '{}' },
        storage,
      );
      const result = await widgetImplementationEntityHandler.findByWidget(
        { widget: 'Button' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const impls = JSON.parse(result.implementations as string);
      expect(impls).toHaveLength(2);
    });
  });

  describe('findByFramework', () => {
    it('returns all implementations for a framework', async () => {
      await widgetImplementationEntityHandler.register(
        { widget: 'Button', framework: 'react', sourceFile: 'generated/react/Button.tsx', ast: '{}' },
        storage,
      );
      await widgetImplementationEntityHandler.register(
        { widget: 'Input', framework: 'react', sourceFile: 'generated/react/Input.tsx', ast: '{}' },
        storage,
      );
      await widgetImplementationEntityHandler.register(
        { widget: 'Button', framework: 'vue', sourceFile: 'generated/vue/Button.vue', ast: '{}' },
        storage,
      );
      const result = await widgetImplementationEntityHandler.findByFramework(
        { framework: 'react' },
        storage,
      );
      expect(result.variant).toBe('ok');
      const impls = JSON.parse(result.implementations as string);
      expect(impls).toHaveLength(2);
    });
  });

  // ----------------------------------------------------------
  // anatomyMapping
  // ----------------------------------------------------------

  describe('anatomyMapping', () => {
    it('maps anatomy parts to DOM selectors', async () => {
      const ast = JSON.stringify({
        renderedParts: [{ name: 'root', element: 'button' }, { name: 'label', element: 'span' }],
      });
      const reg = await widgetImplementationEntityHandler.register(
        { widget: 'Button', framework: 'react', sourceFile: 'generated/Button.tsx', ast },
        storage,
      );
      const result = await widgetImplementationEntityHandler.anatomyMapping(
        { impl: reg.impl },
        storage,
      );
      expect(result.variant).toBe('ok');
      const mapping = JSON.parse(result.mapping as string);
      expect(mapping).toHaveLength(2);
      expect(mapping[0].part).toBe('root');
      expect(mapping[0].element).toBe('button');
      expect(mapping[0].selector).toBe('[data-part="root"]');
    });

    it('returns empty for nonexistent impl', async () => {
      const result = await widgetImplementationEntityHandler.anatomyMapping(
        { impl: 'bad-id' },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.mapping).toBe('[]');
    });
  });

  // ----------------------------------------------------------
  // diffFromSpec
  // ----------------------------------------------------------

  describe('diffFromSpec', () => {
    it('returns inSync (stub)', async () => {
      const reg = await widgetImplementationEntityHandler.register(
        { widget: 'Button', framework: 'react', sourceFile: 'generated/Button.tsx', ast: '{}' },
        storage,
      );
      const result = await widgetImplementationEntityHandler.diffFromSpec(
        { impl: reg.impl },
        storage,
      );
      expect(result.variant).toBe('inSync');
    });
  });

  // ----------------------------------------------------------
  // resolveRenderFrame
  // ----------------------------------------------------------

  describe('resolveRenderFrame', () => {
    it('resolves file:line:col to a widget implementation', async () => {
      await widgetImplementationEntityHandler.register(
        { widget: 'Button', framework: 'react', sourceFile: 'generated/Button.tsx', ast: '{}' },
        storage,
      );
      const result = await widgetImplementationEntityHandler.resolveRenderFrame(
        { file: 'generated/Button.tsx', line: 25, col: 8 },
        storage,
      );
      expect(result.variant).toBe('ok');
      expect(result.widget).toBe('Button');
      expect(result.sourceSpan).toBe('generated/Button.tsx:25:8');
    });

    it('returns notInWidgetImpl for unknown file', async () => {
      const result = await widgetImplementationEntityHandler.resolveRenderFrame(
        { file: 'unknown.tsx', line: 1, col: 1 },
        storage,
      );
      expect(result.variant).toBe('notInWidgetImpl');
    });
  });

  // ----------------------------------------------------------
  // resolveToAstNode
  // ----------------------------------------------------------

  describe('resolveToAstNode', () => {
    it('resolves line:col to AST node', async () => {
      const reg = await widgetImplementationEntityHandler.register(
        { widget: 'Button', framework: 'react', sourceFile: 'generated/Button.tsx', ast: '{}' },
        storage,
      );
      const result = await widgetImplementationEntityHandler.resolveToAstNode(
        { impl: reg.impl, line: 10, col: 5 },
        storage,
      );
      expect(result.variant).toBe('ok');
      const node = JSON.parse(result.node as string);
      expect(node.startLine).toBe(10);
    });

    it('returns outOfRange for nonexistent impl', async () => {
      const result = await widgetImplementationEntityHandler.resolveToAstNode(
        { impl: 'bad-id', line: 10, col: 5 },
        storage,
      );
      expect(result.variant).toBe('outOfRange');
    });
  });
});
