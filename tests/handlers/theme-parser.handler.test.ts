import { describe, expect, it } from 'vitest';
import { themeParserHandler } from '../../handlers/ts/app/theme-parser.handler.js';

function createStorage() {
  const data = new Map<string, Map<string, Record<string, unknown>>>();
  const relation = (name: string) => {
    if (!data.has(name)) data.set(name, new Map());
    return data.get(name)!;
  };

  return {
    async put(name: string, key: string, value: Record<string, unknown>) {
      relation(name).set(key, { ...value });
    },
    async get(name: string, key: string) {
      const value = relation(name).get(key);
      return value ? { ...value } : null;
    },
  };
}

describe('themeParserHandler', () => {
  it('parses expressive theme blocks into derived tokens and context', async () => {
    const storage = createStorage();
    const source = JSON.stringify({
      name: 'editorial',
      colorScheme: {
        activeMode: 'dark',
        modes: {
          dark: {
            primary: '#60a5fa',
            onPrimary: '#0f172a',
            background: '#020617',
            foreground: '#f8fafc',
          },
        },
      },
      density: {
        mode: 'compact',
        multiplier: 0.92,
      },
      structuralMotif: {
        default: 'sidebar',
        intents: {
          navigation: 'sidebar',
        },
      },
      typeScale: {
        steps: {
          body: '16px',
          heading: '28px',
        },
      },
      springPhysics: {
        presets: {
          snappy: { tension: 280, friction: 22 },
        },
      },
    });

    const result = await themeParserHandler.parse!({ theme: 'theme-1', source }, storage as never);
    expect(result.variant).toBe('ok');

    const ast = JSON.parse(result.ast as string);
    expect(ast.sourceType).toBe('expressive-theme');
    expect(ast.context).toEqual({ density: 'compact', motif: 'sidebar' });
    expect(ast.tokens['color.primary']).toBe('#60a5fa');
    expect(ast.tokens['density.multiplier']).toBe('0.92');
    expect(ast.tokens['typography.heading']).toBe('28px');
    expect(ast.tokens['motion.spring.snappy']).toContain('"tension":280');
    expect(ast.tokens['motif.navigation']).toBe('sidebar');
  });

  it('reports contrast violations for low-contrast pairs', async () => {
    const storage = createStorage();
    const source = JSON.stringify({
      colorScheme: {
        activeMode: 'light',
        modes: {
          light: {
            foreground: '#777777',
            background: '#888888',
          },
        },
      },
    });

    const parseResult = await themeParserHandler.parse!({ theme: 'contrast-theme', source }, storage as never);
    expect(parseResult.variant).toBe('ok');

    const checkResult = await themeParserHandler.checkContrast!({ theme: 'contrast-theme' }, storage as never);
    expect(checkResult.variant).toBe('violations');
    expect(JSON.parse(checkResult.failures as string)[0]).toContain('foreground/background');
  });
});
