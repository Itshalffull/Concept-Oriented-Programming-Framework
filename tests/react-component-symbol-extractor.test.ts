// ============================================================
// ReactComponentSymbolExtractor Handler Tests
//
// Tests for extracting symbols from React TSX files: function
// components, arrow function components, class components,
// props types, hooks, and imports.
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { createInMemoryStorage } from '../kernel/src/storage.js';
import {
  reactComponentSymbolExtractorHandler,
  resetReactComponentSymbolExtractorCounter,
} from '../implementations/typescript/react-component-symbol-extractor.impl.js';

describe('ReactComponentSymbolExtractor', () => {
  let storage: ReturnType<typeof createInMemoryStorage>;

  beforeEach(() => {
    storage = createInMemoryStorage();
    resetReactComponentSymbolExtractorCounter();
  });

  // ── initialize ────────────────────────────────────────────

  describe('initialize', () => {
    it('initializes and returns ok with an instance id', async () => {
      const result = await reactComponentSymbolExtractorHandler.initialize({}, storage);
      expect(result.variant).toBe('ok');
      expect(result.instance).toBe('react-component-symbol-extractor-1');
    });
  });

  // ── extract ───────────────────────────────────────────────

  describe('extract', () => {
    it('extracts function component definitions', async () => {
      const source = `function MyButton(props: ButtonProps) {
  return <button>{props.label}</button>;
}`;
      const result = await reactComponentSymbolExtractorHandler.extract({
        source, file: 'MyButton.tsx',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const comps = symbols.filter((s: Record<string, string>) => s.symbolString.includes('react/component'));
      expect(comps.some((c: Record<string, string>) => c.displayName === 'MyButton' && c.role === 'definition')).toBe(true);
    });

    it('extracts exported function component with export role', async () => {
      const source = `export function Header() {
  return <header>Title</header>;
}`;
      const result = await reactComponentSymbolExtractorHandler.extract({
        source, file: 'Header.tsx',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const exports = symbols.filter((s: Record<string, string>) =>
        s.displayName === 'Header' && s.role === 'export'
      );
      expect(exports).toHaveLength(1);
    });

    it('extracts arrow function components', async () => {
      const source = `export const Card = (props: CardProps) => {
  return <div className="card">{props.children}</div>;
};`;
      const result = await reactComponentSymbolExtractorHandler.extract({
        source, file: 'Card.tsx',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const defs = symbols.filter((s: Record<string, string>) =>
        s.displayName === 'Card' && s.role === 'definition'
      );
      expect(defs).toHaveLength(1);
      expect(defs[0].symbolString).toBe('react/component/Card.tsx/Card');
    });

    it('extracts class components extending React.Component', async () => {
      const source = `export class Dashboard extends React.Component {
  render() { return <div />; }
}`;
      const result = await reactComponentSymbolExtractorHandler.extract({
        source, file: 'Dashboard.tsx',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const classDef = symbols.find((s: Record<string, string>) =>
        s.displayName === 'Dashboard' && s.kind === 'class' && s.role === 'definition'
      );
      expect(classDef).toBeDefined();
    });

    it('extracts class components extending PureComponent', async () => {
      const source = `class OptimizedWidget extends PureComponent {
  render() { return <span />; }
}`;
      const result = await reactComponentSymbolExtractorHandler.extract({
        source, file: 'OptimizedWidget.tsx',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const classDef = symbols.find((s: Record<string, string>) =>
        s.displayName === 'OptimizedWidget' && s.kind === 'class'
      );
      expect(classDef).toBeDefined();
    });

    it('extracts props interface definitions', async () => {
      const source = `interface ButtonProps {
  label: string;
  onClick: () => void;
}`;
      const result = await reactComponentSymbolExtractorHandler.extract({
        source, file: 'Button.tsx',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const propsType = symbols.find((s: Record<string, string>) =>
        s.displayName === 'ButtonProps' && s.kind === 'type'
      );
      expect(propsType).toBeDefined();
      expect(propsType.symbolString).toBe('react/props/Button.tsx/ButtonProps');
    });

    it('extracts props type alias definitions', async () => {
      const source = `type CardProps = {
  title: string;
  children: React.ReactNode;
};`;
      const result = await reactComponentSymbolExtractorHandler.extract({
        source, file: 'Card.tsx',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const propsType = symbols.find((s: Record<string, string>) =>
        s.displayName === 'CardProps'
      );
      expect(propsType).toBeDefined();
    });

    it('extracts hook usages', async () => {
      const source = `function Counter() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    console.log(count);
  }, [count]);
  const ref = useRef<HTMLDivElement>(null);
  return <div ref={ref}>{count}</div>;
}`;
      const result = await reactComponentSymbolExtractorHandler.extract({
        source, file: 'Counter.tsx',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const hooks = symbols.filter((s: Record<string, string>) =>
        s.symbolString.startsWith('react/hook/') && s.role === 'reference'
      );
      const hookNames = hooks.map((h: Record<string, string>) => h.displayName);
      expect(hookNames).toContain('useState');
      expect(hookNames).toContain('useEffect');
      expect(hookNames).toContain('useRef');
    });

    it('extracts custom hook definitions', async () => {
      const source = `export function useAuth() {
  const [user, setUser] = useState(null);
  return { user, setUser };
}`;
      const result = await reactComponentSymbolExtractorHandler.extract({
        source, file: 'useAuth.tsx',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const hookDef = symbols.find((s: Record<string, string>) =>
        s.displayName === 'useAuth' && s.role === 'definition' &&
        s.symbolString.includes('react/hook/')
      );
      expect(hookDef).toBeDefined();
    });

    it('extracts import statements', async () => {
      const source = `import React from 'react';
import { useState, useEffect } from 'react';`;
      const result = await reactComponentSymbolExtractorHandler.extract({
        source, file: 'App.tsx',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      const imports = symbols.filter((s: Record<string, string>) => s.role === 'import');
      const importNames = imports.map((i: Record<string, string>) => i.displayName);
      expect(importNames).toContain('React');
      expect(importNames).toContain('useState');
      expect(importNames).toContain('useEffect');
    });

    it('returns empty symbols for non-component file', async () => {
      const source = `// just a comment`;
      const result = await reactComponentSymbolExtractorHandler.extract({
        source, file: 'empty.tsx',
      }, storage);

      const symbols = JSON.parse(result.symbols as string);
      expect(symbols).toHaveLength(0);
    });
  });

  // ── getSupportedExtensions ────────────────────────────────

  describe('getSupportedExtensions', () => {
    it('returns .tsx extension', async () => {
      const result = await reactComponentSymbolExtractorHandler.getSupportedExtensions({}, storage);
      expect(result.variant).toBe('ok');
      const extensions = JSON.parse(result.extensions as string);
      expect(extensions).toContain('.tsx');
    });
  });
});
