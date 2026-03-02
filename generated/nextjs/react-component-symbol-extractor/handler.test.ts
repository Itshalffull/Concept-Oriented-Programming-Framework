// ReactComponentSymbolExtractor — handler.test.ts
import { describe, it, expect } from 'vitest';
import * as TE from 'fp-ts/TaskEither';
import * as E from 'fp-ts/Either';
import { pipe } from 'fp-ts/function';

import { reactComponentSymbolExtractorHandler } from './handler.js';
import type { ReactComponentSymbolExtractorStorage } from './types.js';

const createTestStorage = (): ReactComponentSymbolExtractorStorage => {
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

const createFailingStorage = (): ReactComponentSymbolExtractorStorage => ({
  get: async () => { throw new Error('storage failure'); },
  put: async () => { throw new Error('storage failure'); },
  delete: async () => { throw new Error('storage failure'); },
  find: async () => { throw new Error('storage failure'); },
});

const handler = reactComponentSymbolExtractorHandler;

describe('ReactComponentSymbolExtractor handler', () => {
  describe('initialize', () => {
    it('should initialize and return ok with instance id', async () => {
      const storage = createTestStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('ok');
        if (result.right.variant === 'ok') {
          expect(result.right.instance).toContain('rcse-');
        }
      }
    });

    it('should return loadError on storage failure', async () => {
      const storage = createFailingStorage();
      const result = await handler.initialize({}, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.variant).toBe('loadError');
      }
    });
  });

  describe('extract', () => {
    it('should extract function component declarations', async () => {
      const storage = createTestStorage();
      const content = `
export function MyComponent(props: MyProps) {
  return <div />;
}

function AnotherComponent() {
  return <span />;
}
`;
      const result = await handler.extract(
        { file: 'components.tsx', content },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const names = result.right.symbols.map(s => s.name);
        expect(names).toContain('MyComponent');
        expect(names).toContain('AnotherComponent');
      }
    });

    it('should extract custom hook definitions', async () => {
      const storage = createTestStorage();
      const content = `
export function useAuth() { return {}; }
const useLocalStorage = () => {};
`;
      const result = await handler.extract(
        { file: 'hooks.ts', content },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const hooks = result.right.symbols.filter(s => s.kind === 'hook');
        expect(hooks.length).toBeGreaterThanOrEqual(1);
        expect(hooks.some(h => h.name === 'useAuth')).toBe(true);
      }
    });

    it('should extract context declarations', async () => {
      const storage = createTestStorage();
      const content = `
export const ThemeContext = React.createContext({});
const AuthContext = createContext(null);
`;
      const result = await handler.extract(
        { file: 'contexts.tsx', content },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const contexts = result.right.symbols.filter(s => s.kind === 'context');
        expect(contexts.length).toBe(2);
      }
    });

    it('should extract prop type interfaces', async () => {
      const storage = createTestStorage();
      const content = `
export interface ButtonProps {
  label: string;
}
type InputProps = { value: string };
`;
      const result = await handler.extract(
        { file: 'types.ts', content },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const propTypes = result.right.symbols.filter(s => s.kind === 'prop-type');
        expect(propTypes.length).toBe(2);
      }
    });

    it('should extract forwardRef components', async () => {
      const storage = createTestStorage();
      const content = `
export const FancyInput = React.forwardRef((props, ref) => <input />);
`;
      const result = await handler.extract(
        { file: 'forward.tsx', content },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const fwdRefs = result.right.symbols.filter(s => s.kind === 'forward-ref');
        expect(fwdRefs.length).toBe(1);
        expect(fwdRefs[0].name).toBe('FancyInput');
      }
    });

    it('should extract React.memo components', async () => {
      const storage = createTestStorage();
      const content = `
export const MemoizedList = React.memo(({ items }) => <ul />);
`;
      const result = await handler.extract(
        { file: 'memo.tsx', content },
        storage,
      )();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        const memos = result.right.symbols.filter(s => s.kind === 'memo');
        expect(memos.length).toBe(1);
      }
    });
  });

  describe('getComponents', () => {
    it('should return only component symbols for a file', async () => {
      const storage = createTestStorage();
      const content = `
export function Widget(props: WidgetProps) { return <div />; }
export function useWidget() { return {}; }
`;
      await handler.extract({ file: 'widget.tsx', content }, storage)();

      const result = await handler.getComponents({ file: 'widget.tsx' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.components.every(c => c.kind === 'component')).toBe(true);
      }
    });
  });

  describe('getHooks', () => {
    it('should return only hook symbols for a file', async () => {
      const storage = createTestStorage();
      const content = `
export function useToggle() { return {}; }
export function Panel() { return <div />; }
`;
      await handler.extract({ file: 'hooks.tsx', content }, storage)();

      const result = await handler.getHooks({ file: 'hooks.tsx' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.hooks.every(h => h.kind === 'hook')).toBe(true);
      }
    });
  });

  describe('findByName', () => {
    it('should find symbols by name across files', async () => {
      const storage = createTestStorage();
      await handler.extract(
        { file: 'a.tsx', content: 'export function Button() { return <button />; }' },
        storage,
      )();
      await handler.extract(
        { file: 'b.tsx', content: 'export function Button() { return <button />; }' },
        storage,
      )();

      const result = await handler.findByName({ name: 'Button' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.symbols.length).toBeGreaterThanOrEqual(1);
      }
    });

    it('should return empty for unknown symbol name', async () => {
      const storage = createTestStorage();
      const result = await handler.findByName({ name: 'NonexistentComponent' }, storage)();
      expect(E.isRight(result)).toBe(true);
      if (E.isRight(result)) {
        expect(result.right.symbols.length).toBe(0);
      }
    });
  });
});
