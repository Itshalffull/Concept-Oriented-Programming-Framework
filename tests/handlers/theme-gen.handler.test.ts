import { describe, expect, it } from 'vitest';
import { themeGenHandler } from '../../handlers/ts/app/theme-gen.handler.js';

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

describe('themeGenHandler', () => {
  const themeAst = JSON.stringify({
    tokens: {
      'color.primary': '#60a5fa',
      'density.multiplier': '0.92',
      'motif.navigation': 'sidebar',
    },
    context: {
      density: 'compact',
      motif: 'sidebar',
    },
  });

  it('generates CSS variables including context values', async () => {
    const result = await themeGenHandler.generate!(
      { gen: 'g1', target: 'css-variables', themeAst },
      createStorage() as never,
    );
    expect(result.variant).toBe('ok');
    expect(result.output).toContain('--color-primary: #60a5fa;');
    expect(result.output).toContain('--theme-density: compact;');
    expect(result.output).toContain('--theme-motif: sidebar;');
  });

  it('generates DTCG output with inferred token types', async () => {
    const result = await themeGenHandler.generate!(
      { gen: 'g2', target: 'w3c-dtcg', themeAst },
      createStorage() as never,
    );
    expect(result.variant).toBe('ok');
    const parsed = JSON.parse(result.output as string);
    expect(parsed.tokens['color.primary'].$type).toBe('color');
    expect(parsed.tokens['density.multiplier'].$type).toBe('number');
    expect(parsed.extensions.clef.context.motif).toBe('sidebar');
  });
});
